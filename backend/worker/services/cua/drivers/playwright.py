from typing import Dict, Any, Optional
from services.cua.environment import Environment
from services.browser_service import BrowserService
import logging

logger = logging.getLogger(__name__)

class PlaywrightEnvironment(Environment):
    """Playwright-based environment for CUA."""

    def __init__(self):
        self.browser_service = BrowserService()

    def initialize(self, display_width: int = 1024, display_height: int = 768) -> None:
        self.browser_service.initialize(display_width, display_height)
        # Navigate to blank page to ensure readiness
        try:
            self.browser_service.navigate("about:blank")
        except Exception as e:
            logger.warning(f"Initial navigation failed: {e}")

    def execute_action(self, action: Dict[str, Any]) -> None:
        self.browser_service.execute_action(action)

    def capture_screenshot(self) -> str:
        return self.browser_service.capture_screenshot()

    def get_current_url(self) -> Optional[str]:
        try:
            return self.browser_service.get_current_url()
        except Exception:
            return None

    def cleanup(self) -> None:
        self.browser_service.cleanup()

    def is_healthy(self) -> bool:
        return self.browser_service.browser is not None and self.browser_service.page is not None

