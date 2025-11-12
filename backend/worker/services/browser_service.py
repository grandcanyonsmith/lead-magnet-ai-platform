"""Browser automation service using Playwright."""
import logging
import base64
from typing import Optional
from playwright.sync_api import sync_playwright, Browser, Page, BrowserContext
from utils.decimal_utils import convert_decimals_to_float

logger = logging.getLogger(__name__)


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
            self.browser = self.playwright.chromium.launch(
                headless=True,
                args=['--disable-gpu', '--no-sandbox']
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
        
        try:
            self.page.goto(url, timeout=timeout, wait_until="domcontentloaded")
            logger.info(f"Navigated to {url}")
        except Exception as e:
            logger.error(f"Failed to navigate to {url}: {e}", exc_info=True)
            raise
    
    def capture_screenshot(self) -> str:
        """
        Capture screenshot of current page.
        
        Returns:
            Base64 encoded PNG screenshot
        """
        if not self.page:
            raise RuntimeError("Browser not initialized. Call initialize() first.")
        
        try:
            screenshot_bytes = self.page.screenshot()
            screenshot_b64 = base64.b64encode(screenshot_bytes).decode("utf-8")
            logger.info(f"Screenshot captured ({len(screenshot_b64)} chars)")
            return screenshot_b64
        except Exception as e:
            logger.error(f"Failed to capture screenshot: {e}", exc_info=True)
            raise
    
    def get_current_url(self) -> str:
        """Get the current page URL."""
        if not self.page:
            raise RuntimeError("Browser not initialized. Call initialize() first.")
        return self.page.url
    
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
