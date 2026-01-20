import asyncio
import base64
import logging
import os
import shlex
import subprocess
import time
from typing import Dict, Any, Optional, List

from services.cua.environment import Environment

logger = logging.getLogger(__name__)


def _env_flag(value: Optional[str], default: bool = False) -> bool:
    if value is None or str(value).strip() == "":
        return default
    return str(value).strip().lower() in ("1", "true", "yes", "y", "on")


def _coerce_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _shlex_join(parts: List[str]) -> str:
    return " ".join(shlex.quote(str(p)) for p in parts)


def _normalize_action(action: Any) -> Dict[str, Any]:
    if isinstance(action, dict):
        return action
    if hasattr(action, "model_dump"):
        try:
            return action.model_dump()
        except Exception:
            pass
    if hasattr(action, "dict"):
        try:
            return action.dict()
        except Exception:
            pass
    return {}


class DockerVMController:
    """Synchronous Docker+VNC controller for CUA (xdotool-based)."""

    def __init__(
        self,
        container_name: Optional[str] = None,
        vnc_display: Optional[str] = None,
    ):
        self.container_name = (
            container_name
            or os.environ.get("CUA_DOCKER_CONTAINER_NAME", "cua-image")
        )
        self.vnc_display = vnc_display or os.environ.get("CUA_DOCKER_VNC_DISPLAY", ":99")
        self.docker_bin = os.environ.get("CUA_DOCKER_BIN", "docker")
        self.auto_start = _env_flag(os.environ.get("CUA_DOCKER_AUTO_START"), default=True)
        self.stop_on_cleanup = _env_flag(
            os.environ.get("CUA_DOCKER_STOP_ON_CLEANUP"), default=False
        )
        self.run_cmd = os.environ.get("CUA_DOCKER_RUN_CMD", "").strip()
        self.screenshot_cmd = os.environ.get(
            "CUA_DOCKER_SCREENSHOT_CMD", "import -window root png:-"
        ).strip()
        self.xdotool_cmd = os.environ.get("CUA_DOCKER_XDOTOOL_CMD", "xdotool").strip()
        self.xdotool_delay_ms = _coerce_int(
            os.environ.get("CUA_DOCKER_XDOTOOL_DELAY_MS", "50"), 50
        )
        self.scroll_step = _coerce_int(
            os.environ.get("CUA_DOCKER_SCROLL_STEP", "120"), 120
        )
        self.ready_timeout = _coerce_int(
            os.environ.get("CUA_DOCKER_READY_TIMEOUT_SECONDS", "20"), 20
        )
        self.window_id = os.environ.get("CUA_DOCKER_WINDOW_ID", "").strip()
        self._is_initialized = False
        self._started_here = False
        self._last_url: Optional[str] = None

    def _run(
        self,
        args: List[str],
        *,
        capture_output: bool = False,
        text: bool = True,
        check: bool = True,
        timeout: Optional[int] = None,
    ):
        return subprocess.run(
            args,
            capture_output=capture_output,
            text=text,
            check=check,
            timeout=timeout,
        )

    def _docker(self, args: List[str], **kwargs):
        return self._run([self.docker_bin] + args, **kwargs)

    def _docker_exec(
        self,
        command: str,
        *,
        capture_output: bool = False,
        text: bool = True,
        check: bool = True,
        timeout: Optional[int] = None,
    ):
        env_args: List[str] = []
        if self.vnc_display:
            env_args += ["-e", f"DISPLAY={self.vnc_display}"]
        cmd = (
            [self.docker_bin, "exec", "-i"]
            + env_args
            + [self.container_name, "sh", "-lc", command]
        )
        return self._run(
            cmd,
            capture_output=capture_output,
            text=text,
            check=check,
            timeout=timeout,
        )

    def _container_exists(self) -> bool:
        result = self._docker(
            ["inspect", self.container_name],
            capture_output=True,
            text=True,
            check=False,
        )
        return result.returncode == 0

    def _container_running(self) -> bool:
        result = self._docker(
            ["inspect", "-f", "{{.State.Running}}", self.container_name],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            return False
        return str(result.stdout or "").strip().lower() == "true"

    def _ensure_docker(self) -> None:
        result = self._docker(["version"], capture_output=True, text=True, check=False)
        if result.returncode != 0:
            raise RuntimeError(
                f"Docker not available: {result.stderr or result.stdout}"
            )

    def _ensure_container(self, display_width: int, display_height: int) -> None:
        if not self._container_exists():
            if self.run_cmd:
                cmd = self.run_cmd.format(
                    container_name=self.container_name,
                    display=self.vnc_display,
                    display_width=display_width,
                    display_height=display_height,
                )
                logger.info(
                    f"[DockerVM] Creating container via CUA_DOCKER_RUN_CMD: {cmd}"
                )
                self._run(
                    ["sh", "-lc", cmd],
                    capture_output=True,
                    text=True,
                    check=True,
                )
                self._started_here = True
            else:
                raise RuntimeError(
                    f"Docker container '{self.container_name}' not found. "
                    "Set CUA_DOCKER_CONTAINER_NAME or provide CUA_DOCKER_RUN_CMD."
                )

        if not self._container_running():
            if not self.auto_start:
                raise RuntimeError(
                    f"Docker container '{self.container_name}' is not running and "
                    "CUA_DOCKER_AUTO_START is false."
                )
            logger.info(f"[DockerVM] Starting container {self.container_name}")
            self._docker(
                ["start", self.container_name],
                capture_output=True,
                text=True,
                check=True,
            )
            self._started_here = True

    def _wait_for_ready(self) -> None:
        deadline = time.time() + self.ready_timeout
        last_error: Optional[str] = None
        while time.time() < deadline:
            try:
                self._docker_exec(
                    self._xdotool_command(["getmouselocation"]),
                    capture_output=True,
                    text=True,
                    check=True,
                )
                return
            except Exception as exc:
                last_error = str(exc)
                time.sleep(0.5)
        raise RuntimeError(
            f"Docker VM not ready after {self.ready_timeout}s. Last error: {last_error}"
        )

    def initialize(self, display_width: int = 1024, display_height: int = 768) -> None:
        self._ensure_docker()
        self._ensure_container(display_width, display_height)
        self._wait_for_ready()
        self._is_initialized = True
        logger.info(
            f"[DockerVM] Initialized container {self.container_name} on display {self.vnc_display}"
        )

    def _xdotool_command(self, args: List[str]) -> str:
        base = [self.xdotool_cmd]
        if self.xdotool_delay_ms > 0:
            base += ["--delay", str(self.xdotool_delay_ms)]
        return _shlex_join(base + args)

    def _maybe_focus_window(self) -> Optional[str]:
        if not self.window_id:
            return None
        return self._xdotool_command(["windowactivate", "--sync", self.window_id])

    def _run_xdotool(self, args: List[str]) -> None:
        parts: List[str] = []
        focus_cmd = self._maybe_focus_window()
        if focus_cmd:
            parts.append(focus_cmd)
        parts.append(self._xdotool_command(args))
        command = " && ".join(parts)
        self._docker_exec(command, capture_output=True, text=True, check=True)

    def _button_to_code(self, button: str) -> int:
        normalized = str(button or "left").lower()
        if normalized in ("left", "primary"):
            return 1
        if normalized in ("middle", "wheel"):
            return 2
        if normalized in ("right", "secondary"):
            return 3
        if normalized in ("back", "backward"):
            return 8
        if normalized in ("forward", "next"):
            return 9
        return 1

    def _normalize_key(self, key: str) -> str:
        mapping = {
            "CTRL": "ctrl",
            "CONTROL": "ctrl",
            "CMD": "super",
            "COMMAND": "super",
            "META": "super",
            "WIN": "super",
            "WINDOWS": "super",
            "ALT": "alt",
            "OPTION": "alt",
            "SHIFT": "shift",
            "ENTER": "Return",
            "RETURN": "Return",
            "ESC": "Escape",
            "ESCAPE": "Escape",
            "BACKSPACE": "BackSpace",
            "DELETE": "Delete",
            "DEL": "Delete",
            "SPACE": "space",
            "TAB": "Tab",
            "UP": "Up",
            "DOWN": "Down",
            "LEFT": "Left",
            "RIGHT": "Right",
            "PAGEUP": "Page_Up",
            "PAGEDOWN": "Page_Down",
            "PGUP": "Page_Up",
            "PGDN": "Page_Down",
            "HOME": "Home",
            "END": "End",
        }
        return mapping.get(key.upper(), key)

    def _normalize_key_combo(self, value: str) -> str:
        parts = [p.strip() for p in value.split("+") if p.strip()]
        if not parts:
            return value
        mapped = [self._normalize_key(p) for p in parts]
        return "+".join(mapped)

    def execute_action(self, action: Dict[str, Any]) -> None:
        if not self._is_initialized:
            raise RuntimeError("Environment not initialized")

        action = _normalize_action(action)
        action_type = str(action.get("type", "")).lower().strip()

        if action_type in ("click", "left_click"):
            x = action.get("x")
            y = action.get("y")
            if x is None or y is None:
                raise ValueError("Click action requires x and y")
            button = self._button_to_code(action.get("button", "left"))
            self._run_xdotool(["mousemove", int(x), int(y), "click", button])

        elif action_type in ("right_click",):
            x = action.get("x")
            y = action.get("y")
            if x is None or y is None:
                raise ValueError("Right click action requires x and y")
            self._run_xdotool(["mousemove", int(x), int(y), "click", 3])

        elif action_type in ("double_click", "doubleclick"):
            x = action.get("x")
            y = action.get("y")
            if x is None or y is None:
                raise ValueError("Double click action requires x and y")
            button = self._button_to_code(action.get("button", "left"))
            self._run_xdotool(
                [
                    "mousemove",
                    int(x),
                    int(y),
                    "click",
                    "--repeat",
                    2,
                    "--delay",
                    50,
                    button,
                ]
            )

        elif action_type in ("move", "hover", "mouse_move"):
            x = action.get("x")
            y = action.get("y")
            if x is None or y is None:
                raise ValueError("Move action requires x and y")
            self._run_xdotool(["mousemove", int(x), int(y)])

        elif action_type in ("drag", "drag_and_drop", "dragdrop"):
            path = action.get("path")
            points: List[List[int]] = []
            if isinstance(path, (list, tuple)) and len(path) >= 2:
                for p in path:
                    if hasattr(p, "model_dump"):
                        try:
                            p = p.model_dump()
                        except Exception:
                            pass
                    if isinstance(p, dict) and "x" in p and "y" in p:
                        points.append([int(p.get("x")), int(p.get("y"))])

            if len(points) >= 2:
                args: List[Any] = ["mousemove", points[0][0], points[0][1], "mousedown", 1]
                for (x, y) in points[1:]:
                    args += ["mousemove", x, y]
                args += ["mouseup", 1]
                self._run_xdotool([str(a) for a in args])
            else:
                source_x = action.get("source_x") or action.get("start_x") or action.get("x")
                source_y = action.get("source_y") or action.get("start_y") or action.get("y")
                target_x = action.get("target_x") or action.get("end_x") or action.get("to_x") or action.get("x2")
                target_y = action.get("target_y") or action.get("end_y") or action.get("to_y") or action.get("y2")
                if source_x is None or source_y is None or target_x is None or target_y is None:
                    raise ValueError(
                        "Drag action requires 'path' (>=2 points) or source/target coordinates"
                    )
                self._run_xdotool(
                    [
                        "mousemove",
                        int(source_x),
                        int(source_y),
                        "mousedown",
                        1,
                        "mousemove",
                        int(target_x),
                        int(target_y),
                        "mouseup",
                        1,
                    ]
                )

        elif action_type in ("type", "input_text", "typing"):
            text = action.get("text", "")
            if text is None:
                raise ValueError("Type action requires 'text'")
            self._run_xdotool(["type", "--clearmodifiers", "--", str(text)])

        elif action_type in ("scroll", "scroll_to"):
            dx = action.get("scroll_x", action.get("delta_x", 0)) or 0
            dy = action.get("scroll_y", action.get("delta_y", 0)) or 0
            if dy:
                button = 5 if dy > 0 else 4
                repeat = max(1, int(abs(dy) / max(self.scroll_step, 1)))
                self._run_xdotool(
                    ["click", "--repeat", repeat, "--delay", 10, button]
                )
            if dx:
                button = 7 if dx > 0 else 6
                repeat = max(1, int(abs(dx) / max(self.scroll_step, 1)))
                self._run_xdotool(
                    ["click", "--repeat", repeat, "--delay", 10, button]
                )

        elif action_type in ("keypress", "key_press"):
            keys = action.get("keys")
            key = action.get("key")
            if isinstance(keys, list) and len(keys) > 0:
                mapped = [self._normalize_key(str(k)) for k in keys]
                combo = "+".join(mapped)
                self._run_xdotool(["key", "--clearmodifiers", combo])
            elif key:
                normalized = self._normalize_key_combo(str(key))
                self._run_xdotool(["key", "--clearmodifiers", normalized])
            else:
                raise ValueError("Keypress action requires 'key' or 'keys'")

        elif action_type == "wait":
            duration_ms = action.get("duration_ms", 500)
            time.sleep(_coerce_int(duration_ms, 500) / 1000.0)

        elif action_type == "navigate":
            url = action.get("url")
            if not url:
                raise ValueError("Navigate action requires 'url'")
            self._last_url = str(url)
            self._run_xdotool(["key", "--clearmodifiers", "ctrl+l"])
            self._run_xdotool(["type", "--clearmodifiers", "--", str(url)])
            self._run_xdotool(["key", "Return"])

        elif action_type in ("screenshot", "capture_screenshot", "cursor_position"):
            # No-op (screenshots captured separately; cursor position not supported)
            return

        else:
            raise ValueError(f"Unsupported action type: '{action_type}'")

    def capture_screenshot(self) -> str:
        if not self._is_initialized:
            raise RuntimeError("Environment not initialized")
        result = self._docker_exec(
            self.screenshot_cmd,
            capture_output=True,
            text=False,
            check=False,
        )
        if result.returncode != 0 or not result.stdout:
            stderr = ""
            try:
                stderr = (result.stderr or b"").decode("utf-8", errors="ignore")
            except Exception:
                stderr = str(result.stderr)
            raise RuntimeError(
                f"Docker screenshot command failed: {stderr or 'no output'}"
            )
        return base64.b64encode(result.stdout).decode("utf-8")

    def get_current_url(self) -> Optional[str]:
        return self._last_url

    def navigate(self, url: str) -> None:
        if url == "about:blank":
            self._last_url = url
            return
        self.execute_action({"type": "navigate", "url": url})

    def cleanup(self) -> None:
        if self.stop_on_cleanup:
            try:
                self._docker(
                    ["stop", self.container_name],
                    capture_output=True,
                    text=True,
                    check=False,
                )
            except Exception as exc:
                logger.warning(f"[DockerVM] Failed to stop container: {exc}")
        self._is_initialized = False

    def is_healthy(self) -> bool:
        if not self._is_initialized:
            return False
        return self._container_running()


class DockerVMEnvironment(Environment):
    """Docker+VNC environment for CUA."""

    def __init__(
        self,
        container_name: Optional[str] = None,
        vnc_display: Optional[str] = None,
    ):
        self.controller = DockerVMController(
            container_name=container_name,
            vnc_display=vnc_display,
        )

    async def initialize(
        self, display_width: int = 1024, display_height: int = 768
    ) -> None:
        await asyncio.to_thread(
            self.controller.initialize, display_width, display_height
        )

    async def execute_action(self, action: Dict[str, Any]) -> None:
        await asyncio.to_thread(self.controller.execute_action, action)

    async def capture_screenshot(self) -> str:
        return await asyncio.to_thread(self.controller.capture_screenshot)

    async def get_current_url(self) -> Optional[str]:
        return await asyncio.to_thread(self.controller.get_current_url)

    async def cleanup(self) -> None:
        await asyncio.to_thread(self.controller.cleanup)

    async def is_healthy(self) -> bool:
        return await asyncio.to_thread(self.controller.is_healthy)

