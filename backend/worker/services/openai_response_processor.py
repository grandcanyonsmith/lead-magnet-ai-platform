"""OpenAI response processing service."""
import json
import logging
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class OpenAIResponseProcessor:
    """Handles processing of OpenAI API responses."""
    
    def _log_response_structure(
        self,
        response,
        tools: List[Dict],
        job_id: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> None:
        """
        Log response structure for debugging.
        
        Args:
            response: OpenAI API response
            tools: List of tools used
            job_id: Optional job ID for logging
            tenant_id: Optional tenant ID for logging
        """
        logger.info("[OpenAI Response Processor] Processing API response - starting image URL extraction", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
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
            logger.info("[OpenAI Response Processor] Response has 'output' attribute", extra={
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
                    logger.debug(f"[OpenAI Response Processor] Output item {idx} structure", extra={
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
            logger.info("[OpenAI Response Processor] Response does NOT have 'output' attribute", extra={
                'job_id': job_id
            })
        
        # Log response.tool_calls structure if it exists
        if hasattr(response, 'tool_calls'):
            tool_calls_value = response.tool_calls
            logger.info("[OpenAI Response Processor] Response has 'tool_calls' attribute", extra={
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
                    logger.debug(f"[OpenAI Response Processor] Tool call {idx} structure", extra={
                        'job_id': job_id,
                        'tool_call_index': idx,
                        'tool_call_type': tool_call_type,
                        'tool_call_type_attr': type(tool_call).__name__,
                        'tool_call_attributes': tool_call_attrs,
                        'has_output': hasattr(tool_call, 'output'),
                        'has_result': hasattr(tool_call, 'result')
                    })
        else:
            logger.info("[OpenAI Response Processor] Response does NOT have 'tool_calls' attribute", extra={
                'job_id': job_id
            })
    
    def _extract_output_text(self, response) -> str:
        """
        Extract output text from response.
        
        Args:
            response: OpenAI API response
            
        Returns:
            Extracted text content
        """
        # Responses API uses output_text instead of choices[0].message.content
        content = getattr(response, "output_text", "")
        if not content and hasattr(response, "choices"):
            # Fallback for backwards compatibility
            if response.choices and len(response.choices) > 0:
                content = response.choices[0].message.content or ""
        return content
    
    def _process_base64_asset(
        self,
        asset: Dict,
        image_handler,
        tenant_id: Optional[str] = None,
        job_id: Optional[str] = None
    ) -> Optional[str]:
        """
        Process a single base64 image asset and convert it to a URL.
        
        Args:
            asset: Asset dictionary with base64 image data
            image_handler: ImageHandler instance for uploading images
            tenant_id: Optional tenant ID for S3 path structure
            job_id: Optional job ID for S3 path structure
            
        Returns:
            Image URL if successful, None otherwise
        """
        encoding = asset.get('encoding', '').lower()
        content_type = asset.get('content_type', '')
        data_field = asset.get('data', '')
        
        # Must have encoding="base64", content_type starting with "image/", and data field
        if not (encoding == 'base64' and 
                content_type.startswith('image/') and 
                isinstance(data_field, str) and 
                len(data_field) > 0):
            return None
        
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
                
                logger.info("[OpenAI Response Processor] Converted base64 image to URL", extra={
                    'asset_id': asset.get('id', 'unknown'),
                    'image_filename': filename,
                    'image_url_preview': image_url[:80] + '...' if len(image_url) > 80 else image_url,
                    'content_type': content_type
                })
                return image_url
            else:
                logger.warning(f"[OpenAI Response Processor] Failed to upload base64 image for asset {asset.get('id', 'unknown')}")
                return None
        except Exception as e:
            logger.error(f"[OpenAI Response Processor] Error converting base64 image: {e}", exc_info=True)
            return None
    
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
                
                image_url = self._process_base64_asset(
                    asset=asset,
                    image_handler=image_handler,
                    tenant_id=tenant_id,
                    job_id=job_id
                )
                
                if image_url:
                    image_urls.append(image_url)
                    modified = True
            
            # If we modified any assets, update the content
            if modified:
                updated_content = json.dumps(data, indent=2)
                logger.info(f"[OpenAI Response Processor] Converted {len(image_urls)} base64 image(s) to URLs", extra={
                    'image_count': len(image_urls),
                    'tenant_id': tenant_id,
                    'job_id': job_id
                })
            
            return updated_content, image_urls
            
        except Exception as e:
            logger.error(f"[OpenAI Response Processor] Error processing base64 images: {e}", exc_info=True)
            # Return original content on error
            return content, []
    
    def _process_images_in_content(
        self,
        content: str,
        image_handler,
        tenant_id: Optional[str] = None,
        job_id: Optional[str] = None
    ) -> Tuple[str, List[str]]:
        """
        Process base64 images in content and convert to URLs.
        
        Args:
            content: Response content that may contain base64 images
            image_handler: ImageHandler instance
            tenant_id: Optional tenant ID
            job_id: Optional job ID
            
        Returns:
            Tuple of (updated_content, base64_image_urls)
        """
        base64_image_urls = []
        if content and image_handler:
            try:
                logger.info("[OpenAI Response Processor] Attempting base64 image extraction from content", extra={
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
                    logger.info(f"[OpenAI Response Processor] Converted {len(base64_image_urls)} base64 image(s) in response", extra={
                        'base64_image_count': len(base64_image_urls),
                        'base64_image_urls': base64_image_urls,
                        'tenant_id': tenant_id,
                        'job_id': job_id
                    })
                else:
                    logger.info("[OpenAI Response Processor] No base64 images found in content", extra={
                        'job_id': job_id
                    })
            except Exception as e:
                logger.warning(f"[OpenAI Response Processor] Error converting base64 images: {e}", exc_info=True, extra={
                    'job_id': job_id,
                    'error_type': type(e).__name__,
                    'error_message': str(e)
                })
                # Continue with original content if conversion fails
        
        return content, base64_image_urls
    
    def _calculate_usage(
        self,
        response,
        model: str
    ) -> Dict[str, Any]:
        """
        Calculate usage information from response.
        
        Args:
            response: OpenAI API response
            model: Model name
            
        Returns:
            Usage information dictionary
        """
        from core.cost_service import calculate_openai_cost
        
        usage = response.usage if hasattr(response, "usage") and response.usage else None
        input_tokens = getattr(usage, "input_tokens", 0) if usage else getattr(usage, "prompt_tokens", 0) if usage else 0
        output_tokens = getattr(usage, "output_tokens", 0) if usage else getattr(usage, "completion_tokens", 0) if usage else 0
        total_tokens = getattr(usage, "total_tokens", 0) if usage else 0
        
        cost_data = calculate_openai_cost(model, input_tokens, output_tokens)
        
        return {
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "cost_usd": cost_data["cost_usd"],
            "service_type": "openai_worker_report"
        }
    
    def _extract_image_urls_from_response(
        self,
        response,
        image_handler,
        base64_image_urls: List[str],
        tenant_id: Optional[str] = None,
        job_id: Optional[str] = None
    ) -> List[str]:
        """
        Extract image URLs from response.
        
        Args:
            response: OpenAI API response
            image_handler: ImageHandler instance
            base64_image_urls: List of base64 image URLs already converted
            tenant_id: Optional tenant ID
            job_id: Optional job ID
            
        Returns:
            List of image URLs
        """
        from services.response_parser import ResponseParser
        return ResponseParser.extract_image_urls_from_response(
            response=response,
            image_handler=image_handler,
            tenant_id=tenant_id,
            job_id=job_id,
            base64_image_urls=base64_image_urls
        )
    
    def _build_response_details(
        self,
        content: str,
        image_urls: List[str],
        usage_info: Dict[str, Any],
        model: str,
        job_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Build response details dictionary.
        
        Args:
            content: Output text content
            image_urls: List of image URLs
            usage_info: Usage information dictionary
            model: Model name
            job_id: Optional job ID for logging
            
        Returns:
            Response details dictionary
        """
        response_details = {
            "output_text": content,
            "image_urls": image_urls,
            "usage": {
                "input_tokens": usage_info["input_tokens"],
                "output_tokens": usage_info["output_tokens"],
                "total_tokens": usage_info["total_tokens"]
            },
            "model": model
        }
        
        logger.info("[OpenAI Response Processor] Final response_details prepared", extra={
            'job_id': job_id,
            'final_image_urls_count': len(image_urls),
            'final_image_urls': image_urls,
            'output_text_length': len(content) if content else 0,
            'input_tokens': usage_info["input_tokens"],
            'output_tokens': usage_info["output_tokens"],
            'total_tokens': usage_info["total_tokens"]
        })
        
        return response_details
    
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
        job_id: Optional[str] = None
    ):
        """Process Responses API response and return formatted results."""
        # Log response structure
        self._log_response_structure(response, tools, job_id, tenant_id)
        
        # Extract output text
        content = self._extract_output_text(response)
        
        logger.debug("[OpenAI Response Processor] Extracted content from response", extra={
            'job_id': job_id,
            'content_length': len(content) if content else 0,
            'content_preview': content[:200] + '...' if content and len(content) > 200 else content
        })
        
        # Process images in content
        content, base64_image_urls = self._process_images_in_content(
            content=content,
            image_handler=image_handler,
            tenant_id=tenant_id,
            job_id=job_id
        )
        
        # Calculate usage
        usage_info = self._calculate_usage(response, model)
        
        # Build request details
        request_details = {
            "model": model,
            "instructions": instructions,
            "input": input_text,
            "previous_context": previous_context,
            "context": context,
            "tools": tools,
            "tool_choice": tool_choice
        }
        
        # Extract image URLs from response
        image_urls = self._extract_image_urls_from_response(
            response=response,
            image_handler=image_handler,
            base64_image_urls=base64_image_urls,
            tenant_id=tenant_id,
            job_id=job_id
        )
        
        # Build response details
        response_details = self._build_response_details(
            content=content,
            image_urls=image_urls,
            usage_info=usage_info,
            model=model,
            job_id=job_id
        )
        
        return content, usage_info, request_details, response_details

