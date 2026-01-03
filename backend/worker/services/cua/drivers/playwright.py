import base64
import json
import logging
import time
from typing import Any, Dict, Optional

from playwright.async_api import Browser, BrowserContext, Page, async_playwright  # type: ignore

from services.cua.environment import Environment

logger = logging.getLogger(__name__)


class PlaywrightEnvironment(Environment):
    """Playwright async environment for CUA (safe inside asyncio loops)."""

    def __init__(self):
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.display_width = 1024
        self.display_height = 768

    async def initialize(self, display_width: int = 1024, display_height: int = 768) -> None:
        self.display_width = display_width
        self.display_height = display_height

        try:
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(
                headless=True,
                args=[
                    "--disable-gpu",
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-accelerated-2d-canvas",
                    "--disable-web-security",
                    "--single-process",
                ],
            )

            context_options: Dict[str, Any] = {
                "viewport": {"width": display_width, "height": display_height},
                "user_agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            }

            self.context = await self.browser.new_context(**context_options)
            self.page = await self.context.new_page()

            try:
                await self.page.goto("about:blank", wait_until="domcontentloaded")
            except Exception as e:
                logger.warning(f"Initial navigation failed: {e}")

            logger.info(f"[PlaywrightEnvironment] Initialized {display_width}x{display_height}")
        except Exception as e:
            logger.error(f"[PlaywrightEnvironment] Failed to initialize: {e}", exc_info=True)
            await self.cleanup()
            raise

    async def execute_action(self, action: Dict[str, Any]) -> None:
        if not self.page:
            raise RuntimeError("Browser not initialized. Call initialize() first.")

        action_type = str(action.get("type", "")).lower()

        # #region debug-move-action
        try:
            supported = {
                "click",
                "type",
                "scroll",
                "keypress",
                "wait",
                "screenshot",
                "navigate",
            }
            if action_type not in supported:
                with open("/Users/canyonsmith/lead-magnent-ai/.cursor/debug.log", "a") as f:
                    f.write(
                        json.dumps(
                            {
                                "sessionId": "debug-session",
                                "runId": "pre-fix",
                                "hypothesisId": "H1-move-unsupported",
                                "location": "playwright.py:execute_action",
                                "timestamp": int(time.time() * 1000),
                                "message": "PlaywrightEnvironment received unsupported action type",
                                "data": {
                                    "action_type": action_type,
                                    "has_x": "x" in action,
                                    "has_y": "y" in action,
                                    "x": action.get("x"),
                                    "y": action.get("y"),
                                    "has_url": "url" in action,
                                    "url": action.get("url"),
                                    "keys": action.get("keys") or action.get("key"),
                                },
                            }
                        )
                        + "\n"
                    )
        except Exception:
            pass
        # #endregion

        if action_type == "click":
            x = action.get("x")
            y = action.get("y")
            button = str(action.get("button", "left")).lower()
            if x is None or y is None:
                raise ValueError("Click action requires x and y")
            if button not in ("left", "right", "middle"):
                button = "left"
            await self.page.mouse.click(x, y, button=button)

        elif action_type == "double_click":
            x = action.get("x")
            y = action.get("y")
            button = str(action.get("button", "left")).lower()
            if x is None or y is None:
                raise ValueError("Double click action requires x and y")
            if button not in ("left", "right", "middle"):
                button = "left"
            await self.page.mouse.dblclick(x, y, button=button)

        elif action_type == "drag_and_drop":
            # Support coordinate-based drag and drop (e.g. from Anthropic computer use model)
            # which usually sends: drag (start coords) -> drop (end coords) via move+down+move+up,
            # BUT if it sends an explicit drag_and_drop action with source/target coords:
            source_x = action.get("source_x") or action.get("x")
            source_y = action.get("source_y") or action.get("y")
            target_x = action.get("target_x")
            target_y = action.get("target_y")

            if source_x is None or source_y is None or target_x is None or target_y is None:
                # If explicit coords missing, check for selectors? 
                # For now assume model uses coordinates for computer use.
                raise ValueError("Drag and drop action requires source_x, source_y, target_x, target_y")
            
            await self.page.mouse.move(source_x, source_y)
            await self.page.mouse.down()
            await self.page.mouse.move(target_x, target_y, steps=10) # smooth drag
            await self.page.mouse.up()

        elif action_type in ("move", "hover", "mouse_move"):
            # "move" is emitted by the model in some flows (e.g. to hover/reposition cursor)
            x = action.get("x")
            y = action.get("y")
            if x is None or y is None:
                raise ValueError("Move action requires x and y")
            await self.page.mouse.move(x, y)

        elif action_type == "type":
            text = action.get("text", "")
            if not text:
                raise ValueError("Type action requires 'text'")
            await self.page.keyboard.type(str(text))

        elif action_type == "scroll":
            # Support both OpenAI spec (scroll_x/scroll_y) and legacy (delta_x/delta_y)
            x = action.get("x", 0) or 0
            y = action.get("y", 0) or 0
            dx = action.get("scroll_x", action.get("delta_x", 0)) or 0
            dy = action.get("scroll_y", action.get("delta_y", 0)) or 0
            try:
                await self.page.mouse.move(x, y)
            except Exception:
                pass
            await self.page.mouse.wheel(dx, dy)

        elif action_type == "keypress":
            # Support both { key: "Enter" } and { keys: ["CTRL","L"] }
            keys = action.get("keys")
            key = action.get("key")

            if isinstance(keys, list) and len(keys) > 0:
                mapped = []
                for k in keys:
                    s = str(k).strip()
                    mapping = {
                        "CTRL": "Control",
                        "CONTROL": "Control",
                        "CMD": "Meta",
                        "COMMAND": "Meta",
                        "META": "Meta",
                        "WIN": "Meta",
                        "WINDOWS": "Meta",
                        "SUPER": "Meta",
                        "ALT": "Alt",
                        "OPTION": "Alt",
                        "SHIFT": "Shift",
                        "ENTER": "Enter",
                        "RETURN": "Enter",
                        "ESC": "Escape",
                        "ESCAPE": "Escape",
                        "BACKSPACE": "Backspace",
                        "DELETE": "Delete",
                        "DEL": "Delete",
                        "SPACE": "Space",
                        "TAB": "Tab",
                        "UP": "ArrowUp",
                        "DOWN": "ArrowDown",
                        "LEFT": "ArrowLeft",
                        "RIGHT": "ArrowRight",
                        "PAGEUP": "PageUp",
                        "PAGEDOWN": "PageDown",
                        "HOME": "Home",
                        "END": "End",
                    }
                    mapped.append(mapping.get(s.upper(), s))
                combo = "+".join(mapped)
                await self.page.keyboard.press(combo)
            elif key:
                await self.page.keyboard.press(str(key))
            else:
                raise ValueError("Keypress action requires 'key' or 'keys'")

        elif action_type == "wait":
            duration_ms = action.get("duration_ms", 500)  # Reduced default from 1000ms to 500ms
            try:
                await self.page.wait_for_timeout(int(duration_ms))
            except Exception:
                await self.page.wait_for_timeout(500)

        elif action_type == "screenshot":
            # No-op; screenshot captured each turn by agent
            return

        elif action_type == "cursor_position":
            # Return cursor position - not a standard action but useful
            # Playwright doesn't easily expose cursor pos, so we track it or ignore
            pass

        elif action_type == "navigate":
            url = action.get("url")
            if not url:
                raise ValueError("Navigate action requires 'url'")
            
            # Ensure URL has protocol
            if not url.startswith("http://") and not url.startswith("https://"):
                url = "https://" + url

            try:
                # Use domcontentloaded for more reliable loading state than commit
                # Increase timeout to 30s to be safe
                await self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
            except Exception as e:
                # Raise a clean error that the agent can report to the model
                raise ValueError(f"Navigation failed: {str(e)}")

            # Wait a bit for any client-side hydration
            try:
                await self.page.wait_for_timeout(2000)
            except Exception:
                pass

        else:
            raise ValueError(f"Unsupported action type: {action_type}")

        # Reduced wait time - only wait briefly for DOM updates
        try:
            await self.page.wait_for_load_state("domcontentloaded", timeout=500)
        except Exception:
            pass

    async def capture_screenshot(self) -> str:
        if not self.page:
            raise RuntimeError("Browser not initialized. Call initialize() first.")
        # Optimize screenshot: use jpeg format with quality 80 for faster encoding/smaller size
        screenshot_bytes = await self.page.screenshot(
            type='jpeg',
            quality=80,
            full_page=False  # Only capture viewport, not full page
        )
        return base64.b64encode(screenshot_bytes).decode("utf-8")

    async def get_current_url(self) -> Optional[str]:
        if not self.page:
            return None
        return self.page.url

    async def cleanup(self) -> None:
        try:
            if self.page:
                await self.page.close()
                self.page = None
            if self.context:
                await self.context.close()
                self.context = None
            if self.browser:
                await self.browser.close()
                self.browser = None
            if self.playwright:
                await self.playwright.stop()
                self.playwright = None
        except Exception as e:
            logger.error(f"[PlaywrightEnvironment] Cleanup error: {e}", exc_info=True)

    async def is_healthy(self) -> bool:
        return self.browser is not None and self.page is not None

