"""
CUA Tool Executor
Executes browser/computer actions against either a sync BrowserService or an async Environment.
"""

import asyncio
import inspect
from typing import Dict, Any

from core.logger import get_logger

logger = get_logger(__name__)


class ToolExecutor:
    """Executes tools (browser actions, etc.) for the agent."""

    def __init__(self, browser_service: Any):
        self.browser_service = browser_service

    async def execute_async(self, action: Dict[str, Any]) -> Any:
        """
        Execute an action in an async context (recommended if the underlying driver is async).
        """
        action_type = str(action.get("type", "")).strip().lower()
        logger.info("[ToolExecutor] Executing action", extra={
            "action_type": action_type,
            "has_x": "x" in action,
            "has_y": "y" in action,
            "has_url": "url" in action,
        })

        if action_type in ("done", "stop"):
            return {"status": "done"}

        if not hasattr(self.browser_service, "execute_action"):
            raise RuntimeError("browser_service does not implement execute_action(action)")

        result = self.browser_service.execute_action(action)
        if inspect.isawaitable(result):
            await result
            return {"status": "ok"}

        return result if result is not None else {"status": "ok"}

    def execute(self, action: Dict[str, Any]) -> Any:
        """
        Execute an action in a sync context.

        - If the underlying driver is sync, this calls it directly.
        - If the underlying driver is async, this will `asyncio.run(...)` when no loop is running,
          otherwise it raises a clear error so the caller can switch to `await execute_async(...)`.
        """
        action_type = str(action.get("type", "")).strip().lower()

        if action_type in ("done", "stop"):
            return {"status": "done"}

        if not hasattr(self.browser_service, "execute_action"):
            raise RuntimeError("browser_service does not implement execute_action(action)")

        try:
            result = self.browser_service.execute_action(action)
        except Exception as e:
            logger.exception("[ToolExecutor] Action execution failed", extra={
                "action_type": action_type,
                "error_type": type(e).__name__,
            })
            raise

        if inspect.isawaitable(result):
            try:
                asyncio.get_running_loop()
            except RuntimeError:
                return asyncio.run(result)
            raise RuntimeError("ToolExecutor.execute called from an active event loop; use `await execute_async(...)`")

        return result if result is not None else {"status": "ok"}
