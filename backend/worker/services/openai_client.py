"""OpenAI API client wrapper."""
import logging
import openai
from typing import Dict, List, Optional, Tuple, Any
import re
import json
import copy
import warnings

# Suppress Pydantic serialization warnings globally
warnings.filterwarnings('ignore', category=UserWarning, module='pydantic')
warnings.filterwarnings('ignore', message='.*PydanticSerializationUnexpectedValue.*')

from services.api_key_manager import APIKeyManager

logger = logging.getLogger(__name__)


class OpenAIClient:
    """Wrapper for OpenAI API calls."""
    
    def __init__(self):
        """Initialize OpenAI client with API key from Secrets Manager."""
        self.openai_api_key = APIKeyManager.get_openai_key()
        self.client = openai.OpenAI(api_key=self.openai_api_key)
    
    @staticmethod
    def build_input_text(context: str, previous_context: str = "") -> str:
        """
        Build input text for API call.
        
        Args:
            context: Current context
            previous_context: Previous step context
            
        Returns:
            Combined input text
        """
        if previous_context:
            return f"{previous_context}\n\n--- Current Step Context ---\n{context}"
        return context
    
    def build_api_params(
        self,
        model: str,
        instructions: str,
        input_text: str,
        tools: Optional[List[Dict]] = None,
        tool_choice: str = "auto",
        has_computer_use: bool = False,
        reasoning_level: Optional[str] = None,
        previous_image_urls: Optional[List[str]] = None,
        job_id: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> Dict:
        """
        Build parameters for OpenAI Responses API call.
        
        Args:
            model: Model name
            instructions: System instructions
            input_text: User input
            tools: List of tools
            tool_choice: Tool choice setting
            has_computer_use: Whether computer_use_preview is in tools
            reasoning_level: Reasoning level (deprecated, kept for compatibility)
            previous_image_urls: Optional list of image URLs from previous steps to include in input
            
        Returns:
            API parameters dictionary for Responses API
        """
        # Check if image_generation tool is present
        has_image_generation = False
        if tools:
            for tool in tools:
                if isinstance(tool, dict) and tool.get('type') == 'image_generation':
                    has_image_generation = True
                    break
        
        # Build input: if image_generation tool is present and we have previous image URLs,
        # use list format with text and images; otherwise use string format (backward compatible)
        if has_image_generation and previous_image_urls and len(previous_image_urls) > 0:
            # Build input as list of content items
            input_content = [
                {"type": "input_text", "text": input_text}
            ]
            
            # Deduplicate image URLs first
            from utils.image_utils import (
                is_problematic_url, 
                download_image_and_convert_to_data_url,
                deduplicate_image_urls
            )
            
            deduplicated_urls = deduplicate_image_urls(previous_image_urls, job_id=job_id, tenant_id=tenant_id)
            
            # Process image URLs - convert problematic ones to base64 upfront
            valid_image_urls = []
            skipped_count = 0
            converted_count = 0
            problematic_urls = []
            direct_urls = []
            
            # Separate problematic URLs from direct URLs
            for image_url in deduplicated_urls:
                if not image_url:  # Skip empty URLs
                    skipped_count += 1
                    continue
                
                # Skip cdn.openai.com URLs (they can be problematic and we can't download them)
                if 'cdn.openai.com' in image_url:
                    skipped_count += 1
                    logger.warning("[OpenAI Client] Skipping potentially problematic image URL: cdn.openai.com", extra={
                        'image_url_preview': image_url[:100] + '...' if len(image_url) > 100 else image_url,
                        'reason': 'cdn.openai.com URLs may fail to download',
                        'job_id': job_id,
                        'tenant_id': tenant_id
                    })
                    continue
                
                # Check if URL is problematic - if so, convert to base64 upfront
                if is_problematic_url(image_url):
                    problematic_urls.append(image_url)
                else:
                    direct_urls.append(image_url)
            
            # Convert problematic URLs concurrently if we have multiple
            if problematic_urls:
                if len(problematic_urls) > 1:
                    # Use concurrent downloads for multiple problematic URLs
                    logger.info("[OpenAI Client] Converting multiple problematic URLs concurrently", extra={
                        'job_id': job_id,
                        'tenant_id': tenant_id,
                        'problematic_urls_count': len(problematic_urls)
                    })
                    # Note: download_images_concurrent returns raw bytes, we need data URLs
                    # So we'll still process them individually but can optimize later
                
                for idx, image_url in enumerate(problematic_urls):
                    logger.info("[OpenAI Client] Converting problematic URL to base64 upfront", extra={
                        'image_url_preview': image_url[:100] + '...' if len(image_url) > 100 else image_url,
                        'job_id': job_id,
                        'tenant_id': tenant_id,
                        'image_index': idx,
                        'total_images': len(problematic_urls)
                    })
                    data_url = download_image_and_convert_to_data_url(
                        url=image_url,
                        job_id=job_id,
                        tenant_id=tenant_id,
                        image_index=idx,
                        total_images=len(problematic_urls)
                    )
                    if data_url:
                        input_content.append({
                            "type": "input_image",
                            "image_url": data_url
                        })
                        valid_image_urls.append(image_url)  # Track original URL
                        converted_count += 1
                    else:
                        skipped_count += 1
                        logger.warning("[OpenAI Client] Failed to convert problematic URL, skipping", extra={
                            'image_url_preview': image_url[:100] + '...' if len(image_url) > 100 else image_url,
                            'job_id': job_id,
                            'tenant_id': tenant_id,
                            'image_index': idx,
                            'total_images': len(problematic_urls)
                        })
            
            # Add direct URLs (non-problematic) as-is
            for image_url in direct_urls:
                if not image_url:  # Skip empty URLs
                    skipped_count += 1
                    continue
                
                # Skip cdn.openai.com URLs (they can be problematic and we can't download them)
                if 'cdn.openai.com' in image_url:
                    skipped_count += 1
                    logger.warning("[OpenAI Client] Skipping potentially problematic image URL: cdn.openai.com", extra={
                        'image_url_preview': image_url[:100] + '...' if len(image_url) > 100 else image_url,
                        'reason': 'cdn.openai.com URLs may fail to download'
                    })
                    continue
                
                # Check if URL is problematic - if so, convert to base64 upfront
                if is_problematic_url(image_url):
                    logger.info("[OpenAI Client] Converting problematic URL to base64 upfront", extra={
                        'image_url_preview': image_url[:100] + '...' if len(image_url) > 100 else image_url,
                        'job_id': job_id,
                        'tenant_id': tenant_id
                    })
                    data_url = download_image_and_convert_to_data_url(
                        url=image_url,
                        job_id=job_id,
                        tenant_id=tenant_id
                    )
                    if data_url:
                        input_content.append({
                            "type": "input_image",
                            "image_url": data_url
                        })
                        valid_image_urls.append(image_url)  # Track original URL
                        converted_count += 1
                    else:
                        skipped_count += 1
                        logger.warning("[OpenAI Client] Failed to convert problematic URL, skipping", extra={
                            'image_url_preview': image_url[:100] + '...' if len(image_url) > 100 else image_url,
                            'job_id': job_id,
                            'tenant_id': tenant_id
                        })
                    continue
                
                # Add the image URL as-is - if OpenAI fails to download, we'll retry with base64
                valid_image_urls.append(image_url)
                input_content.append({
                    "type": "input_image",
                    "image_url": image_url
                })
            
            # Only use list format if we have valid image URLs
            if valid_image_urls:
                # OpenAI Responses API expects input as a list with role and content
                api_input = [
                    {
                        "role": "user",
                        "content": input_content
                    }
                ]
                
                logger.info("[OpenAI Client] Building API params with previous image URLs", extra={
                    'original_image_urls_count': len(previous_image_urls),
                    'deduplicated_urls_count': len(deduplicated_urls),
                    'valid_image_urls_count': len(valid_image_urls),
                    'problematic_urls_count': len(problematic_urls),
                    'direct_urls_count': len(direct_urls),
                    'skipped_count': skipped_count,
                    'converted_to_base64_count': converted_count,
                    'input_content_items': len(input_content),
                    'has_image_generation': has_image_generation
                })
            else:
                # No valid image URLs, fall back to string format
                logger.warning("[OpenAI Client] No valid image URLs after filtering, using text-only input", extra={
                    'original_count': len(previous_image_urls)
                })
                api_input = input_text
        else:
            # Use string format (backward compatible)
            api_input = input_text
            if has_image_generation and previous_image_urls:
                logger.debug("[OpenAI Client] Image generation tool present but no previous image URLs to include")
        
        params = {
            "model": model,
            "instructions": instructions,
            "input": api_input
        }
        
        if tools and len(tools) > 0:
            # Clean tools before sending to OpenAI API
            from services.tool_builder import ToolBuilder
            cleaned_tools = ToolBuilder.clean_tools(tools)
            params["tools"] = cleaned_tools
            if tool_choice != "none":
                params["tool_choice"] = tool_choice
        
        return params
    
    def create_response(self, **params):
        """
        Create a response using OpenAI Responses API.
        Supports code_interpreter and other modern tools natively.
        
        Args:
            **params: Parameters to pass to OpenAI Responses API
            
        Returns:
            OpenAI API response
        """
        try:
            # Log the request parameters for debugging
            job_id = params.get('job_id') if 'job_id' in params else None
            tenant_id = params.get('tenant_id') if 'tenant_id' in params else None
            
            logger.info("[OpenAI Client] Making Responses API call", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'model': params.get('model'),
                'has_tools': 'tools' in params and params.get('tools'),
                'tools_count': len(params.get('tools', [])) if params.get('tools') else 0,
                'tools': params.get('tools', []),
                'tool_choice': params.get('tool_choice', 'auto'),
                'instructions_length': len(params.get('instructions', '')),
                'input_length': len(params.get('input', ''))
            })
            
            # ACTUAL API CALL HAPPENS HERE
            logger.info("[OpenAI Client] ⚡ MAKING OPENAI RESPONSES API CALL NOW ⚡", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'model': params.get('model'),
                'has_tools': 'tools' in params and params.get('tools'),
                'tools': params.get('tools', []),
                'tool_choice': params.get('tool_choice')
            })
            # Flush logs before making the API call to ensure they're captured
            import sys
            sys.stdout.flush()
            sys.stderr.flush()
            
            try:
                response = self.client.responses.create(**params)
            except Exception as api_error:
                # Log and flush immediately on API error
                logger.exception("[OpenAI Client] API call failed", extra={
                    'job_id': job_id,
                    'tenant_id': tenant_id,
                    'error_type': type(api_error).__name__,
                    'error_message': str(api_error)
                })
                sys.stdout.flush()
                sys.stderr.flush()
                raise
            
            # Log response structure immediately after receiving it
            logger.info("[OpenAI Client] ✅ RECEIVED RESPONSES API RESPONSE ✅", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'response_type': type(response).__name__,
                'has_output': hasattr(response, 'output'),
                'has_output_text': hasattr(response, 'output_text'),
                'has_tool_calls': hasattr(response, 'tool_calls'),
                'output_length': len(response.output) if hasattr(response, 'output') and response.output else 0,
                'output_text_length': len(response.output_text) if hasattr(response, 'output_text') else 0,
                'tool_calls_length': len(response.tool_calls) if hasattr(response, 'tool_calls') and response.tool_calls else 0
            })
            
            # Log each output item type for debugging
            if hasattr(response, 'output') and response.output:
                output_item_types = []
                for item in response.output:
                    item_class = type(item).__name__
                    item_type = getattr(item, 'type', None)
                    output_item_types.append({
                        'class': item_class,
                        'type': str(item_type) if item_type else None,
                        'has_result': hasattr(item, 'result')
                    })
                logger.info("[OpenAI Client] Response output items breakdown", extra={
                    'job_id': job_id,
                    'tenant_id': tenant_id,
                    'output_items': output_item_types
                })
            
            return response
        except openai.BadRequestError as e:
            # Check if this is an image download error
            error_message = str(e)
            error_body = getattr(e, 'body', {}) or {}
            error_info = error_body.get('error', {}) if isinstance(error_body, dict) else {}
            
            # Extract the failed image URL from error message
            # Error format: "Error while downloading https://..."
            failed_image_url = None
            if 'Error while downloading' in error_message:
                # Try multiple extraction strategies
                # Strategy 1: Look for URL pattern after "downloading " (most reliable)
                download_match = re.search(r'downloading\s+(https?://[^\s<>"{}|\\^`\[\]]+)', error_message, re.IGNORECASE)
                if download_match:
                    raw_url = download_match.group(1)
                    # Clean trailing punctuation from the extracted URL
                    from utils.image_utils import clean_image_url
                    failed_image_url = clean_image_url(raw_url)
                
                # Strategy 2: Match URLs that might end with punctuation
                if not failed_image_url:
                    url_match = re.search(r'https?://[^\s<>"{}|\\^`\[\]]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp|ico)(?:\?[^\s<>"{}|\\^`\[\]]*)?[^\s<>"{}|\\^`\[\]]*', error_message, re.IGNORECASE)
                    if url_match:
                        raw_url = url_match.group(0)
                        from utils.image_utils import clean_image_url
                        failed_image_url = clean_image_url(raw_url)
                
                # Strategy 3: Try to get URL from error info dict
                if not failed_image_url and isinstance(error_info, dict):
                    failed_image_url = error_info.get('url') or error_info.get('param')
                    if failed_image_url:
                        from utils.image_utils import clean_image_url
                        failed_image_url = clean_image_url(failed_image_url)
            
            # Check if error is related to image downloading
            # OpenAI returns errors like: "Error while downloading https://..."
            is_image_download_error = (
                'Error while downloading' in error_message or 
                'downloading' in error_message.lower() or
                (isinstance(error_info, dict) and error_info.get('code') == 'invalid_value' and error_info.get('param') == 'url')
            )
            
            if is_image_download_error:
                # Import here to avoid circular imports
                from utils.image_utils import download_image_and_convert_to_data_url
                
                # Retry loop: remove invalid URLs and retry until we have only valid URLs
                # Maximum retries to prevent infinite loops
                max_retries = 10
                retry_count = 0
                current_params = params.copy()
                removed_urls = []
                
                while retry_count < max_retries:
                    retry_count += 1
                    
                    # Extract failed URL from error (if available)
                    if retry_count == 1:
                        current_failed_url = failed_image_url
                    else:
                        # This is a recursive retry - extract URL from the current error
                        current_failed_url = None
                        current_error_message = str(e)
                        if 'Error while downloading' in current_error_message:
                            download_match = re.search(r'downloading\s+(https?://[^\s<>"{}|\\^`\[\]]+)', current_error_message, re.IGNORECASE)
                            if download_match:
                                raw_url = download_match.group(1)
                                from utils.image_utils import clean_image_url
                                current_failed_url = clean_image_url(raw_url)
                            else:
                                # Try alternative extraction
                                url_match = re.search(r'https?://[^\s<>"{}|\\^`\[\]]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp|ico)(?:\?[^\s<>"{}|\\^`\[\]]*)?[^\s<>"{}|\\^`\[\]]*', current_error_message, re.IGNORECASE)
                                if url_match:
                                    raw_url = url_match.group(0)
                                    from utils.image_utils import clean_image_url
                                    current_failed_url = clean_image_url(raw_url)
                    
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
                        # No more images to process
                        break
                    
                    # If we have a specific failed URL, try to handle it
                    if current_failed_url:
                        logger.warning("[OpenAI Client] Image download failed, attempting to fix", extra={
                            'job_id': params.get('job_id') if 'job_id' in params else None,
                            'tenant_id': params.get('tenant_id') if 'tenant_id' in params else None,
                            'failed_image_url': current_failed_url,
                            'retry_attempt': retry_count,
                            'total_images': len(image_items)
                        })
                        
                        # Try to download and convert the failed image to base64
                        data_url = download_image_and_convert_to_data_url(
                            url=current_failed_url,
                            job_id=params.get('job_id') if 'job_id' in params else None,
                            tenant_id=params.get('tenant_id') if 'tenant_id' in params else None
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
                                        logger.info("[OpenAI Client] Replaced failed image URL with base64 data URL", extra={
                                            'job_id': params.get('job_id') if 'job_id' in params else None,
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
                                        e = retry_error
                                        failed_image_url = None  # Will be extracted in next iteration
                                        continue
                                    else:
                                        # Different error - raise it
                                        raise
                        else:
                            # Download/conversion failed - remove the problematic image
                            removed_urls.append(current_failed_url)
                            logger.warning("[OpenAI Client] Failed to download/convert image, removing it", extra={
                                'job_id': params.get('job_id') if 'job_id' in params else None,
                                'failed_image_url': current_failed_url,
                                'retry_attempt': retry_count,
                                'removed_urls_count': len(removed_urls)
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
                            
                            # If no images left, break
                            remaining_images = [x for x in filtered_content if x.get('type') == 'input_image']
                            if not remaining_images:
                                logger.warning("[OpenAI Client] All images removed due to errors", extra={
                                    'job_id': params.get('job_id') if 'job_id' in params else None,
                                    'removed_urls': removed_urls
                                })
                                break
                            
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
                                    e = retry_error
                                    failed_image_url = None  # Will be extracted in next iteration
                                    continue
                                else:
                                    # Different error - raise it
                                    raise
                    else:
                        # No specific failed URL - try converting all remaining images to base64
                        logger.warning("[OpenAI Client] Image download error but couldn't extract specific URL, attempting to convert all images to base64", extra={
                            'job_id': params.get('job_id') if 'job_id' in params else None,
                            'retry_attempt': retry_count,
                            'total_images': len(image_items)
                        })
                        
                        retry_content = []
                        converted_any = False
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
                                    job_id=params.get('job_id') if 'job_id' in params else None,
                                    tenant_id=params.get('tenant_id') if 'tenant_id' in params else None
                                )
                                if data_url:
                                    retry_content.append({
                                        "type": "input_image",
                                        "image_url": data_url
                                    })
                                    converted_any = True
                                else:
                                    # Conversion failed - remove this image
                                    removed_urls.append(image_url)
                                    logger.warning("[OpenAI Client] Failed to convert image URL, removing it", extra={
                                        'job_id': params.get('job_id') if 'job_id' in params else None,
                                        'image_url_preview': image_url[:100] + '...' if len(image_url) > 100 else image_url
                                    })
                            else:
                                retry_content.append(item)
                        
                        if converted_any or removed_urls:
                            current_params['input'] = [{
                                "role": "user",
                                "content": retry_content
                            }]
                            
                            remaining_images = [x for x in retry_content if x.get('type') == 'input_image']
                            if not remaining_images:
                                logger.warning("[OpenAI Client] All images removed due to conversion failures", extra={
                                    'job_id': params.get('job_id') if 'job_id' in params else None,
                                    'removed_urls': removed_urls
                                })
                                break
                            
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
                                    e = retry_error
                                    failed_image_url = None  # Will be extracted in next iteration
                                    continue
                                else:
                                    # Different error - raise it
                                    raise
                        else:
                            # No conversion happened and no URLs removed - break to avoid infinite loop
                            break
                
                # If we exhausted retries or couldn't fix the issue, log and raise
                if retry_count >= max_retries:
                    logger.error("[OpenAI Client] Exceeded maximum retries for URL errors", extra={
                        'job_id': params.get('job_id') if 'job_id' in params else None,
                        'retry_count': retry_count,
                        'removed_urls': removed_urls
                    })
                else:
                    logger.warning("[OpenAI Client] Could not resolve URL errors after retries", extra={
                        'job_id': params.get('job_id') if 'job_id' in params else None,
                        'retry_count': retry_count,
                        'removed_urls': removed_urls
                    })
            
            # Not an image download error, or retry failed - log and raise original error
            logger.error(f"[OpenAI Client] Error calling OpenAI Responses API: {e}", exc_info=True, extra={
                'job_id': params.get('job_id') if 'job_id' in params else None,
                'tenant_id': params.get('tenant_id') if 'tenant_id' in params else None,
                'model': params.get('model'),
                'tools': params.get('tools', []),
                'error_type': type(e).__name__,
                'error_message': error_message,
                'error_body': error_body,
                'is_image_download_error': is_image_download_error,
                'failed_image_url': failed_image_url
            })
            raise
        except Exception as e:
            logger.error(f"[OpenAI Client] Error calling OpenAI Responses API: {e}", exc_info=True, extra={
                'job_id': params.get('job_id') if 'job_id' in params else None,
                'tenant_id': params.get('tenant_id') if 'tenant_id' in params else None,
                'model': params.get('model'),
                'tools': params.get('tools', []),
                'error_type': type(e).__name__,
                'error_message': str(e)
            })
            raise
    
    def create_chat_completion(self, **params):
        """Legacy method for backwards compatibility - now uses Responses API."""
        return self.create_response(**params)
    
    def make_api_call(self, params: Dict):
        """Make API call to OpenAI Responses API."""
        return self.create_response(**params)
    
    def _extract_and_convert_base64_images(
        self,
        content: str,
        image_handler,
        tenant_id: Optional[str] = None,
        job_id: Optional[str] = None
    ) -> Tuple[str, List[str]]:
        """
        Extract base64-encoded images from JSON response and convert them to URLs.
        
        Args:
            content: Response text that may contain JSON with base64 images
            image_handler: ImageHandler instance for uploading images
            tenant_id: Optional tenant ID for S3 path structure
            job_id: Optional job ID for S3 path structure
            
        Returns:
            Tuple of (updated_content, list_of_image_urls)
        """
        import json
        
        image_urls = []
        updated_content = content
        
        try:
            # Try to parse content as JSON
            try:
                data = json.loads(content)
            except (json.JSONDecodeError, ValueError):
                # Not JSON, return original content
                return content, []
            
            # Check if this is an assets structure
            if not isinstance(data, dict):
                return content, []
            
            assets = data.get('assets', [])
            if not isinstance(assets, list):
                return content, []
            
            # Process each asset
            modified = False
            for asset in assets:
                if not isinstance(asset, dict):
                    continue
                
                # Check if this asset has base64 image data
                encoding = asset.get('encoding', '').lower()
                content_type = asset.get('content_type', '')
                data_field = asset.get('data', '')
                
                # Must have encoding="base64", content_type starting with "image/", and data field
                if (encoding == 'base64' and 
                    content_type.startswith('image/') and 
                    isinstance(data_field, str) and 
                    len(data_field) > 0):
                    
                    try:
                        # Extract filename from asset if available
                        filename = asset.get('name', '')
                        if not filename:
                            # Generate filename from asset ID or index
                            asset_id = asset.get('id', '')
                            if asset_id:
                                # Try to determine extension from content_type
                                ext = 'png'
                                if 'jpeg' in content_type or 'jpg' in content_type:
                                    ext = 'jpg'
                                elif 'png' in content_type:
                                    ext = 'png'
                                filename = f"{asset_id}.{ext}"
                            else:
                                import time
                                import uuid
                                ext = 'png'
                                if 'jpeg' in content_type or 'jpg' in content_type:
                                    ext = 'jpg'
                                filename = f"image_{int(time.time())}_{str(uuid.uuid4())[:8]}.{ext}"
                        
                        # Upload base64 image to S3
                        image_url = image_handler.upload_base64_image_to_s3(
                            image_b64=data_field,
                            content_type=content_type,
                            tenant_id=tenant_id,
                            job_id=job_id,
                            filename=filename
                        )
                        
                        if image_url:
                            # Replace base64 data with URL
                            asset['data'] = image_url
                            asset['encoding'] = 'url'
                            # Keep original data in a backup field for reference
                            asset['original_data_encoding'] = 'base64'
                            image_urls.append(image_url)
                            modified = True
                            
                            logger.info("[OpenAI Client] Converted base64 image to URL", extra={
                                'asset_id': asset.get('id', 'unknown'),
                                'image_filename': filename,
                                'image_url_preview': image_url[:80] + '...' if len(image_url) > 80 else image_url,
                                'content_type': content_type
                            })
                        else:
                            logger.warning(f"[OpenAI Client] Failed to upload base64 image for asset {asset.get('id', 'unknown')}")
                    except Exception as e:
                        logger.error(f"[OpenAI Client] Error converting base64 image: {e}", exc_info=True)
                        # Continue processing other assets even if one fails
            
            # If we modified any assets, update the content
            if modified:
                updated_content = json.dumps(data, indent=2)
                logger.info(f"[OpenAI Client] Converted {len(image_urls)} base64 image(s) to URLs", extra={
                    'image_count': len(image_urls),
                    'tenant_id': tenant_id,
                    'job_id': job_id
                })
            
            return updated_content, image_urls
            
        except Exception as e:
            logger.error(f"[OpenAI Client] Error processing base64 images: {e}", exc_info=True)
            # Return original content on error
            return content, []
    
    def _serialize_response(self, response: Any) -> Dict[str, Any]:
        """
        Serialize OpenAI API response object to a dictionary.
        Handles complex objects and converts them to JSON-serializable format.
        
        Args:
            response: OpenAI API response object
            
        Returns:
            Dictionary representation of the response
        """
        try:
            # Suppress Pydantic serialization warnings
            import warnings
            with warnings.catch_warnings():
                warnings.filterwarnings('ignore', category=UserWarning, module='pydantic')
                warnings.filterwarnings('ignore', message='.*PydanticSerializationUnexpectedValue.*')
                
                # Convert response object to dict using model_dump if available (Pydantic v2)
                if hasattr(response, 'model_dump'):
                    try:
                        return response.model_dump(mode='json')
                    except Exception as e:
                        logger.warning(f"[OpenAI Client] model_dump failed, trying fallback: {e}")
                        # Fallback to dict() if available (Pydantic v1 or simple objects)
                        if hasattr(response, 'dict'):
                            return response.dict()
                # Fallback to dict() if available (Pydantic v1 or simple objects)
                elif hasattr(response, 'dict'):
                    return response.dict()
            
            # Try to convert attributes to dict if model_dump/dict don't work
            result = {}
            # Get all non-private attributes
            for attr in dir(response):
                if not attr.startswith('_'):
                    try:
                        value = getattr(response, attr)
                        # Skip methods
                        if not callable(value):
                            # Try to serialize the value
                            import warnings
                            with warnings.catch_warnings():
                                warnings.filterwarnings('ignore', category=UserWarning, module='pydantic')
                                warnings.filterwarnings('ignore', message='.*PydanticSerializationUnexpectedValue.*')
                                
                                if hasattr(value, 'model_dump'):
                                    try:
                                        result[attr] = value.model_dump(mode='json')
                                    except Exception:
                                        # Fallback to string representation if serialization fails
                                        result[attr] = str(value)
                                elif hasattr(value, 'dict'):
                                    result[attr] = value.dict()
                                elif isinstance(value, (str, int, float, bool, type(None))):
                                    result[attr] = value
                                elif isinstance(value, list):
                                    result[attr] = []
                                    for item in value:
                                        try:
                                            with warnings.catch_warnings():
                                                warnings.filterwarnings('ignore', category=UserWarning, module='pydantic')
                                                warnings.filterwarnings('ignore', message='.*PydanticSerializationUnexpectedValue.*')
                                                if hasattr(item, 'model_dump'):
                                                    result[attr].append(item.model_dump(mode='json'))
                                                elif hasattr(item, 'dict'):
                                                    result[attr].append(item.dict())
                                                elif isinstance(item, (str, int, float, bool, type(None))):
                                                    result[attr].append(item)
                                                else:
                                                    result[attr].append(str(item))
                                        except Exception:
                                            # Fallback to string if serialization fails
                                            result[attr].append(str(item))
                                else:
                                    # For complex objects, try to convert to string
                                    result[attr] = str(value)
                    except Exception as e:
                        logger.debug(f"[OpenAI Client] Could not serialize response attribute {attr}: {e}")
                        result[attr] = f"<unserializable: {type(value).__name__}>"
            return result
        except Exception as e:
            # If serialization fails, try a more lenient approach
            logger.warning(f"[OpenAI Client] Error serializing response with strict mode: {e}", exc_info=False)
            try:
                # Try serializing with exclude_unset and exclude_none to avoid problematic fields
                if hasattr(response, 'model_dump'):
                    return response.model_dump(mode='json', exclude_unset=True, exclude_none=True)
                elif hasattr(response, 'dict'):
                    return response.dict(exclude_unset=True, exclude_none=True)
            except Exception as e2:
                logger.warning(f"[OpenAI Client] Error with lenient serialization: {e2}", exc_info=False)
            
            # Final fallback: return basic info and string representation
            try:
                return {
                    "error": "Failed to serialize response",
                    "error_message": str(e),
                    "response_type": type(response).__name__,
                    "response_str": str(response),
                    "response_repr": repr(response)
                }
            except Exception as e3:
                # Last resort - return minimal info
                return {
                    "error": "Failed to serialize response",
                    "error_message": f"Multiple serialization failures: {str(e)}, {str(e3)}"
                }
    
    def process_api_response(
        self,
        response,
        model: str,
        instructions: str,
        input_text: str,
        previous_context: str,
        context: str,
        tools: List[Dict],
        tool_choice: str,
        params: Dict,
        image_handler,
        tenant_id: Optional[str] = None,
        job_id: Optional[str] = None,
        step_name: Optional[str] = None,
        step_instructions: Optional[str] = None
    ):
        """Process Responses API response and return formatted results."""
        from cost_service import calculate_openai_cost
        
        # Log raw response structure for debugging
        logger.info("[OpenAI Client] Processing API response - starting image URL extraction", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'model': model,
            'has_image_generation_tool': any(
                isinstance(t, dict) and t.get('type') == 'image_generation' 
                for t in tools
            ) if tools else False,
            'response_type': type(response).__name__,
            'response_attributes': [attr for attr in dir(response) if not attr.startswith('_')]
        })
        
        # Log response.output structure if it exists
        if hasattr(response, 'output'):
            output_value = response.output
            logger.info("[OpenAI Client] Response has 'output' attribute", extra={
                'job_id': job_id,
                'output_type': type(output_value).__name__,
                'output_is_list': isinstance(output_value, list),
                'output_length': len(output_value) if isinstance(output_value, list) else None,
                'output_is_none': output_value is None,
                'output_is_empty': output_value == [] if isinstance(output_value, list) else None
            })
            
            if isinstance(output_value, list) and len(output_value) > 0:
                # Log structure of each item in output
                for idx, item in enumerate(output_value):
                    item_attrs = [attr for attr in dir(item) if not attr.startswith('_')]
                    item_type = getattr(item, 'type', None) if hasattr(item, 'type') else None
                    logger.debug(f"[OpenAI Client] Output item {idx} structure", extra={
                        'job_id': job_id,
                        'item_index': idx,
                        'item_type': item_type,
                        'item_type_attr': type(item).__name__,
                        'item_attributes': item_attrs,
                        'has_image_url': hasattr(item, 'image_url'),
                        'has_url': hasattr(item, 'url'),
                        'has_image': hasattr(item, 'image'),
                        'has_result': hasattr(item, 'result'),
                        'has_output': hasattr(item, 'output'),
                        'has_name': hasattr(item, 'name'),
                        'has_tool_name': hasattr(item, 'tool_name')
                    })
        else:
            logger.info("[OpenAI Client] Response does NOT have 'output' attribute", extra={
                'job_id': job_id
            })
        
        # Log response.tool_calls structure if it exists
        if hasattr(response, 'tool_calls'):
            tool_calls_value = response.tool_calls
            logger.info("[OpenAI Client] Response has 'tool_calls' attribute", extra={
                'job_id': job_id,
                'tool_calls_type': type(tool_calls_value).__name__,
                'tool_calls_is_list': isinstance(tool_calls_value, list),
                'tool_calls_length': len(tool_calls_value) if isinstance(tool_calls_value, list) else None,
                'tool_calls_is_none': tool_calls_value is None,
                'tool_calls_is_empty': tool_calls_value == [] if isinstance(tool_calls_value, list) else None
            })
            
            if isinstance(tool_calls_value, list) and len(tool_calls_value) > 0:
                for idx, tool_call in enumerate(tool_calls_value):
                    tool_call_attrs = [attr for attr in dir(tool_call) if not attr.startswith('_')]
                    tool_call_type = getattr(tool_call, 'type', None) if hasattr(tool_call, 'type') else None
                    logger.debug(f"[OpenAI Client] Tool call {idx} structure", extra={
                        'job_id': job_id,
                        'tool_call_index': idx,
                        'tool_call_type': tool_call_type,
                        'tool_call_type_attr': type(tool_call).__name__,
                        'tool_call_attributes': tool_call_attrs,
                        'has_output': hasattr(tool_call, 'output'),
                        'has_result': hasattr(tool_call, 'result')
                    })
        else:
            logger.info("[OpenAI Client] Response does NOT have 'tool_calls' attribute", extra={
                'job_id': job_id
            })
        
        # Responses API uses output_text instead of choices[0].message.content
        content = getattr(response, "output_text", "")
        if not content and hasattr(response, "choices"):
            # Fallback for backwards compatibility
            if response.choices and len(response.choices) > 0:
                content = response.choices[0].message.content or ""
        
        logger.debug("[OpenAI Client] Extracted content from response", extra={
            'job_id': job_id,
            'content_length': len(content) if content else 0,
            'content_preview': content[:200] + '...' if content and len(content) > 200 else content
        })
        
        # Extract and convert base64 images in JSON responses
        base64_image_urls = []
        if content and image_handler:
            try:
                logger.info("[OpenAI Client] Attempting base64 image extraction from content", extra={
                    'job_id': job_id,
                    'content_length': len(content),
                    'has_image_handler': image_handler is not None
                })
                updated_content, base64_image_urls = self._extract_and_convert_base64_images(
                    content=content,
                    image_handler=image_handler,
                    tenant_id=tenant_id,
                    job_id=job_id
                )
                if updated_content != content:
                    content = updated_content
                    logger.info(f"[OpenAI Client] Converted {len(base64_image_urls)} base64 image(s) in response", extra={
                        'base64_image_count': len(base64_image_urls),
                        'base64_image_urls': base64_image_urls,
                        'tenant_id': tenant_id,
                        'job_id': job_id
                    })
                else:
                    logger.info("[OpenAI Client] No base64 images found in content", extra={
                        'job_id': job_id
                    })
            except Exception as e:
                logger.warning(f"[OpenAI Client] Error converting base64 images: {e}", exc_info=True, extra={
                    'job_id': job_id,
                    'error_type': type(e).__name__,
                    'error_message': str(e)
                })
                # Continue with original content if conversion fails
        
        usage = response.usage if hasattr(response, "usage") and response.usage else None
        input_tokens = getattr(usage, "input_tokens", 0) if usage else getattr(usage, "prompt_tokens", 0) if usage else 0
        output_tokens = getattr(usage, "output_tokens", 0) if usage else getattr(usage, "completion_tokens", 0) if usage else 0
        total_tokens = getattr(usage, "total_tokens", 0) if usage else 0
        
        cost_data = calculate_openai_cost(model, input_tokens, output_tokens)
        
        usage_info = {
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "cost_usd": cost_data["cost_usd"],
            "service_type": "openai_worker_report"
        }
        
        # Store full raw API request params (exact what was sent to OpenAI)
        raw_api_request = copy.deepcopy(params)
        # Remove job_id and tenant_id from raw request (these are internal tracking, not sent to OpenAI)
        raw_api_request.pop('job_id', None)
        raw_api_request.pop('tenant_id', None)
        
        request_details = {
            "model": model,
            "instructions": instructions,
            "input": input_text,
            "previous_context": previous_context,
            "context": context,
            "tools": tools,
            "tool_choice": tool_choice,
            # Store full raw API request body (exact what was sent to OpenAI)
            "raw_api_request": raw_api_request
        }
        
        # Extract image URLs from response when image_generation tool is used
        from services.response_parser import ResponseParser
        image_urls = ResponseParser.extract_image_urls_from_response(
            response=response,
            image_handler=image_handler,
            tenant_id=tenant_id,
            job_id=job_id,
            base64_image_urls=base64_image_urls,
            context=context,
            step_name=step_name,
            step_instructions=step_instructions or instructions
        )
        
        # Image URL extraction is now handled by ResponseParser
        # The complex extraction logic has been moved to response_parser.py
        
        # Serialize full raw API response object
        raw_api_response = self._serialize_response(response)
        
        response_details = {
            "output_text": content,
            "image_urls": image_urls,
            "usage": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens
            },
            "model": model,
            # Store full raw API response (exact what was received from OpenAI)
            "raw_api_response": raw_api_response
        }
        
        logger.info("[OpenAI Client] Final response_details prepared", extra={
            'job_id': job_id,
            'final_image_urls_count': len(image_urls),
            'final_image_urls': image_urls,
            'output_text_length': len(content) if content else 0,
            'input_tokens': input_tokens,
            'output_tokens': output_tokens,
            'total_tokens': total_tokens
        })
        
        return content, usage_info, request_details, response_details
    
    def handle_openai_error(
        self,
        error: Exception,
        model: str,
        tools: List[Dict],
        tool_choice: str,
        instructions: str,
        context: str,
        full_context: str,
        previous_context: str,
        image_handler
    ):
        """Handle OpenAI API errors with retry logic."""
        logger.error(f"OpenAI API error: {error}", exc_info=True)
        raise Exception(f"OpenAI API error ({type(error).__name__}): {str(error)}")