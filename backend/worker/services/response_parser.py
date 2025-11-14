"""Response parsing utilities for OpenAI API responses."""
import logging
from typing import List, Optional, Tuple, Dict, Any

logger = logging.getLogger(__name__)


class ResponseParser:
    """Handles parsing and extracting data from OpenAI Responses API responses."""
    
    @staticmethod
    def extract_image_urls_from_response(
        response: Any,
        image_handler: Optional[Any] = None,
        tenant_id: Optional[str] = None,
        job_id: Optional[str] = None,
        base64_image_urls: Optional[List[str]] = None
    ) -> List[str]:
        """
        Extract image URLs from OpenAI Responses API response.
        
        Handles multiple response structures:
        - ImageGenerationCall items in response.output
        - image type items in response.output
        - image_generation_call type items
        - tool_call items with image_generation tool
        - response.tool_calls structure
        
        Args:
            response: OpenAI API response object
            image_handler: ImageHandler instance for uploading base64 images
            tenant_id: Optional tenant ID for S3 path structure
            job_id: Optional job ID for S3 path structure
            base64_image_urls: Pre-converted base64 image URLs to include
            
        Returns:
            List of image URLs extracted from response
        """
        image_urls = []
        base64_urls = base64_image_urls or []
        
        logger.info("[Response Parser] Starting image URL extraction from response", extra={
            'job_id': job_id,
            'has_output_attr': hasattr(response, 'output'),
            'has_tool_calls_attr': hasattr(response, 'tool_calls'),
            'base64_urls_count': len(base64_urls)
        })
        
        try:
            # Check if response has output items (Responses API structure)
            if hasattr(response, 'output') and response.output:
                logger.info("[Response Parser] Checking response.output for image URLs", extra={
                    'job_id': job_id,
                    'output_length': len(response.output) if isinstance(response.output, list) else None
                })
                
                for item_idx, item in enumerate(response.output):
                    item_class_name = type(item).__name__
                    logger.debug(f"[Response Parser] Processing output item {item_idx}", extra={
                        'job_id': job_id,
                        'item_index': item_idx,
                        'item_type': item_class_name,
                        'has_type_attr': hasattr(item, 'type')
                    })
                    
                    # Check for ImageGenerationCall by class name first (most reliable)
                    if item_class_name == 'ImageGenerationCall':
                        url = ResponseParser._extract_from_image_generation_call(
                            item, image_handler, tenant_id, job_id, item_idx
                        )
                        if url:
                            image_urls.append(url)
                        continue
                    
                    # Check for image items from image_generation tool
                    if hasattr(item, 'type'):
                        item_type = item.type
                        item_type_str = ResponseParser._get_type_string(item_type)
                        
                        # Check for image type
                        is_image_type = (item_type == 'image' or 
                                        item_type_str == 'image' or
                                        (hasattr(item_type, 'value') and item_type.value == 'image'))
                        
                        if is_image_type:
                            url = ResponseParser._extract_image_url_from_item(item, item_idx, job_id)
                            if url:
                                image_urls.append(url)
                        
                        # Check for image_generation_call type
                        is_image_gen_call = (item_type == 'image_generation_call' or 
                                           item_type_str == 'image_generation_call' or
                                           (hasattr(item_type, 'value') and item_type.value == 'image_generation_call'))
                        
                        if is_image_gen_call:
                            url = ResponseParser._extract_from_image_generation_call(
                                item, image_handler, tenant_id, job_id, item_idx
                            )
                            if url:
                                image_urls.append(url)
                        
                        # Check for tool_call items
                        is_tool_call = (item_type == 'tool_call' or 
                                       item_type == 'tool_calls' or 
                                       item_type_str in ['tool_call', 'tool_calls'] or
                                       (hasattr(item_type, 'value') and item_type.value in ['tool_call', 'tool_calls']))
                        
                        if is_tool_call:
                            urls = ResponseParser._extract_from_tool_call(
                                item, image_handler, tenant_id, job_id, item_idx
                            )
                            image_urls.extend(urls)
            
            # Also check response.tool_calls if it exists (alternative response structure)
            if hasattr(response, 'tool_calls') and response.tool_calls:
                logger.info("[Response Parser] Checking response.tool_calls for image URLs", extra={
                    'job_id': job_id,
                    'tool_calls_length': len(response.tool_calls) if isinstance(response.tool_calls, list) else None
                })
                
                for tool_call_idx, tool_call in enumerate(response.tool_calls):
                    if hasattr(tool_call, 'type') and tool_call.type == 'image_generation':
                        urls = ResponseParser._extract_from_tool_call(
                            tool_call, image_handler, tenant_id, job_id, tool_call_idx
                        )
                        image_urls.extend(urls)
            
            # Add base64-converted URLs to the image_urls list
            logger.info("[Response Parser] Adding base64-converted URLs to image_urls", extra={
                'job_id': job_id,
                'base64_urls_count': len(base64_urls),
                'extracted_urls_count': len(image_urls),
            })
            image_urls.extend(base64_urls)
            
            if image_urls:
                logger.info(f"[Response Parser] Successfully extracted {len(image_urls)} image URL(s) from response", extra={
                    'job_id': job_id,
                    'image_count': len(image_urls),
                    'base64_converted_count': len(base64_urls),
                    'extracted_from_output_count': len(image_urls) - len(base64_urls),
                })
            else:
                logger.warning("[Response Parser] No image URLs extracted from response", extra={
                    'job_id': job_id,
                    'has_output': hasattr(response, 'output'),
                    'has_tool_calls': hasattr(response, 'tool_calls'),
                    'base64_urls_count': len(base64_urls)
                })
        except Exception as e:
            logger.error(f"[Response Parser] Error extracting image URLs from response: {e}", exc_info=True, extra={
                'job_id': job_id,
                'error_type': type(e).__name__,
                'error_message': str(e),
            })
            # Don't fail the request if image extraction fails, just log it
            # Still include base64-converted URLs if available
            image_urls.extend(base64_urls)
        
        return image_urls
    
    @staticmethod
    def _get_type_string(item_type: Any) -> Optional[str]:
        """Convert item type to string representation."""
        if isinstance(item_type, str):
            return item_type
        elif hasattr(item_type, 'value'):
            return str(item_type.value)
        elif hasattr(item_type, '__str__'):
            return str(item_type)
        else:
            return str(item_type) if item_type else None
    
    @staticmethod
    def _extract_image_url_from_item(item: Any, item_idx: int, job_id: Optional[str]) -> Optional[str]:
        """Extract image URL from an image type item."""
        image_url = None
        if hasattr(item, 'image_url'):
            image_url = item.image_url
        elif hasattr(item, 'url'):
            image_url = item.url
        elif hasattr(item, 'image'):
            image_obj = item.image
            if isinstance(image_obj, dict):
                image_url = image_obj.get('url') or image_obj.get('image_url')
            elif hasattr(image_obj, 'url'):
                image_url = image_obj.url
            elif hasattr(image_obj, 'image_url'):
                image_url = image_obj.image_url
        
        if image_url:
            logger.info(f"[Response Parser] Extracted image URL from item {item_idx}", extra={
                'job_id': job_id,
                'item_index': item_idx,
                'image_url': image_url,
            })
        
        return image_url
    
    @staticmethod
    def _extract_from_image_generation_call(
        item: Any,
        image_handler: Optional[Any],
        tenant_id: Optional[str],
        job_id: Optional[str],
        item_idx: int
    ) -> Optional[str]:
        """Extract and convert base64 image from ImageGenerationCall item."""
        result = None
        if hasattr(item, 'result'):
            result = item.result
        
        if result and isinstance(result, str) and image_handler:
            try:
                converted_url = image_handler.upload_base64_image_to_s3(
                    image_b64=result,
                    content_type='image/png',
                    tenant_id=tenant_id,
                    job_id=job_id
                )
                if converted_url:
                    logger.info(f"[Response Parser] Converted base64 image from ImageGenerationCall to URL", extra={
                        'job_id': job_id,
                        'item_index': item_idx,
                        'image_url': converted_url,
                    })
                    return converted_url
            except Exception as e:
                logger.error(f"[Response Parser] Error converting base64 image: {e}", exc_info=True, extra={
                    'job_id': job_id,
                    'item_index': item_idx,
                })
        
        return None
    
    @staticmethod
    def _extract_from_tool_call(
        item: Any,
        image_handler: Optional[Any],
        tenant_id: Optional[str],
        job_id: Optional[str],
        item_idx: int
    ) -> List[str]:
        """Extract image URLs from a tool_call item."""
        urls = []
        
        # Check if this is an image_generation tool call
        tool_name = None
        if hasattr(item, 'name'):
            tool_name = item.name
        elif hasattr(item, 'tool_name'):
            tool_name = item.tool_name
        
        if tool_name != 'image_generation':
            return urls
        
        # Extract result or output
        result = None
        if hasattr(item, 'result'):
            result = item.result
        elif hasattr(item, 'output'):
            result = item.output
        
        if not result:
            return urls
        
        # Result might be a list of images or a single image
        if isinstance(result, list):
            for img in result:
                img_url = ResponseParser._extract_url_from_image_object(img, job_id, item_idx)
                if img_url:
                    urls.append(img_url)
        else:
            # Single image result
            img_url = ResponseParser._extract_url_from_image_object(result, job_id, item_idx)
            if img_url:
                urls.append(img_url)
        
        return urls
    
    @staticmethod
    def _extract_url_from_image_object(img: Any, job_id: Optional[str], item_idx: int) -> Optional[str]:
        """Extract URL from an image object (dict or object)."""
        img_url = None
        if isinstance(img, dict):
            img_url = img.get('url') or img.get('image_url')
        elif hasattr(img, 'url'):
            img_url = img.url
        elif hasattr(img, 'image_url'):
            img_url = img.image_url
        
        return img_url

