"""OpenAI image URL processing and error recovery service."""
import logging
import re
import openai
from typing import Any, Dict, List, Optional, Tuple, Callable

logger = logging.getLogger(__name__)


class OpenAIImageHandler:
    """Handles image URL processing, validation, and error recovery."""
    
    def validate_image_urls(
        self,
        previous_image_urls: List[str],
        job_id: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> Tuple[List[str], List[Tuple[str, str]]]:
        """
        Validate and filter image URLs.
        
        Args:
            previous_image_urls: List of image URLs to validate
            job_id: Optional job ID for logging
            tenant_id: Optional tenant ID for logging
            
        Returns:
            Tuple of (valid_image_urls, filtered_urls_with_reasons)
        """
        from utils.image_utils import validate_and_filter_image_urls
        
        valid_image_urls, filtered_urls = validate_and_filter_image_urls(
            image_urls=previous_image_urls,
            job_id=job_id,
            tenant_id=tenant_id
        )
        
        # Log filtered URLs for debugging
        if filtered_urls:
            for url, reason in filtered_urls:
                logger.warning("[OpenAI Image Handler] Filtered invalid image URL from previous_image_urls", extra={
                    'job_id': job_id,
                    'tenant_id': tenant_id,
                    'url_preview': url[:100] + '...' if len(url) > 100 else url,
                    'reason': reason,
                    'total_urls': len(previous_image_urls),
                    'valid_urls_count': len(valid_image_urls),
                    'filtered_count': len(filtered_urls)
                })
        
        return valid_image_urls, filtered_urls
    
    @staticmethod
    def _extract_url_from_download_error(error_message: str) -> Optional[str]:
        """
        Extract problematic URL from OpenAI error message.
        
        OpenAI errors for image download timeouts typically look like:
        - "Timeout while downloading https://example.com/image.jpg."
        - "Timeout while downloading https://example.com/image.jpg"
        
        Args:
            error_message: Error message string from OpenAI API
            
        Returns:
            URL string if found, None otherwise
        """
        if not error_message:
            return None
        
        # Pattern to match "Timeout while downloading <url>"
        # Also handles "error while downloading" or similar patterns
        # Allow dots in URLs (they're part of domains and file paths)
        patterns = [
            r'(?:Timeout|timeout|Error|error).*?while downloading\s+(https?://[^\s\)]+)',
            r'(?:downloading|download).*?(https?://[^\s\)]+).*?(?:timeout|time|failed|error)',
            r'(?:invalid_value|invalid).*?url.*?(https?://[^\s\)]+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, error_message, re.IGNORECASE)
            if match:
                url = match.group(1).rstrip('.')
                # Basic URL validation
                if url.startswith('http://') or url.startswith('https://'):
                    return url
        
        return None
    
    def _rebuild_input_with_url_replacement(
        self,
        original_input: List[Dict],
        old_url: str,
        new_url: Optional[str],
        job_id: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> List[Dict]:
        """
        Rebuild input content with a URL replaced or removed.
        
        Args:
            original_input: Original API input format
            old_url: URL to replace/remove
            new_url: New URL to use (None to remove)
            job_id: Optional job ID for logging
            tenant_id: Optional tenant ID for logging
            
        Returns:
            Rebuilt API input format
        """
        if not original_input or len(original_input) == 0:
            return original_input
        
        # Deep copy the input structure
        new_input = []
        for item in original_input:
            if isinstance(item, dict) and item.get('role') == 'user':
                # Rebuild content list
                new_content = []
                content_items = item.get('content', [])
                
                if isinstance(content_items, list):
                    for content_item in content_items:
                        if isinstance(content_item, dict):
                            if content_item.get('type') == 'input_image':
                                image_url = content_item.get('image_url', '')
                                # Check if this is the problematic URL
                                if image_url == old_url or old_url in image_url:
                                    if new_url:
                                        # Replace with new URL
                                        new_content.append({
                                            "type": "input_image",
                                            "image_url": new_url
                                        })
                                        logger.info("[OpenAI Image Handler] Replaced problematic image URL with base64 data URL", extra={
                                            'job_id': job_id,
                                            'tenant_id': tenant_id,
                                            'old_url_preview': old_url[:100] + '...' if len(old_url) > 100 else old_url,
                                            'new_url_type': 'base64_data_url'
                                        })
                                    else:
                                        # Skip this image
                                        logger.info("[OpenAI Image Handler] Removed problematic image URL from input", extra={
                                            'job_id': job_id,
                                            'tenant_id': tenant_id,
                                            'removed_url_preview': old_url[:100] + '...' if len(old_url) > 100 else old_url
                                        })
                                else:
                                    # Keep other images unchanged
                                    new_content.append(content_item)
                            else:
                                # Keep non-image content unchanged
                                new_content.append(content_item)
                        else:
                            new_content.append(content_item)
                else:
                    new_content = content_items
                
                new_input.append({
                    "role": item.get('role', 'user'),
                    "content": new_content
                })
            else:
                # Keep non-user messages unchanged
                new_input.append(item)
        
        return new_input
    
    def _is_image_download_timeout_error(self, error: openai.BadRequestError) -> bool:
        """
        Check if a BadRequestError is an image download timeout error.
        
        Args:
            error: The BadRequestError exception to check
            
        Returns:
            True if the error is an image download timeout, False otherwise
        """
        error_message = str(error)
        error_body = None
        
        # Try to extract error details from response body if available
        if hasattr(error, 'response') and error.response is not None:
            if hasattr(error.response, 'body'):
                error_body = error.response.body
            elif hasattr(error.response, 'json') and callable(error.response.json):
                try:
                    error_body = error.response.json()
                except Exception:
                    pass
        
        # Check for image download timeout errors
        is_download_error = (
            'timeout' in error_message.lower() and 'downloading' in error_message.lower()
        ) or (
            'downloading' in error_message.lower() and ('timeout' in error_message.lower() or 'invalid_value' in error_message.lower())
        ) or (
            error_body and isinstance(error_body, dict) and 
            'error' in error_body and isinstance(error_body['error'], dict) and
            'message' in error_body['error'] and
            ('timeout' in error_body['error']['message'].lower() and 'downloading' in error_body['error']['message'].lower())
        )
        
        return is_download_error
    
    def _handle_image_download_timeout_error(
        self,
        error: openai.BadRequestError,
        params: Dict,
        retry_attempted: bool,
        retry_callback: Callable[[Dict], Any],
        job_id: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> Optional[Any]:
        """
        Handle image download timeout errors by attempting recovery.
        
        Recovery strategy:
        1. Extract problematic URL from error message
        2. Try to download locally and convert to base64
        3. If successful, retry API call with base64 version
        4. If unsuccessful, skip the problematic image and retry without it
        
        Args:
            error: The BadRequestError exception
            params: Current API call parameters
            retry_attempted: Flag indicating if retry was already attempted
            retry_callback: Callback function to retry the API call with new params
            job_id: Optional job ID for logging
            tenant_id: Optional tenant ID for logging
            
        Returns:
            API response if retry succeeds, None if error should be re-raised
        """
        # Don't retry if already attempted (prevent infinite loops)
        if retry_attempted:
            return None
        
        # Extract problematic URL from error message
        error_message = str(error)
        error_body = None
        
        # Try to extract error details from response body if available
        if hasattr(error, 'response') and error.response is not None:
            if hasattr(error.response, 'body'):
                error_body = error.response.body
            elif hasattr(error.response, 'json') and callable(error.response.json):
                try:
                    error_body = error.response.json()
                except Exception:
                    pass
        
        problematic_url = self._extract_url_from_download_error(error_message)
        
        # Also try to extract from error body if available
        if not problematic_url and error_body:
            if isinstance(error_body, dict):
                error_obj = error_body.get('error', {})
                if isinstance(error_obj, dict):
                    error_msg = error_obj.get('message', '')
                    problematic_url = self._extract_url_from_download_error(error_msg)
        
        if not problematic_url:
            # Could not extract URL from error - log and return None to re-raise
            logger.error("[OpenAI Image Handler] Image download error detected but could not extract URL from error message", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'error_message': error_message[:500],
                'error_body': str(error_body)[:500] if error_body else None
            })
            return None
        
        logger.warning("[OpenAI Image Handler] Image download timeout detected, attempting to handle", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'problematic_url_preview': problematic_url[:100] + '...' if len(problematic_url) > 100 else problematic_url,
            'error_message': error_message[:200]
        })
        
        # Try to download locally and convert to base64
        from utils.image_utils import download_image_and_convert_to_data_url
        
        logger.info("[OpenAI Image Handler] Attempting to download problematic image locally and convert to base64", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'url_preview': problematic_url[:100] + '...' if len(problematic_url) > 100 else problematic_url
        })
        
        data_url = download_image_and_convert_to_data_url(
            url=problematic_url,
            job_id=job_id,
            tenant_id=tenant_id
        )
        
        if data_url:
            # Successfully downloaded and converted to base64 - retry with base64 version
            logger.info("[OpenAI Image Handler] Successfully converted problematic URL to base64, retrying API call", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'url_preview': problematic_url[:100] + '...' if len(problematic_url) > 100 else problematic_url,
                'data_url_length': len(data_url)
            })
            
            # Rebuild input with base64 URL
            original_input = params.get('input', [])
            new_input = self._rebuild_input_with_url_replacement(
                original_input=original_input,
                old_url=problematic_url,
                new_url=data_url,
                job_id=job_id,
                tenant_id=tenant_id
            )
            
            # Retry with updated params
            new_params = params.copy()
            new_params['input'] = new_input
            new_params['_retry_attempted'] = True
            
            return retry_callback(new_params)
        else:
            # Failed to download locally - skip this image and retry without it
            logger.warning("[OpenAI Image Handler] Failed to download problematic image locally, skipping image and retrying", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'url_preview': problematic_url[:100] + '...' if len(problematic_url) > 100 else problematic_url,
                'reason': 'Local download failed or timeout'
            })
            
            # Rebuild input without the problematic URL
            original_input = params.get('input', [])
            new_input = self._rebuild_input_with_url_replacement(
                original_input=original_input,
                old_url=problematic_url,
                new_url=None,  # None means remove
                job_id=job_id,
                tenant_id=tenant_id
            )
            
            # Retry with updated params (without problematic image)
            new_params = params.copy()
            new_params['input'] = new_input
            new_params['_retry_attempted'] = True
            
            logger.info("[OpenAI Image Handler] Retrying API call without problematic image", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'skipped_url_preview': problematic_url[:100] + '...' if len(problematic_url) > 100 else problematic_url
            })
            
            return retry_callback(new_params)
    
    def build_input_with_images(
        self,
        input_text: str,
        previous_image_urls: List[str],
        job_id: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> List[Dict]:
        """
        Build input content with text and images.
        
        For problematic URLs (like Firebase Storage URLs), downloads the image
        locally and converts it to a base64 data URL before passing to OpenAI API.
        
        Args:
            input_text: Text input
            previous_image_urls: List of image URLs to include
            job_id: Optional job ID for logging
            tenant_id: Optional tenant ID for logging
            
        Returns:
            API input format with role and content
        """
        from utils.image_utils import is_problematic_url, download_image_and_convert_to_data_url
        
        # Validate image URLs first
        valid_image_urls, filtered_urls = self.validate_image_urls(
            previous_image_urls=previous_image_urls,
            job_id=job_id,
            tenant_id=tenant_id
        )
        
        # Build input as list of content items
        input_content = [
            {"type": "input_text", "text": input_text}
        ]
        
        converted_count = 0
        skipped_count = 0
        
        # Add each valid previous image URL as input_image
        for image_url in valid_image_urls:
            final_image_url = image_url
            should_skip = False
            
            # Check if this URL is problematic (e.g., Firebase Storage)
            if is_problematic_url(image_url):
                logger.info("[OpenAI Image Handler] Detected problematic URL, downloading and converting to base64", extra={
                    'job_id': job_id,
                    'tenant_id': tenant_id,
                    'url_preview': image_url[:100] + '...' if len(image_url) > 100 else image_url
                })
                
                # Download and convert to base64 data URL
                data_url = download_image_and_convert_to_data_url(
                    url=image_url,
                    job_id=job_id,
                    tenant_id=tenant_id
                )
                
                if data_url:
                    final_image_url = data_url
                    converted_count += 1
                    logger.info("[OpenAI Image Handler] Successfully converted problematic URL to data URL", extra={
                        'job_id': job_id,
                        'tenant_id': tenant_id,
                        'url_preview': image_url[:100] + '...' if len(image_url) > 100 else image_url,
                        'data_url_length': len(data_url)
                    })
                else:
                    # Validation failed - skip this image entirely instead of using original URL
                    # This prevents sending invalid image data to OpenAI API
                    skipped_count += 1
                    should_skip = True
                    logger.warning("[OpenAI Image Handler] Failed to download/convert problematic URL, skipping image", extra={
                        'job_id': job_id,
                        'tenant_id': tenant_id,
                        'url_preview': image_url[:100] + '...' if len(image_url) > 100 else image_url,
                        'reason': 'Image validation failed or download failed'
                    })
            
            # Only add image to input if it wasn't skipped
            if not should_skip:
                input_content.append({
                    "type": "input_image",
                    "image_url": final_image_url
                })
        
        # OpenAI Responses API expects input as a list with role and content
        api_input = [
            {
                "role": "user",
                "content": input_content
            }
        ]
        
        logger.info("[OpenAI Image Handler] Building API params with previous image URLs", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'valid_image_urls_count': len(valid_image_urls),
            'input_content_items': len(input_content),
            'converted_to_data_url_count': converted_count,
            'skipped_images_count': skipped_count
        })
        
        return api_input

