"""Browser automation service using Playwright."""
import logging
import base64
from typing import Optional, Dict, Any
from playwright.sync_api import sync_playwright, Browser, Page, BrowserContext  # type: ignore
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
                args=[
                    '--disable-gpu',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-web-security',
                    '--single-process'  # Important for Lambda environment
                ]
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
            raise RuntimeError("Page has been closed. Browser may have crashed.")
        
        if self.browser and not self.browser.is_connected():
            raise RuntimeError("Browser has been disconnected.")
        
        try:
            screenshot_bytes = self.page.screenshot()
            screenshot_b64 = base64.b64encode(screenshot_bytes).decode("utf-8")
            logger.info(f"Screenshot captured ({len(screenshot_b64)} chars)")
            return screenshot_b64
        except Exception as e:
            logger.error(f"Failed to capture screenshot: {e}", exc_info=True)
            # Check if browser crashed
            if self.page.is_closed() or (self.browser and not self.browser.is_connected()):
                raise RuntimeError(f"Browser crashed during screenshot: {e}")
            raise
    
    def get_current_url(self) -> str:
        """Get the current page URL."""
        if not self.page:
            raise RuntimeError("Browser not initialized. Call initialize() first.")
        return self.page.url
    
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
        
        action_type = action.get('type', '').lower()
        
        try:
            if action_type == 'click':
                self._execute_click(action)
            elif action_type == 'type':
                self._execute_type(action)
            elif action_type == 'scroll':
                self._execute_scroll(action)
            elif action_type == 'keypress':
                self._execute_keypress(action)
            elif action_type == 'wait':
                self._execute_wait(action)
            else:
                logger.warning(f"Unknown action type: {action_type}")
                raise ValueError(f"Unsupported action type: {action_type}")
            
            logger.info(f"Executed action: {action_type}")
            
        except Exception as e:
            logger.error(f"Failed to execute action {action_type}: {e}", exc_info=True)
            raise
    
    def _execute_click(self, action: Dict[str, Any]):
        """Execute a click action."""
        # Click actions can have coordinates (x, y) or selector
        x = action.get('x')
        y = action.get('y')
        selector = action.get('selector')
        
        if x is not None and y is not None:
            # Click at coordinates
            self.page.mouse.click(x, y)
            logger.debug(f"Clicked at coordinates ({x}, {y})")
        elif selector:
            # Click element by selector
            element = self.page.locator(selector).first
            element.click(timeout=5000)
            logger.debug(f"Clicked element: {selector}")
        else:
            raise ValueError("Click action requires either (x, y) coordinates or selector")
    
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
        delta_x = action.get('delta_x', 0)
        delta_y = action.get('delta_y', 0)
        
        if delta_x != 0 or delta_y != 0:
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
        key = action.get('key', '')
        
        if not key:
            raise ValueError("Keypress action requires 'key' parameter")
        
        # Map common key names to Playwright key names
        key_mapping = {
            'Enter': 'Enter',
            'Tab': 'Tab',
            'Escape': 'Escape',
            'Backspace': 'Backspace',
            'Delete': 'Delete',
            'ArrowUp': 'ArrowUp',
            'ArrowDown': 'ArrowDown',
            'ArrowLeft': 'ArrowLeft',
            'ArrowRight': 'ArrowRight',
            'Home': 'Home',
            'End': 'End',
            'PageUp': 'PageUp',
            'PageDown': 'PageDown',
        }
        
        playwright_key = key_mapping.get(key, key)
        self.page.keyboard.press(playwright_key)
        logger.debug(f"Pressed key: {key}")
    
    def _execute_wait(self, action: Dict[str, Any]):
        """Execute a wait action."""
        duration_ms = action.get('duration_ms', 1000)
        selector = action.get('selector')
        
        if selector:
            # Wait for element to appear
            self.page.wait_for_selector(selector, timeout=duration_ms)
            logger.debug(f"Waited for selector: {selector}")
        else:
            # Wait for duration
            import time
            time.sleep(duration_ms / 1000.0)
            logger.debug(f"Waited for {duration_ms}ms")
    
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
