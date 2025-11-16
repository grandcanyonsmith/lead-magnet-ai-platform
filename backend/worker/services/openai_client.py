"""OpenAI API client wrapper."""
import logging
import openai
from typing import Dict, List, Optional, Tuple

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
    
    def _check_image_generation_tool(self, tools: Optional[List[Dict]]) -> bool:
        """
        Check if image_generation tool is present in tools list.
        
        Args:
            tools: List of tools
            
        Returns:
            True if image_generation tool is present
        """
        if not tools:
            return False
        for tool in tools:
            if isinstance(tool, dict) and tool.get('type') == 'image_generation':
                return True
        return False
    
    def _validate_image_urls(
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
                logger.warning("[OpenAI Client] Filtered invalid image URL from previous_image_urls", extra={
                    'job_id': job_id,
                    'tenant_id': tenant_id,
                    'url_preview': url[:100] + '...' if len(url) > 100 else url,
                    'reason': reason,
                    'total_urls': len(previous_image_urls),
                    'valid_urls_count': len(valid_image_urls),
                    'filtered_count': len(filtered_urls)
                })
        
        return valid_image_urls, filtered_urls
    
    def _build_input_with_images(
        self,
        input_text: str,
        valid_image_urls: List[str],
        job_id: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> List[Dict]:
        """
        Build input content with text and images.
        
        For problematic URLs (like Firebase Storage URLs), downloads the image
        locally and converts it to a base64 data URL before passing to OpenAI API.
        
        Args:
            input_text: Text input
            valid_image_urls: List of valid image URLs
            job_id: Optional job ID for logging
            tenant_id: Optional tenant ID for logging
            
        Returns:
            API input format with role and content
        """
        from utils.image_utils import is_problematic_url, download_image_and_convert_to_data_url
        
        # Build input as list of content items
        input_content = [
            {"type": "input_text", "text": input_text}
        ]
        
        converted_count = 0
        failed_count = 0
        
        # Add each valid previous image URL as input_image
        for image_url in valid_image_urls:
            final_image_url = image_url
            
            # Check if this URL is problematic (e.g., Firebase Storage)
            if is_problematic_url(image_url):
                logger.info("[OpenAI Client] Detected problematic URL, downloading and converting to base64", extra={
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
                    logger.info("[OpenAI Client] Successfully converted problematic URL to data URL", extra={
                        'job_id': job_id,
                        'tenant_id': tenant_id,
                        'url_preview': image_url[:100] + '...' if len(image_url) > 100 else image_url,
                        'data_url_length': len(data_url)
                    })
                else:
                    failed_count += 1
                    logger.error("[OpenAI Client] Failed to download/convert problematic URL, using original URL", extra={
                        'job_id': job_id,
                        'tenant_id': tenant_id,
                        'url_preview': image_url[:100] + '...' if len(image_url) > 100 else image_url
                    })
                    # Continue with original URL - OpenAI will try to download it
                    # This may still fail, but we've logged the issue
            
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
        
        logger.info("[OpenAI Client] Building API params with previous image URLs", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'valid_image_urls_count': len(valid_image_urls),
            'input_content_items': len(input_content),
            'converted_to_data_url_count': converted_count,
            'failed_conversion_count': failed_count
        })
        
        return api_input
    
    def _build_input_text_only(
        self,
        input_text: str,
        has_image_generation: bool,
        previous_image_urls: Optional[List[str]]
    ) -> str:
        """
        Build simple text input (backward compatible format).
        
        Args:
            input_text: Text input
            has_image_generation: Whether image generation tool is present
            previous_image_urls: Previous image URLs (for logging)
            
        Returns:
            Simple text input string
        """
        if has_image_generation and previous_image_urls:
            logger.debug("[OpenAI Client] Image generation tool present but no previous image URLs to include")
        return input_text
    
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
            reasoning_level: Reasoning level (deprecated - not supported in Responses API, will be removed in next major version)
            previous_image_urls: Optional list of image URLs from previous steps to include in input
            job_id: Optional job ID for logging
            tenant_id: Optional tenant ID for logging
            
        Returns:
            API parameters dictionary for Responses API
        """
        # Check if image_generation tool is present
        has_image_generation = self._check_image_generation_tool(tools)
        
        # Build input: if image_generation tool is present and we have previous image URLs,
        # use list format with text and images; otherwise use string format (backward compatible)
        if has_image_generation and previous_image_urls and len(previous_image_urls) > 0:
            valid_image_urls, filtered_urls = self._validate_image_urls(
                previous_image_urls=previous_image_urls,
                job_id=job_id,
                tenant_id=tenant_id
            )
            
            api_input = self._build_input_with_images(
                input_text=input_text,
                valid_image_urls=valid_image_urls,
                job_id=job_id,
                tenant_id=tenant_id
            )
        else:
            # Use string format (backward compatible)
            api_input = self._build_input_text_only(
                input_text=input_text,
                has_image_generation=has_image_generation,
                previous_image_urls=previous_image_urls
            )
        
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
            
            response = self.client.responses.create(**params)
            
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
                
                logger.info("[OpenAI Client] Converted base64 image to URL", extra={
                    'asset_id': asset.get('id', 'unknown'),
                    'image_filename': filename,
                    'image_url_preview': image_url[:80] + '...' if len(image_url) > 80 else image_url,
                    'content_type': content_type
                })
                return image_url
            else:
                logger.warning(f"[OpenAI Client] Failed to upload base64 image for asset {asset.get('id', 'unknown')}")
                return None
        except Exception as e:
            logger.error(f"[OpenAI Client] Error converting base64 image: {e}", exc_info=True)
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
        logger.info("[OpenAI Client] Processing API response - starting image URL extraction", extra={
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
        
        return content, base64_image_urls
    
    def _calculate_usage(
        self,
        response,
        model: str
    ) -> Dict[str, any]:
        """
        Calculate usage information from response.
        
        Args:
            response: OpenAI API response
            model: Model name
            
        Returns:
            Usage information dictionary
        """
        from cost_service import calculate_openai_cost
        
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
        usage_info: Dict[str, any],
        model: str,
        job_id: Optional[str] = None
    ) -> Dict[str, any]:
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
        
        logger.info("[OpenAI Client] Final response_details prepared", extra={
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
        
        logger.debug("[OpenAI Client] Extracted content from response", extra={
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
