"""
OpenAI Image Retry Handler Service
Handles retry logic for OpenAI API calls specifically for image download errors.
"""
import logging
import re
import openai
from typing import Dict, Any, Optional
from utils.image_utils import clean_image_url, download_image_and_convert_to_data_url

logger = logging.getLogger(__name__)


class OpenAIImageRetryHandler:
    """Handles retrying OpenAI API calls when image downloads fail."""
    
    def __init__(self, openai_client):
        """
        Initialize the handler.
        
        Args:
            openai_client: The OpenAI client instance (wrapper or raw client)
                           Must have access to client.responses.create
        """
        self.client = openai_client.client if hasattr(openai_client, 'client') else openai_client

    def handle_image_download_error(
        self,
        error: openai.BadRequestError,
        params: Dict[str, Any],
        max_retries: int = 10
    ) -> Any:
        """
        Handle image download errors by downloading images locally and converting to base64.
        
        Args:
            error: The initial BadRequestError
            params: The original API parameters
            max_retries: Maximum number of retry attempts
            
        Returns:
            The successful API response
            
        Raises:
            openai.BadRequestError: If retries fail or if error is not related to image downloads
        """
        error_message = str(error)
        error_body = getattr(error, 'body', {}) or {}
        error_info = error_body.get('error', {}) if isinstance(error_body, dict) else {}
        
        # Check if error is related to image downloading
        is_image_download_error = (
            'Error while downloading' in error_message or 
            'downloading' in error_message.lower() or
            (isinstance(error_info, dict) and error_info.get('code') == 'invalid_value' and error_info.get('param') == 'url')
        )
        
        if not is_image_download_error:
            raise error
            
        # Retry loop: remove invalid URLs and retry until we have only valid URLs
        retry_count = 0
        current_params = params.copy()
        removed_urls = []
        failed_image_url = self._extract_failed_url(error_message, error_info)
        
        while retry_count < max_retries:
            retry_count += 1
            
            # Extract failed URL from error (if available)
            if retry_count == 1:
                current_failed_url = failed_image_url
            else:
                # This is a recursive retry - extract URL from the current error context if we caught one
                # Note: The 'error' variable here refers to the *initial* error or the one caught in the *previous* loop iteration
                # But wait, we need to catch the new error inside the loop.
                # The logic in original code handles this by catching the exception inside the loop.
                # Here we are inside a function called AFTER the first exception.
                pass 

            # We need to restructure this to be a loop that calls the API.
            # But the first call happened outside.
            # So this method assumes we are already in an error state.
            
            # Let's look at how we can structure this.
            # The original code:
            # try: call()
            # except BadRequest as e: if image_error: loop(retry)
            
            # So here we start the loop.
            
            # Get current content
            input_data = current_params.get('input')
            if not isinstance(input_data, list) or len(input_data) == 0:
                break
            
            content = input_data[0].get('content', [])
            if not isinstance(content, list):
                break
            
            # Get all image URLs from content
            image_items = [item for item in content if item.get('type') == 'input_image']
            
            if not image_items:
                break
            
            # If we have a specific failed URL, try to handle it
            if current_failed_url:
                response = self._handle_specific_url_failure(
                    current_params, content, current_failed_url, retry_count, image_items
                )
                if response: 
                    return response
                
                # If _handle_specific_url_failure returns None, it means it updated current_params 
                # and we should try calling the API again. 
                # Wait, I should make _handle_specific_url_failure return (success, response, updated_params)
                # Or just do the work inline or helper methods that mutate or return updated structure.
                
                # Let's simplify. I'll put the API call inside the loop.
            else:
                # No specific failed URL - try converting all remaining images to base64
                self._convert_all_remaining_images(current_params, content, retry_count, image_items, removed_urls)
            
            # Try calling API with updated params
            try:
                return self.client.responses.create(**current_params)
            except openai.BadRequestError as retry_error:
                # Check if it's another URL error
                retry_error_message = str(retry_error)
                retry_error_body = getattr(retry_error, 'body', {}) or {}
                retry_error_info = retry_error_body.get('error', {}) if isinstance(retry_error_body, dict) else {}
                
                is_retry_url_error = (
                    'Error while downloading' in retry_error_message or
                    (isinstance(retry_error_info, dict) and retry_error_info.get('code') == 'invalid_value' and retry_error_info.get('param') == 'url')
                )
                
                if is_retry_url_error:
                    # Another URL error - continue loop
                    current_failed_url = self._extract_failed_url(retry_error_message, retry_error_info)
                    continue
                else:
                    # Different error - raise it
                    raise retry_error
        
        # If we exhausted retries or couldn't fix the issue
        if retry_count >= max_retries:
            logger.error("[OpenAI Image Retry] Exceeded maximum retries for URL errors", extra={
                'job_id': params.get('job_id'),
                'retry_count': retry_count,
                'removed_urls': removed_urls
            })
        
        # If we fall through here, it means we failed to recover
        raise error

    def _extract_failed_url(self, error_message: str, error_info: Dict) -> Optional[str]:
        """Extract the failed image URL from error message."""
        failed_image_url = None
        if 'Error while downloading' in error_message:
            # Strategy 1: Look for URL pattern after "downloading "
            download_match = re.search(r'downloading\s+(https?://[^\s<>"{}|\\^`\[\]]+)', error_message, re.IGNORECASE)
            if download_match:
                raw_url = download_match.group(1)
                failed_image_url = clean_image_url(raw_url)
            
            # Strategy 2: Match URLs that might end with punctuation
            if not failed_image_url:
                url_match = re.search(r'https?://[^\s<>"{}|\\^`\[\]]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp|ico)(?:\?[^\s<>"{}|\\^`\[\]]*)?[^\s<>"{}|\\^`\[\]]*', error_message, re.IGNORECASE)
                if url_match:
                    raw_url = url_match.group(0)
                    failed_image_url = clean_image_url(raw_url)
            
            # Strategy 3: Try to get URL from error info dict
            if not failed_image_url and isinstance(error_info, dict):
                failed_image_url = error_info.get('url') or error_info.get('param')
                if failed_image_url:
                    failed_image_url = clean_image_url(failed_image_url)
                    
        return failed_image_url

    def _handle_specific_url_failure(
        self, 
        current_params: Dict, 
        content: List[Dict], 
        current_failed_url: str, 
        retry_count: int, 
        image_items: List[Dict]
    ) -> None:
        """
        Handle failure for a specific URL: try to convert to base64, else remove.
        Updates current_params in place.
        """
        job_id = current_params.get('job_id')
        tenant_id = current_params.get('tenant_id')
        
        logger.warning("[OpenAI Image Retry] Image download failed, attempting to fix", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'failed_image_url': current_failed_url,
            'retry_attempt': retry_count,
            'total_images': len(image_items)
        })
        
        # Try to download and convert the failed image to base64
        data_url = download_image_and_convert_to_data_url(
            url=current_failed_url,
            job_id=job_id,
            tenant_id=tenant_id
        )
        
        if data_url:
            # Replace the failed URL with base64 data URL
            retry_content = []
            replaced = False
            for item in content:
                if item.get('type') == 'input_image':
                    image_url = str(item.get('image_url', ''))
                    # Check if this is the failed URL (exact match or contains it)
                    if current_failed_url in image_url or image_url in current_failed_url:
                        retry_content.append({
                            "type": "input_image",
                            "image_url": data_url
                        })
                        replaced = True
                        logger.info("[OpenAI Image Retry] Replaced failed image URL with base64 data URL", extra={
                            'job_id': job_id,
                            'original_url_preview': current_failed_url[:100] + '...' if len(current_failed_url) > 100 else current_failed_url
                        })
                    else:
                        retry_content.append(item)
                else:
                    retry_content.append(item)
            
            if replaced:
                current_params['input'] = [{
                    "role": "user",
                    "content": retry_content
                }]
                return # Successfully updated params
        
        # Download/conversion failed - remove the problematic image
        logger.warning("[OpenAI Image Retry] Failed to download/convert image, removing it", extra={
            'job_id': job_id,
            'failed_image_url': current_failed_url,
            'retry_attempt': retry_count
        })
        
        # Remove the failed image
        filtered_content = [
            item for item in content
            if not (item.get('type') == 'input_image' and 
                   (current_failed_url in str(item.get('image_url', '')) or 
                    str(item.get('image_url', '')) in current_failed_url))
        ]
        
        current_params['input'] = [{
            "role": "user",
            "content": filtered_content
        }]

    def _convert_all_remaining_images(
        self,
        current_params: Dict,
        content: List[Dict],
        retry_count: int,
        image_items: List[Dict],
        removed_urls: List[str]
    ) -> None:
        """
        Convert all remaining images to base64 as a fallback.
        Updates current_params in place.
        """
        job_id = current_params.get('job_id')
        tenant_id = current_params.get('tenant_id')
        
        logger.warning("[OpenAI Image Retry] Image download error but couldn't extract specific URL, attempting to convert all images to base64", extra={
            'job_id': job_id,
            'retry_attempt': retry_count,
            'total_images': len(image_items)
        })
        
        retry_content = []
        for item in content:
            if item.get('type') == 'input_image':
                image_url = item.get('image_url', '')
                # Skip if already a data URL
                if isinstance(image_url, str) and image_url.startswith('data:'):
                    retry_content.append(item)
                    continue
                
                # Try to convert to base64
                data_url = download_image_and_convert_to_data_url(
                    url=image_url,
                    job_id=job_id,
                    tenant_id=tenant_id
                )
                if data_url:
                    retry_content.append({
                        "type": "input_image",
                        "image_url": data_url
                    })
                else:
                    # Conversion failed - remove this image
                    removed_urls.append(image_url)
                    logger.warning("[OpenAI Image Retry] Failed to convert image URL, removing it", extra={
                        'job_id': job_id,
                        'image_url_preview': image_url[:100] + '...' if len(image_url) > 100 else image_url
                    })
            else:
                retry_content.append(item)
        
        current_params['input'] = [{
            "role": "user",
            "content": retry_content
        }]

