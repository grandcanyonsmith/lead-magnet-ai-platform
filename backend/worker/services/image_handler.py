"""Image handling and browser automation for Computer Use."""
import logging
import base64
from typing import Dict, List, Tuple, Optional
from utils.decimal_utils import convert_decimals_to_float

logger = logging.getLogger(__name__)


class ImageHandler:
    """Handles image processing and browser automation."""
    
    def __init__(self, s3_service):
        """Initialize image handler with S3 service."""
        self.s3_service = s3_service
    
    def run_cua_loop(
        self,
        openai_client,
        model: str,
        instructions: str,
        input_text: str,
        tools: List[Dict],
        tool_choice: str,
        params: Dict,
        max_iterations: int = 50,
        max_duration_seconds: int = 300
    ) -> Tuple[str, List[str], Dict]:
        """
        Run Computer Use Automation loop.
        
        This method handles browser automation with screenshot capture.
        It converts any Decimal types to float before passing to Playwright
        to avoid "Object of type Decimal is not JSON serializable" errors.
        
        Args:
            openai_client: OpenAI client instance
            model: Model name
            instructions: System instructions
            input_text: User input
            tools: List of tools
            tool_choice: Tool choice setting
            params: API parameters (may contain Decimal types)
            max_iterations: Maximum iterations
            max_duration_seconds: Maximum duration
            
        Returns:
            Tuple of (final_report, screenshot_urls, usage_info)
        """
        params = convert_decimals_to_float(params)
        
        logger.info("[CUA Loop] Starting computer use automation")
        
        browser = None
        screenshot_urls = []
        
        try:
            from services.browser_service import BrowserService
            
            browser = BrowserService()
            
            display_config = {}
            for tool in tools:
                if isinstance(tool, dict) and tool.get("type") == "computer_use_preview":
                    display_config = {
                        "display_width": tool.get("display_width", 1024),
                        "display_height": tool.get("display_height", 768)
                    }
                    break
            
            # Convert Decimal types to int for display dimensions
            display_width = int(display_config.get("display_width", 1024))
            display_height = int(display_config.get("display_height", 768))
            
            browser.initialize(
                display_width=display_width,
                display_height=display_height,
                storage_state=None
            )
            
            browser.navigate("https://example.com")
            
            screenshot_b64 = browser.capture_screenshot()
            
            screenshot_url = self._upload_screenshot_to_s3(screenshot_b64)
            if screenshot_url:
                screenshot_urls.append(screenshot_url)
            
            response = openai_client.create_chat_completion(**params)
            
            final_report = ""
            if response.choices and len(response.choices) > 0:
                final_report = response.choices[0].message.content or ""
            
            usage_info = {
                "input_tokens": getattr(response.usage, "prompt_tokens", 0) if response.usage else 0,
                "output_tokens": getattr(response.usage, "completion_tokens", 0) if response.usage else 0,
                "total_tokens": getattr(response.usage, "total_tokens", 0) if response.usage else 0,
            }
            
            return final_report, screenshot_urls, usage_info
            
        except Exception as e:
            logger.error(f"Error in CUA loop: {e}", exc_info=True)
            raise
        finally:
            if browser:
                try:
                    browser.cleanup()
                except Exception as cleanup_error:
                    logger.warning(f"Error during browser cleanup: {cleanup_error}")
    
    def upload_base64_image_to_s3(
        self, 
        image_b64: str, 
        content_type: str = 'image/png',
        tenant_id: Optional[str] = None,
        job_id: Optional[str] = None,
        filename: Optional[str] = None
    ) -> Optional[str]:
        """
        Upload base64 image to S3 and return public URL.
        
        Args:
            image_b64: Base64-encoded image data
            content_type: MIME type (e.g., 'image/png', 'image/jpeg')
            tenant_id: Optional tenant ID for S3 path structure
            job_id: Optional job ID for S3 path structure
            filename: Optional filename (will be generated if not provided)
            
        Returns:
            Public URL string or None if upload fails
        """
        try:
            import uuid
            import time
            
            # Generate filename if not provided
            if not filename:
                ext = 'png' if 'png' in content_type else ('jpg' if 'jpeg' in content_type or 'jpg' in content_type else 'png')
                filename = f"image-{int(time.time())}-{str(uuid.uuid4())[:8]}.{ext}"
            
            # Decode base64 to bytes
            image_bytes = base64.b64decode(image_b64)
            
            # Construct S3 key with tenant/job path if provided
            if tenant_id and job_id:
                s3_key = f"{tenant_id}/jobs/{job_id}/{filename}"
            else:
                # Fallback to images/ prefix for backwards compatibility
                s3_key = f"images/{filename}"
            
            # Upload using upload_image which accepts bytes
            s3_url, public_url = self.s3_service.upload_image(
                key=s3_key,
                image_data=image_bytes,
                content_type=content_type,
                public=True
            )
            
            logger.info(f"[ImageHandler] Image uploaded to S3", extra={
                's3_key': s3_key,
                'public_url_preview': public_url[:80] + '...' if len(public_url) > 80 else public_url,
                'tenant_id': tenant_id,
                'job_id': job_id,
                'image_filename': filename
            })
            return public_url
        except Exception as e:
            logger.error(f"[ImageHandler] Failed to upload image to S3: {e}", exc_info=True, extra={
                'tenant_id': tenant_id,
                'job_id': job_id,
                'image_filename': filename
            })
            return None
    
    def _upload_screenshot_to_s3(self, screenshot_b64: str) -> Optional[str]:
        """Upload screenshot to S3 and return URL."""
        return self.upload_base64_image_to_s3(screenshot_b64, 'image/png')
