"""Browser automation service using Playwright."""
import logging
import base64
import os
import time
from typing import Optional, Dict, Any
from playwright.sync_api import sync_playwright, Browser, Page, BrowserContext  # type: ignore
from utils.decimal_utils import convert_decimals_to_float

logger = logging.getLogger(__name__)

def _env_flag_is_true(value: Optional[str]) -> bool:
    return str(value or "").strip().lower() in ("1", "true", "yes", "y", "on")

def _env_flag_is_false(value: Optional[str]) -> bool:
    return str(value or "").strip().lower() in ("0", "false", "no", "n", "off")

def _running_in_lambda() -> bool:
    return bool(
        os.environ.get("AWS_LAMBDA_FUNCTION_NAME")
        or os.environ.get("AWS_EXECUTION_ENV")
        or os.environ.get("LAMBDA_TASK_ROOT")
    )

def _should_use_single_process() -> bool:
    override = os.environ.get("CUA_PLAYWRIGHT_SINGLE_PROCESS")
    if _env_flag_is_true(override):
        return True
    if _env_flag_is_false(override):
        return False
    return _running_in_lambda()

def _should_disable_sandbox() -> bool:
    override = os.environ.get("CUA_PLAYWRIGHT_NO_SANDBOX")
    if _env_flag_is_true(override):
        return True
    if _env_flag_is_false(override):
        return False
    return _running_in_lambda()


