"""Browser automation service using Playwright."""
import logging
import base64
import time
from typing import Optional, Dict, Any
from playwright.sync_api import sync_playwright, Browser, Page, BrowserContext  # type: ignore
from utils.decimal_utils import convert_decimals_to_float

from .browser_config import (
    should_disable_sandbox,
    should_use_single_process
)
from .browser_action_handler import BrowserActionHandler

logger = logging.getLogger(__name__)


class BrowserService:
    """Service for browser automation using Playwright."""
    
    def __init__(self):
        """Initialize browser service."""
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.action_handler: Optional[BrowserActionHandler] = None
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
            if should_disable_sandbox():
                launch_args += ['--no-sandbox', '--disable-setuid-sandbox']
            if should_use_single_process():
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
            self.action_handler = BrowserActionHandler(self.page)
            
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
        """
        if not self.action_handler:
            raise RuntimeError("Browser not initialized. Call initialize() first.")
        
        self.action_handler.execute_action(action)
    
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
            self.action_handler = None
            logger.info("Browser cleanup completed")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}", exc_info=True)