class BrowserService:
    """Service for browser automation using Playwright."""
    
    def __init__(self):
        """Initialize browser service."""
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.display_width = 1024
        self.display_height = 768
    
    def initialize(
        self,
        display_width: int = 1024,
        display_height: int = 768,
        storage_state: Optional[dict] = None
    ):
        """
        Initialize Playwright browser with specified display settings.
        
        Args:
            display_width: Browser viewport width
            display_height: Browser viewport height
            storage_state: Optional storage state (cookies, localStorage) - will be converted from Decimal
        """
        self.display_width = display_width
        self.display_height = display_height
        
        try:
            self.playwright = sync_playwright().start()
            launch_args = [
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-web-security',
            ]
            if _should_disable_sandbox():
                launch_args += ['--no-sandbox', '--disable-setuid-sandbox']
            if _should_use_single_process():
                launch_args += ['--single-process']  # Useful in Lambda; can crash locally
            self.browser = self.playwright.chromium.launch(
                headless=True,
                args=launch_args
            )
            
            context_options = {
                "viewport": {"width": display_width, "height": display_height},
                "user_agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
            }
            
            if storage_state:
                storage_state = convert_decimals_to_float(storage_state)
                context_options["storage_state"] = storage_state
            
            self.context = self.browser.new_context(**context_options)
            self.page = self.context.new_page()
            
            logger.info(f"Browser initialized with viewport {display_width}x{display_height}")
            
        except Exception as e:
            logger.error(f"Failed to initialize browser: {e}", exc_info=True)
            self.cleanup()
            raise
    
    def navigate(self, url: str, timeout: int = 30000):
        """
        Navigate to a URL.
        
        Args:
            url: URL to navigate to
            timeout: Navigation timeout in milliseconds
        """
        if not self.page:
            raise RuntimeError("Browser not initialized. Call initialize() first.")
        
        # Check if page/context/browser is still valid
        if self.page.is_closed():
            raise RuntimeError("Page has been closed. Browser may have crashed.")
        
        try:
            self.page.goto(url, timeout=timeout, wait_until="domcontentloaded")
            logger.info(f"Navigated to {url}")
        except Exception as e:
            logger.error(f"Failed to navigate to {url}: {e}", exc_info=True)
            # Check if browser crashed
            if self.page.is_closed() or (self.browser and not self.browser.is_connected()):
                raise RuntimeError(f"Browser crashed during navigation: {e}")
            raise
    
    def capture_screenshot(self) -> str:
        """
        Capture screenshot of current page.
        
        Returns:
            Base64 encoded PNG screenshot
        """
        if not self.page:
            raise RuntimeError("Browser not initialized. Call initialize() first.")
        
        # Check if page/context/browser is still valid
        if self.page.is_closed():
             # Instead of generic error, try to be specific so caller can handle gracefully
            raise RuntimeError("Browser closed unexpectedly (page.is_closed=True)")
        
        if self.browser and not self.browser.is_connected():
             raise RuntimeError("Browser closed unexpectedly (browser.is_connected=False)")
        
        try:
            screenshot_bytes = self.page.screenshot()
            screenshot_b64 = base64.b64encode(screenshot_bytes).decode("utf-8")
            logger.info(f"Screenshot captured ({len(screenshot_b64)} chars)")
            return screenshot_b64
        except Exception as e:
            error_str = str(e)
            if "Target page, context or browser has been closed" in error_str:
                logger.warning(f"Browser closed during screenshot: {e}")
                raise RuntimeError("Browser closed unexpectedly during screenshot")
            
            logger.error(f"Failed to capture screenshot: {e}", exc_info=True)
            raise
    
    def get_current_url(self) -> str:
        """Get the current page URL."""
        if not self.page:
            raise RuntimeError("Browser not initialized. Call initialize() first.")
        return self.page.url

    def get_accessibility_tree(self) -> Optional[Dict[str, Any]]:
        """Get the accessibility tree of the current page."""
        if not self.page:
            return None
        try:
            return self.page.accessibility.snapshot()
        except Exception as e:
            logger.warning(f"Failed to get accessibility tree: {e}")
            return None
    
    def execute_action(self, action: Dict[str, Any]):
        """
        Execute a computer use action (click, type, scroll, keypress, wait).
        
        Args:
            action: Action dictionary with 'type' and action-specific parameters
                   Supported types: 'click', 'type', 'scroll', 'keypress', 'wait'
        """
        if not self.page:
            raise RuntimeError("Browser not initialized. Call initialize() first.")
        
        # Check if page/context/browser is still valid
        if self.page.is_closed():
            raise RuntimeError("Page has been closed. Browser may have crashed.")
        
        if self.browser and not self.browser.is_connected():
            raise RuntimeError("Browser has been disconnected.")
        
        action_type = action.get('type', '').lower().strip()
        # Log raw action type for debugging "Unsupported action type" errors
        logger.debug(f"Received action type: '{action_type}' (raw: '{action.get('type')}')")
        
        try:
            if action_type == 'click' or action_type == 'left_click':
                self._execute_click(action)
            elif action_type == 'right_click':
                action['button'] = 'right'
                self._execute_click(action)
            elif action_type == 'type' or action_type == 'input_text' or action_type == 'typing':
                self._execute_type(action)
            elif action_type == 'scroll' or action_type == 'scroll_to':
                self._execute_scroll(action)
            elif action_type == 'keypress' or action_type == 'key_press':
                self._execute_keypress(action)
            elif action_type == 'wait':
                self._execute_wait(action)
            elif action_type == 'hover' or action_type == 'move' or action_type == 'mouse_move':
                self._execute_hover(action)
            elif action_type == 'drag_and_drop' or action_type == 'drag' or action_type == 'dragdrop':
                self._execute_drag_and_drop(action)
            elif action_type == 'double_click' or action_type == 'doubleclick':
                self._execute_double_click(action)
            elif action_type == 'screenshot' or action_type == 'capture_screenshot':
                # No-op, the loop will capture a screenshot after this action returns
                logger.debug("Executed screenshot action (no-op)")
            else:
                available_types = ['click', 'right_click', 'type', 'scroll', 'keypress', 'wait', 'hover', 'drag_and_drop', 'double_click', 'screenshot']
                logger.warning(f"Unknown action type: '{action_type}'. Available: {available_types}")
                raise ValueError(f"Unsupported action type: '{action_type}'. Supported: {', '.join(available_types)}")
            
            logger.info(f"Executed action: {action_type}")
            
        except Exception as e:
            logger.error(f"Failed to execute action {action_type}: {e}", exc_info=True)
            raise
    
    def _update_cursor_visuals(self, x: int, y: int, click: bool = False):
        """
        Inject/Update visual cursor in the DOM for debugging and screenshot clarity.
        """
        if not self.page:
            return

        try:
            self.page.evaluate("""
                ({ x, y, click }) => {
                    let cursor = document.getElementById('ai-cursor');
                    if (!cursor) {
                        cursor = document.createElement('div');
                        cursor.id = 'ai-cursor';
                        cursor.style.position = 'fixed';
                        cursor.style.width = '20px';
                        cursor.style.height = '20px';
                        cursor.style.borderRadius = '50%';
                        cursor.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
                        cursor.style.border = '2px solid red';
                        cursor.style.zIndex = '2147483647'; // Max z-index
                        cursor.style.pointerEvents = 'none';
                        cursor.style.transform = 'translate(-50%, -50%)';
                        cursor.style.transition = 'all 0.1s ease';
                        document.body.appendChild(cursor);
                    }
                    cursor.style.left = x + 'px';
                    cursor.style.top = y + 'px';
                    
                    if (click) {
                        const ripple = document.createElement('div');
                        ripple.style.position = 'fixed';
                        ripple.style.left = x + 'px';
                        ripple.style.top = y + 'px';
                        ripple.style.width = '20px';
                        ripple.style.height = '20px';
                        ripple.style.borderRadius = '50%';
                        ripple.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
                        ripple.style.transform = 'translate(-50%, -50%) scale(1)';
                        ripple.style.transition = 'transform 0.5s, opacity 0.5s';
                        ripple.style.zIndex = '2147483646';
                        ripple.style.pointerEvents = 'none';
                        document.body.appendChild(ripple);
                        requestAnimationFrame(() => {
                            ripple.style.transform = 'translate(-50%, -50%) scale(3)';
                            ripple.style.opacity = '0';
                        });
                        setTimeout(() => ripple.remove(), 500);
                    }
                }
            """, {'x': x, 'y': y, 'click': click})
        except Exception as e:
            logger.warning(f"Failed to update visual cursor: {e}")

    def _get_element_center(self, selector: str) -> Optional[tuple[int, int]]:
        """Get center coordinates of an element."""
        try:
            element = self.page.locator(selector).first
            box = element.bounding_box()
            if box:
                return int(box['x'] + box['width'] / 2), int(box['y'] + box['height'] / 2)
        except Exception:
            pass
        return None

    def _execute_click(self, action: Dict[str, Any]):
        """Execute a click action."""
        # Click actions can have coordinates (x, y) or selector
        x = action.get('x')
        y = action.get('y')
        selector = action.get('selector')
        button = str(action.get('button', 'left')).lower().strip()
        # OpenAI computer_use_preview uses: left|right|wheel|back|forward
        # Playwright expects: left|right|middle
        if button == "wheel":
            button = "middle"
        if button not in ("left", "right", "middle"):
            button = "left"
        click_count = action.get('click_count', 1)
        modifiers = action.get('modifiers', [])
        
        target_x, target_y = None, None

        if x is not None and y is not None:
            # Click at coordinates
            target_x, target_y = x, y
            self.page.mouse.click(
                x, 
                y, 
                button=button, 
                click_count=click_count,
                modifiers=modifiers
            )
            logger.debug(f"Clicked at coordinates ({x}, {y}) with button={button}, count={click_count}")
        elif selector:
            # Click element by selector
            center = self._get_element_center(selector)
            if center:
                target_x, target_y = center
                
            element = self.page.locator(selector).first
            element.click(
                button=button, 
                click_count=click_count, 
                modifiers=modifiers,
                timeout=5000
            )
            logger.debug(f"Clicked element: {selector} with button={button}, count={click_count}")
        else:
            raise ValueError("Click action requires either (x, y) coordinates or selector")
            
        if target_x is not None and target_y is not None:
            self._update_cursor_visuals(target_x, target_y, click=True)

    def _execute_hover(self, action: Dict[str, Any]):
        """Execute a hover action."""
        x = action.get('x')
        y = action.get('y')
        selector = action.get('selector')
        
        target_x, target_y = None, None

        if x is not None and y is not None:
            target_x, target_y = x, y
            self.page.mouse.move(x, y)
            logger.debug(f"Hovered at coordinates ({x}, {y})")
        elif selector:
            center = self._get_element_center(selector)
            if center:
                target_x, target_y = center

            element = self.page.locator(selector).first
            element.hover(timeout=5000)
            logger.debug(f"Hovered element: {selector}")
        else:
            raise ValueError("Hover action requires either (x, y) coordinates or selector")
            
        if target_x is not None and target_y is not None:
            self._update_cursor_visuals(target_x, target_y)

    def _execute_drag_and_drop(self, action: Dict[str, Any]):
        """Execute a drag and drop action."""
        # OpenAI computer_use_preview emits `drag` with a `path` array of points.
        path = action.get("path")
        if isinstance(path, list) and len(path) >= 2:
            points = []
            for p in path:
                if isinstance(p, dict) and "x" in p and "y" in p:
                    points.append((p.get("x"), p.get("y")))
            points = [(x, y) for (x, y) in points if x is not None and y is not None]

            if len(points) >= 2:
                start_x, start_y = points[0]
                final_x, final_y = points[-1]

                self.page.mouse.move(start_x, start_y)
                self._update_cursor_visuals(start_x, start_y)
                self.page.mouse.down()
                for (x, y) in points[1:]:
                    self.page.mouse.move(x, y)
                self.page.mouse.up()

                logger.debug(f"Dragged along path from ({start_x}, {start_y}) to ({final_x}, {final_y})")
                self._update_cursor_visuals(final_x, final_y)
                return

        source_x = action.get('source_x')
        source_y = action.get('source_y')
        target_x = action.get('target_x')
        target_y = action.get('target_y')
        source_selector = action.get('source_selector')
        target_selector = action.get('target_selector')
        
        final_x, final_y = None, None

        if source_selector and target_selector:
            # For selector based DnD, we try to estimate end position for cursor update
            center = self._get_element_center(target_selector)
            if center:
                final_x, final_y = center
            
            self.page.drag_and_drop(source_selector, target_selector, timeout=5000)
            logger.debug(f"Dragged {source_selector} to {target_selector}")
        elif source_x is not None and source_y is not None and target_x is not None and target_y is not None:
            final_x, final_y = target_x, target_y
            
            # Move to start
            self.page.mouse.move(source_x, source_y)
            self._update_cursor_visuals(source_x, source_y)
            
            self.page.mouse.down()
            
            # Move to end
            self.page.mouse.move(target_x, target_y)
            self.page.mouse.up()
            logger.debug(f"Dragged from ({source_x}, {source_y}) to ({target_x}, {target_y})")
        else:
            raise ValueError("Drag and drop requires either both selectors or all 4 coordinates")
            
        if final_x is not None and final_y is not None:
            self._update_cursor_visuals(final_x, final_y)

    
    def _execute_double_click(self, action: Dict[str, Any]):
        """Execute a double click action."""
        # Reuse click implementation with count=2
        action['click_count'] = 2
        self._execute_click(action)

    def _execute_type(self, action: Dict[str, Any]):
        """Execute a type action."""
        text = action.get('text', '')
        selector = action.get('selector')
        
        if not text:
            raise ValueError("Type action requires 'text' parameter")
        
        if selector:
            # Type into element
            element = self.page.locator(selector).first
            element.fill(text)
            logger.debug(f"Typed '{text}' into {selector}")
        else:
            # Type at current focus
            self.page.keyboard.type(text)
            logger.debug(f"Typed '{text}' at current focus")
    
    def _execute_scroll(self, action: Dict[str, Any]):
        """Execute a scroll action."""
        x = action.get('x', 0)
        y = action.get('y', 0)
        # OpenAI computer_use_preview uses scroll_x/scroll_y; legacy uses delta_x/delta_y.
        scroll_x = action.get('scroll_x', None)
        scroll_y = action.get('scroll_y', None)
        delta_x = action.get('delta_x', 0)
        delta_y = action.get('delta_y', 0)
        
        if scroll_x is not None or scroll_y is not None:
            dx = int(scroll_x or 0)
            dy = int(scroll_y or 0)
            try:
                if x is not None and y is not None:
                    self.page.mouse.move(int(x), int(y))
            except Exception:
                pass
            self.page.mouse.wheel(dx, dy)
            logger.debug(f"Scrolled by wheel ({dx}, {dy}) at ({x}, {y})")
        elif delta_x != 0 or delta_y != 0:
            # Scroll by delta
            self.page.mouse.wheel(delta_x, delta_y)
            logger.debug(f"Scrolled by delta ({delta_x}, {delta_y})")
        elif x != 0 or y != 0:
            # Scroll to position
            self.page.evaluate(f"window.scrollTo({x}, {y})")
            logger.debug(f"Scrolled to position ({x}, {y})")
        else:
            # Default scroll down
            self.page.mouse.wheel(0, 300)
            logger.debug("Scrolled down (default)")
    
    def _execute_keypress(self, action: Dict[str, Any]):
        """Execute a keypress action."""
        keys = action.get('keys')
        key = action.get('key', '')

        # OpenAI computer_use_preview emits `keys: [...]`; legacy flows use `key: "Ctrl+C"`
        if isinstance(keys, list) and len(keys) > 0:
            key = "+".join(str(k) for k in keys)
        if not key:
            raise ValueError("Keypress action requires 'keys' or 'key' parameter")
        
        # Normalize key separator to '+'
        # Handle "Ctrl + C", "Alt, PrintScreen", "Shift Space" etc.
        # Replace comma and space with + if they seem to be separators
        normalized_key = key
        if ',' in normalized_key:
            normalized_key = normalized_key.replace(',', '+')
        if ' ' in normalized_key and '+' not in normalized_key:
            # Only replace space if there are no plusses, to avoid messing up "Ctrl + C" -> "Ctrl+++C"
            normalized_key = normalized_key.replace(' ', '+')
            
        parts = [p.strip() for p in normalized_key.split('+') if p.strip()]
        
        # Map common key names to Playwright key names (case insensitive lookup)
        # See https://playwright.dev/python/docs/api/class-keyboard#keyboard-press
        key_mapping = {
            'enter': 'Enter',
            'return': 'Enter',
            'tab': 'Tab',
            'escape': 'Escape',
            'esc': 'Escape',
            'backspace': 'Backspace',
            'delete': 'Delete',
            'del': 'Delete',
            'arrowup': 'ArrowUp',
            'up': 'ArrowUp',
            'arrowdown': 'ArrowDown',
            'down': 'ArrowDown',
            'arrowleft': 'ArrowLeft',
            'left': 'ArrowLeft',
            'arrowright': 'ArrowRight',
            'right': 'ArrowRight',
            'home': 'Home',
            'end': 'End',
            'pageup': 'PageUp',
            'pagedown': 'PageDown',
            'printscreen': 'PrintScreen',
            'prtscr': 'PrintScreen',
            'print': 'PrintScreen',
            'insert': 'Insert',
            'f1': 'F1',
            'f2': 'F2',
            'f3': 'F3',
            'f4': 'F4',
            'f5': 'F5',
            'f6': 'F6',
            'f7': 'F7',
            'f8': 'F8',
            'f9': 'F9',
            'f10': 'F10',
            'f11': 'F11',
            'f12': 'F12',
            'shift': 'Shift',
            'control': 'Control',
            'ctrl': 'Control',
            'alt': 'Alt',
            'meta': 'Meta',
            'command': 'Meta',
            'cmd': 'Meta',
            'win': 'Meta',
            'windows': 'Meta',
            'super': 'Meta',
            'space': 'Space',
            'scr': 'PrintScreen',
            'snapshot': 'PrintScreen',
            'prntscr': 'PrintScreen',
            'prntscrn': 'PrintScreen',
            'menu': 'ContextMenu',
            'apps': 'ContextMenu',
            'scroll': 'ScrollLock',
            'scrolllock': 'ScrollLock',
            'num': 'NumLock',
            'numlock': 'NumLock',
            'caps': 'CapsLock',
            'capslock': 'CapsLock',
            'pause': 'Pause',
            'break': 'Pause',
        }
        
        mapped_parts = []
        for part in parts:
            # Try exact match first, then lower case lookup
            mapped_part = key_mapping.get(part.lower(), part)
            
            # If the key is just a single character, it's likely fine as is
            # If it's a longer string not in mapping, try to title case it (e.g. "Enter" -> "Enter")
            if len(mapped_part) > 1 and mapped_part not in key_mapping.values():
                 mapped_part = mapped_part.title()
            
            mapped_parts.append(mapped_part)

        final_key = '+'.join(mapped_parts)
        # Log the mapping for debugging
        if final_key != key:
            logger.info(f"Mapped key '{key}' -> '{final_key}'")
            
        self.page.keyboard.press(final_key)
        logger.debug(f"Pressed key: {key} (mapped to {final_key})")
    
    def _execute_wait(self, action: Dict[str, Any]):
        """Execute a wait action."""
        duration_ms = action.get('duration_ms')
        selector = action.get('selector')
        state = action.get('state')  # 'load', 'domcontentloaded', 'networkidle'
        
        if state:
             self.page.wait_for_load_state(state=state, timeout=duration_ms or 30000)
             logger.debug(f"Waited for load state: {state}")
        elif selector:
            # Wait for element to appear
            self.page.wait_for_selector(selector, timeout=duration_ms or 5000)
            logger.debug(f"Waited for selector: {selector}")
        elif duration_ms:
            # Wait for duration
            time.sleep(duration_ms / 1000.0)
            logger.debug(f"Waited for {duration_ms}ms")
        else:
             # Default wait
             time.sleep(1)
             logger.debug("Waited for default 1s")
    
    def cleanup(self):
        """Clean up browser resources."""
        try:
            if self.page:
                self.page.close()
                self.page = None
            if self.context:
                self.context.close()
                self.context = None
            if self.browser:
                self.browser.close()
                self.browser = None
            if self.playwright:
                self.playwright.stop()
                self.playwright = None
            logger.info("Browser cleanup completed")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}", exc_info=True)
