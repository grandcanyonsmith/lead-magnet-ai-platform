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
    
    def build_api_params(
        self,
        model: str,
        instructions: str,
        input_text: str,
        tools: Optional[List[Dict]] = None,
        tool_choice: str = "auto",
        has_computer_use: bool = False,
        reasoning_level: Optional[str] = None
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
            
        Returns:
            API parameters dictionary for Responses API
        """
        params = {
            "model": model,
            "instructions": instructions,
            "input": input_text
        }
        
        if tools and len(tools) > 0:
            # Clean tools before sending to OpenAI API
            # - Keep container parameter (required by API for code_interpreter and computer_use_preview)
            # - Recursively convert all Decimal values to int (for display_width, display_height, etc.)
            cleaned_tools = []
            from utils.decimal_utils import convert_decimals_to_int
            from services.tool_validator import ToolValidator
            
            for idx, tool in enumerate(tools):
                if isinstance(tool, dict):
                    cleaned_tool = tool.copy()
                    
                    # Defensive check: Ensure container parameter is present for tools that require it
                    # This is a fallback in case validation was missed earlier
                    tool_type = cleaned_tool.get("type")
                    if tool_type and ToolValidator.requires_container(tool_type):
                        if "container" not in cleaned_tool:
                            logger.warning(
                                f"Missing container parameter for tool[{idx}] ({tool_type}), "
                                "adding it defensively. This should have been caught by validation."
                            )
                            cleaned_tool["container"] = {"type": "auto"}
                        elif not isinstance(cleaned_tool.get("container"), dict) or "type" not in cleaned_tool.get("container", {}):
                            logger.warning(
                                f"Invalid container structure for tool[{idx}] ({tool_type}), "
                                "fixing it defensively."
                            )
                            cleaned_tool["container"] = {"type": "auto"}
                    
                    # Recursively convert ALL Decimal values to int throughout the tool dictionary
                    # This ensures display_width, display_height, and any other Decimal values are converted
                    # OpenAI API requires integers, not Decimal types
                    cleaned_tool = convert_decimals_to_int(cleaned_tool)
                    
                    # Final verification: Double-check container is still present after conversion
                    if tool_type and ToolValidator.requires_container(tool_type):
                        if "container" not in cleaned_tool:
                            logger.error(
                                f"Container parameter lost during conversion for tool[{idx}] ({tool_type}), "
                                "re-adding it."
                            )
                            cleaned_tool["container"] = {"type": "auto"}
                    
                    cleaned_tools.append(cleaned_tool)
                else:
                    cleaned_tools.append(tool)
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
        
        request_details = {
            "model": model,
            "instructions": instructions,
            "input": input_text,
            "previous_context": previous_context,
            "context": context,
            "tools": tools,
            "tool_choice": tool_choice
        }
        
        # Extract image URLs from response when image_generation tool is used
        image_urls = []
        logger.info("[OpenAI Client] Starting image URL extraction from response", extra={
            'job_id': job_id,
            'has_output_attr': hasattr(response, 'output'),
            'has_tool_calls_attr': hasattr(response, 'tool_calls'),
            'base64_urls_count': len(base64_image_urls)
        })
        
        try:
            # Check if response has output items (Responses API structure)
            if hasattr(response, 'output') and response.output:
                logger.info("[OpenAI Client] Checking response.output for image URLs", extra={
                    'job_id': job_id,
                    'output_length': len(response.output) if isinstance(response.output, list) else None
                })
                
                for item_idx, item in enumerate(response.output):
                    item_class_name = type(item).__name__
                    logger.debug(f"[OpenAI Client] Processing output item {item_idx}", extra={
                        'job_id': job_id,
                        'item_index': item_idx,
                        'item_type': item_class_name,
                        'has_type_attr': hasattr(item, 'type')
                    })
                    
                    # Check for ImageGenerationCall by class name first (most reliable)
                    if item_class_name == 'ImageGenerationCall':
                        logger.info(f"[OpenAI Client] Found ImageGenerationCall class at index {item_idx}", extra={
                            'job_id': job_id,
                            'item_index': item_idx
                        })
                        
                        # Extract base64 image data from result
                        result = None
                        if hasattr(item, 'result'):
                            result = item.result
                            logger.debug(f"[OpenAI Client] Found result attribute in ImageGenerationCall", extra={
                                'job_id': job_id,
                                'item_index': item_idx,
                                'result_type': type(result).__name__,
                                'result_length': len(result) if isinstance(result, str) else None
                            })
                            
                            if result and isinstance(result, str):
                                logger.info(f"[OpenAI Client] Processing base64 image data from ImageGenerationCall", extra={
                                    'job_id': job_id,
                                    'item_index': item_idx,
                                    'result_length': len(result),
                                    'has_image_handler': image_handler is not None
                                })
                                
                                # Convert base64 to image URL using image_handler
                                if image_handler:
                                    try:
                                        # Create a data URL from base64
                                        base64_data_url = f"data:image/png;base64,{result}"
                                        converted_url = image_handler.convert_base64_to_url(
                                            base64_data_url,
                                            tenant_id=tenant_id,
                                            job_id=job_id
                                        )
                                        if converted_url:
                                            image_urls.append(converted_url)
                                            logger.info(f"[OpenAI Client] Successfully converted base64 image from ImageGenerationCall to URL", extra={
                                                'job_id': job_id,
                                                'item_index': item_idx,
                                                'image_url': converted_url,
                                                'total_extracted': len(image_urls)
                                            })
                                        else:
                                            logger.warning(f"[OpenAI Client] Failed to convert base64 image to URL", extra={
                                                'job_id': job_id,
                                                'item_index': item_idx
                                            })
                                    except Exception as e:
                                        logger.error(f"[OpenAI Client] Error converting base64 image from ImageGenerationCall: {e}", exc_info=True, extra={
                                            'job_id': job_id,
                                            'item_index': item_idx,
                                            'error_type': type(e).__name__,
                                            'error_message': str(e)
                                        })
                                else:
                                    logger.warning(f"[OpenAI Client] No image_handler available to convert base64 image", extra={
                                        'job_id': job_id,
                                        'item_index': item_idx
                                    })
                            else:
                                logger.warning(f"[OpenAI Client] ImageGenerationCall result is not a string", extra={
                                    'job_id': job_id,
                                    'item_index': item_idx,
                                    'result_type': type(result).__name__ if result else None
                                })
                        else:
                            logger.warning(f"[OpenAI Client] ImageGenerationCall has no result attribute", extra={
                                'job_id': job_id,
                                'item_index': item_idx,
                                'item_attrs': [attr for attr in dir(item) if not attr.startswith('_')]
                            })
                        continue  # Skip to next item
                    
                    # Check for image items from image_generation tool
                    # Image items typically have type='image' and contain image_url or url
                    if hasattr(item, 'type'):
                        item_type = item.type
                        # Convert to string if it's an enum or other type
                        # Try multiple ways to get the string value
                        item_type_str = None
                        if isinstance(item_type, str):
                            item_type_str = item_type
                        elif hasattr(item_type, 'value'):
                            item_type_str = str(item_type.value)
                        elif hasattr(item_type, '__str__'):
                            item_type_str = str(item_type)
                        else:
                            item_type_str = str(item_type) if item_type else None
                        
                        logger.debug(f"[OpenAI Client] Output item {item_idx} has type: {item_type} (str: {item_type_str})", extra={
                            'job_id': job_id,
                            'item_index': item_idx,
                            'item_type': item_type,
                            'item_type_str': item_type_str,
                            'item_type_class': type(item_type).__name__,
                            'item_type_repr': repr(item_type)
                        })
                        
                        # Check both the original type and string version
                        is_image_type = (item_type == 'image' or 
                                        item_type_str == 'image' or
                                        (hasattr(item_type, 'value') and item_type.value == 'image'))
                        
                        if is_image_type:
                            logger.info(f"[OpenAI Client] Found image type item at index {item_idx}", extra={
                                'job_id': job_id,
                                'item_index': item_idx
                            })
                            
                            # Extract image URL from image item
                            image_url = None
                            if hasattr(item, 'image_url'):
                                image_url = item.image_url
                                logger.debug(f"[OpenAI Client] Extracted image_url from item.image_url", extra={
                                    'job_id': job_id,
                                    'item_index': item_idx,
                                    'image_url_preview': image_url[:80] + '...' if image_url and len(image_url) > 80 else image_url
                                })
                            elif hasattr(item, 'url'):
                                image_url = item.url
                                logger.debug(f"[OpenAI Client] Extracted image_url from item.url", extra={
                                    'job_id': job_id,
                                    'item_index': item_idx,
                                    'image_url_preview': image_url[:80] + '...' if image_url and len(image_url) > 80 else image_url
                                })
                            elif hasattr(item, 'image'):
                                logger.debug(f"[OpenAI Client] Item has 'image' attribute, checking nested structure", extra={
                                    'job_id': job_id,
                                    'item_index': item_idx,
                                    'image_type': type(item.image).__name__
                                })
                                # If image is an object, try to get URL from it
                                image_obj = item.image
                                if isinstance(image_obj, dict):
                                    image_url = image_obj.get('url') or image_obj.get('image_url')
                                    logger.debug(f"[OpenAI Client] Extracted from image dict", extra={
                                        'job_id': job_id,
                                        'item_index': item_idx,
                                        'image_url_preview': image_url[:80] + '...' if image_url and len(image_url) > 80 else image_url,
                                        'dict_keys': list(image_obj.keys()) if isinstance(image_obj, dict) else None
                                    })
                                elif hasattr(image_obj, 'url'):
                                    image_url = image_obj.url
                                    logger.debug(f"[OpenAI Client] Extracted from image_obj.url", extra={
                                        'job_id': job_id,
                                        'item_index': item_idx,
                                        'image_url_preview': image_url[:80] + '...' if image_url and len(image_url) > 80 else image_url
                                    })
                                elif hasattr(image_obj, 'image_url'):
                                    image_url = image_obj.image_url
                                    logger.debug(f"[OpenAI Client] Extracted from image_obj.image_url", extra={
                                        'job_id': job_id,
                                        'item_index': item_idx,
                                        'image_url_preview': image_url[:80] + '...' if image_url and len(image_url) > 80 else image_url
                                    })
                                else:
                                    logger.warning(f"[OpenAI Client] Item.image exists but no URL found", extra={
                                        'job_id': job_id,
                                        'item_index': item_idx,
                                        'image_obj_attrs': [attr for attr in dir(image_obj) if not attr.startswith('_')]
                                    })
                            else:
                                logger.warning(f"[OpenAI Client] Image type item has no image_url, url, or image attribute", extra={
                                    'job_id': job_id,
                                    'item_index': item_idx,
                                    'item_attrs': [attr for attr in dir(item) if not attr.startswith('_')]
                                })
                            
                            if image_url:
                                image_urls.append(image_url)
                                logger.info(f"[OpenAI Client] Successfully extracted image URL from output item {item_idx}", extra={
                                    'job_id': job_id,
                                    'item_index': item_idx,
                                    'image_url': image_url,
                                    'total_extracted': len(image_urls)
                                })
                            else:
                                logger.warning(f"[OpenAI Client] Failed to extract image URL from image type item", extra={
                                    'job_id': job_id,
                                    'item_index': item_idx
                                })
                        
                        # Check for image_generation_call type (Responses API format)
                        is_image_gen_call = (item_type == 'image_generation_call' or 
                                           item_type_str == 'image_generation_call' or
                                           (hasattr(item_type, 'value') and item_type.value == 'image_generation_call'))
                        
                        if is_image_gen_call:
                            logger.info(f"[OpenAI Client] Found image_generation_call type item at index {item_idx}", extra={
                                'job_id': job_id,
                                'item_index': item_idx
                            })
                            
                            # Extract base64 image data from result
                            result = None
                            if hasattr(item, 'result'):
                                result = item.result
                                logger.debug(f"[OpenAI Client] Found result attribute in image_generation_call", extra={
                                    'job_id': job_id,
                                    'item_index': item_idx,
                                    'result_type': type(result).__name__,
                                    'result_length': len(result) if isinstance(result, str) else None
                                })
                            
                            if result:
                                # Result is base64 encoded image data
                                if isinstance(result, str):
                                    logger.info(f"[OpenAI Client] Processing base64 image data from image_generation_call", extra={
                                        'job_id': job_id,
                                        'item_index': item_idx,
                                        'result_length': len(result),
                                        'has_image_handler': image_handler is not None
                                    })
                                    
                                    # Convert base64 to image URL using image_handler
                                    if image_handler:
                                        try:
                                            # Create a data URL from base64
                                            base64_data_url = f"data:image/png;base64,{result}"
                                            converted_url = image_handler.convert_base64_to_url(
                                                base64_data_url,
                                                tenant_id=tenant_id,
                                                job_id=job_id
                                            )
                                            if converted_url:
                                                image_urls.append(converted_url)
                                                logger.info(f"[OpenAI Client] Successfully converted base64 image from image_generation_call to URL", extra={
                                                    'job_id': job_id,
                                                    'item_index': item_idx,
                                                    'image_url': converted_url,
                                                    'total_extracted': len(image_urls)
                                                })
                                            else:
                                                logger.warning(f"[OpenAI Client] Failed to convert base64 image to URL", extra={
                                                    'job_id': job_id,
                                                    'item_index': item_idx
                                                })
                                        except Exception as e:
                                            logger.error(f"[OpenAI Client] Error converting base64 image from image_generation_call: {e}", exc_info=True, extra={
                                                'job_id': job_id,
                                                'item_index': item_idx,
                                                'error_type': type(e).__name__,
                                                'error_message': str(e)
                                            })
                                    else:
                                        logger.warning(f"[OpenAI Client] No image_handler available to convert base64 image", extra={
                                            'job_id': job_id,
                                            'item_index': item_idx
                                        })
                                else:
                                    logger.warning(f"[OpenAI Client] Result is not a string (expected base64)", extra={
                                        'job_id': job_id,
                                        'item_index': item_idx,
                                        'result_type': type(result).__name__
                                    })
                            else:
                                logger.warning(f"[OpenAI Client] image_generation_call has no result attribute", extra={
                                    'job_id': job_id,
                                    'item_index': item_idx,
                                    'item_attrs': [attr for attr in dir(item) if not attr.startswith('_')]
                                })
                        
                        # Also check for tool_call items that might contain image results
                        is_tool_call = (item_type == 'tool_call' or 
                                       item_type == 'tool_calls' or 
                                       item_type_str == 'tool_call' or 
                                       item_type_str == 'tool_calls' or
                                       (hasattr(item_type, 'value') and item_type.value in ['tool_call', 'tool_calls']))
                        
                        if is_tool_call:
                            logger.info(f"[OpenAI Client] Found tool_call type item at index {item_idx}", extra={
                                'job_id': job_id,
                                'item_index': item_idx,
                                'item_type': item_type
                            })
                            
                            # Check if this is an image_generation tool call
                            tool_name = None
                            if hasattr(item, 'name'):
                                tool_name = item.name
                            elif hasattr(item, 'tool_name'):
                                tool_name = item.tool_name
                            
                            logger.debug(f"[OpenAI Client] Tool call item has name: {tool_name}", extra={
                                'job_id': job_id,
                                'item_index': item_idx,
                                'tool_name': tool_name
                            })
                            
                            if tool_name == 'image_generation':
                                logger.info(f"[OpenAI Client] Found image_generation tool call at index {item_idx}", extra={
                                    'job_id': job_id,
                                    'item_index': item_idx
                                })
                                
                                # Extract image URLs from tool call result
                                result = None
                                if hasattr(item, 'result'):
                                    result = item.result
                                    logger.debug(f"[OpenAI Client] Found result attribute in tool_call", extra={
                                        'job_id': job_id,
                                        'item_index': item_idx,
                                        'result_type': type(result).__name__
                                    })
                                elif hasattr(item, 'output'):
                                    result = item.output
                                    logger.debug(f"[OpenAI Client] Found output attribute in tool_call", extra={
                                        'job_id': job_id,
                                        'item_index': item_idx,
                                        'output_type': type(result).__name__
                                    })
                                
                                if result:
                                    logger.info(f"[OpenAI Client] Processing tool_call result", extra={
                                        'job_id': job_id,
                                        'item_index': item_idx,
                                        'result_type': type(result).__name__,
                                        'result_is_list': isinstance(result, list),
                                        'result_length': len(result) if isinstance(result, list) else None
                                    })
                                    
                                    # Result might be a list of images or a single image
                                    if isinstance(result, list):
                                        logger.info(f"[OpenAI Client] Result is a list with {len(result)} items", extra={
                                            'job_id': job_id,
                                            'item_index': item_idx,
                                            'result_length': len(result)
                                        })
                                        for img_idx, img in enumerate(result):
                                            img_url = None
                                            if isinstance(img, dict):
                                                img_url = img.get('url') or img.get('image_url')
                                                logger.debug(f"[OpenAI Client] Extracted from img dict", extra={
                                                    'job_id': job_id,
                                                    'item_index': item_idx,
                                                    'img_index': img_idx,
                                                    'img_url_preview': img_url[:80] + '...' if img_url and len(img_url) > 80 else img_url,
                                                    'dict_keys': list(img.keys()) if isinstance(img, dict) else None
                                                })
                                            elif hasattr(img, 'url'):
                                                img_url = img.url
                                                logger.debug(f"[OpenAI Client] Extracted from img.url", extra={
                                                    'job_id': job_id,
                                                    'item_index': item_idx,
                                                    'img_index': img_idx,
                                                    'img_url_preview': img_url[:80] + '...' if img_url and len(img_url) > 80 else img_url
                                                })
                                            elif hasattr(img, 'image_url'):
                                                img_url = img.image_url
                                                logger.debug(f"[OpenAI Client] Extracted from img.image_url", extra={
                                                    'job_id': job_id,
                                                    'item_index': item_idx,
                                                    'img_index': img_idx,
                                                    'image_url_preview': img_url[:80] + '...' if img_url and len(img_url) > 80 else img_url
                                                })
                                            else:
                                                logger.warning(f"[OpenAI Client] Image item has no URL", extra={
                                                    'job_id': job_id,
                                                    'item_index': item_idx,
                                                    'img_index': img_idx,
                                                    'img_type': type(img).__name__,
                                                    'img_attrs': [attr for attr in dir(img) if not attr.startswith('_')] if hasattr(img, '__dict__') else None
                                                })
                                            
                                            if img_url:
                                                image_urls.append(img_url)
                                                logger.info(f"[OpenAI Client] Extracted image URL from tool_call result list item {img_idx}", extra={
                                                    'job_id': job_id,
                                                    'item_index': item_idx,
                                                    'img_index': img_idx,
                                                    'image_url': img_url,
                                                    'total_extracted': len(image_urls)
                                                })
                                    else:
                                        logger.info(f"[OpenAI Client] Result is a single item (not list)", extra={
                                            'job_id': job_id,
                                            'item_index': item_idx,
                                            'result_type': type(result).__name__
                                        })
                                        # Single image result
                                        img_url = None
                                        if isinstance(result, dict):
                                            img_url = result.get('url') or result.get('image_url')
                                            logger.debug(f"[OpenAI Client] Extracted from result dict", extra={
                                                'job_id': job_id,
                                                'item_index': item_idx,
                                                'img_url_preview': img_url[:80] + '...' if img_url and len(img_url) > 80 else img_url,
                                                'dict_keys': list(result.keys()) if isinstance(result, dict) else None
                                            })
                                        elif hasattr(result, 'url'):
                                            img_url = result.url
                                            logger.debug(f"[OpenAI Client] Extracted from result.url", extra={
                                                'job_id': job_id,
                                                'item_index': item_idx,
                                                'img_url_preview': img_url[:80] + '...' if img_url and len(img_url) > 80 else img_url
                                            })
                                        elif hasattr(result, 'image_url'):
                                            img_url = result.image_url
                                            logger.debug(f"[OpenAI Client] Extracted from result.image_url", extra={
                                                'job_id': job_id,
                                                'item_index': item_idx,
                                                'img_url_preview': img_url[:80] + '...' if img_url and len(img_url) > 80 else img_url
                                            })
                                        else:
                                            logger.warning(f"[OpenAI Client] Result has no URL", extra={
                                                'job_id': job_id,
                                                'item_index': item_idx,
                                                'result_attrs': [attr for attr in dir(result) if not attr.startswith('_')] if hasattr(result, '__dict__') else None
                                            })
                                        
                                        if img_url:
                                            image_urls.append(img_url)
                                            logger.info(f"[OpenAI Client] Extracted image URL from tool_call result", extra={
                                                'job_id': job_id,
                                                'item_index': item_idx,
                                                'image_url': img_url,
                                                'total_extracted': len(image_urls)
                                            })
                                else:
                                    logger.warning(f"[OpenAI Client] Tool call has no result or output attribute", extra={
                                        'job_id': job_id,
                                        'item_index': item_idx,
                                        'item_attrs': [attr for attr in dir(item) if not attr.startswith('_')]
                                    })
                            else:
                                logger.debug(f"[OpenAI Client] Tool call is not image_generation (name: {tool_name})", extra={
                                    'job_id': job_id,
                                    'item_index': item_idx,
                                    'tool_name': tool_name
                                })
                    else:
                        logger.debug(f"[OpenAI Client] Output item {item_idx} has no 'type' attribute", extra={
                            'job_id': job_id,
                            'item_index': item_idx,
                            'item_attrs': [attr for attr in dir(item) if not attr.startswith('_')]
                        })
            else:
                logger.info("[OpenAI Client] Response has no 'output' attribute or output is empty", extra={
                    'job_id': job_id,
                    'has_output_attr': hasattr(response, 'output'),
                    'output_value': response.output if hasattr(response, 'output') else None
                })
            
            # Also check response.tool_calls if it exists (alternative response structure)
            if hasattr(response, 'tool_calls') and response.tool_calls:
                logger.info("[OpenAI Client] Checking response.tool_calls for image URLs", extra={
                    'job_id': job_id,
                    'tool_calls_length': len(response.tool_calls) if isinstance(response.tool_calls, list) else None
                })
                
                for tool_call_idx, tool_call in enumerate(response.tool_calls):
                    logger.debug(f"[OpenAI Client] Processing tool_call {tool_call_idx}", extra={
                        'job_id': job_id,
                        'tool_call_index': tool_call_idx,
                        'has_type_attr': hasattr(tool_call, 'type'),
                        'tool_call_type': getattr(tool_call, 'type', None) if hasattr(tool_call, 'type') else None
                    })
                    
                    if hasattr(tool_call, 'type') and tool_call.type == 'image_generation':
                        logger.info(f"[OpenAI Client] Found image_generation tool_call at index {tool_call_idx}", extra={
                            'job_id': job_id,
                            'tool_call_index': tool_call_idx
                        })
                        
                        # Extract image URLs from tool call
                        if hasattr(tool_call, 'output'):
                            output = tool_call.output
                            logger.debug(f"[OpenAI Client] Tool call has output attribute", extra={
                                'job_id': job_id,
                                'tool_call_index': tool_call_idx,
                                'output_type': type(output).__name__,
                                'output_is_list': isinstance(output, list),
                                'output_length': len(output) if isinstance(output, list) else None
                            })
                            
                            if isinstance(output, list):
                                logger.info(f"[OpenAI Client] Tool call output is a list with {len(output)} items", extra={
                                    'job_id': job_id,
                                    'tool_call_index': tool_call_idx,
                                    'output_length': len(output)
                                })
                                
                                for img_idx, img in enumerate(output):
                                    img_url = None
                                    if isinstance(img, dict):
                                        img_url = img.get('url') or img.get('image_url')
                                        logger.debug(f"[OpenAI Client] Extracted from img dict in tool_calls", extra={
                                            'job_id': job_id,
                                            'tool_call_index': tool_call_idx,
                                            'img_index': img_idx,
                                            'img_url_preview': img_url[:80] + '...' if img_url and len(img_url) > 80 else img_url,
                                            'dict_keys': list(img.keys()) if isinstance(img, dict) else None
                                        })
                                    elif hasattr(img, 'url'):
                                        img_url = img.url
                                        logger.debug(f"[OpenAI Client] Extracted from img.url in tool_calls", extra={
                                            'job_id': job_id,
                                            'tool_call_index': tool_call_idx,
                                            'img_index': img_idx,
                                            'img_url_preview': img_url[:80] + '...' if img_url and len(img_url) > 80 else img_url
                                        })
                                    
                                    if img_url:
                                        image_urls.append(img_url)
                                        logger.info(f"[OpenAI Client] Extracted image URL from tool_calls output list item {img_idx}", extra={
                                            'job_id': job_id,
                                            'tool_call_index': tool_call_idx,
                                            'img_index': img_idx,
                                            'image_url': img_url,
                                            'total_extracted': len(image_urls)
                                        })
                            else:
                                logger.warning(f"[OpenAI Client] Tool call output is not a list", extra={
                                    'job_id': job_id,
                                    'tool_call_index': tool_call_idx,
                                    'output_type': type(output).__name__
                                })
                        else:
                            logger.warning(f"[OpenAI Client] Tool call has no output attribute", extra={
                                'job_id': job_id,
                                'tool_call_index': tool_call_idx,
                                'tool_call_attrs': [attr for attr in dir(tool_call) if not attr.startswith('_')]
                            })
            else:
                logger.info("[OpenAI Client] Response has no 'tool_calls' attribute or tool_calls is empty", extra={
                    'job_id': job_id,
                    'has_tool_calls_attr': hasattr(response, 'tool_calls'),
                    'tool_calls_value': response.tool_calls if hasattr(response, 'tool_calls') else None
                })
            
            # Add base64-converted URLs to the image_urls list
            logger.info("[OpenAI Client] Adding base64-converted URLs to image_urls", extra={
                'job_id': job_id,
                'base64_urls_count': len(base64_image_urls),
                'extracted_urls_count': len(image_urls),
                'base64_urls': base64_image_urls
            })
            image_urls.extend(base64_image_urls)
            
            if image_urls:
                logger.info(f"[OpenAI Client] Successfully extracted {len(image_urls)} image URL(s) from response", extra={
                    'job_id': job_id,
                    'image_count': len(image_urls),
                    'base64_converted_count': len(base64_image_urls),
                    'extracted_from_output_count': len(image_urls) - len(base64_image_urls),
                    'image_urls': image_urls,
                    'has_image_generation_tool': any(
                        isinstance(t, dict) and t.get('type') == 'image_generation' 
                        for t in tools
                    ) if tools else False
                })
            else:
                logger.warning("[OpenAI Client] No image URLs extracted from response", extra={
                    'job_id': job_id,
                    'has_image_generation_tool': any(
                        isinstance(t, dict) and t.get('type') == 'image_generation' 
                        for t in tools
                    ) if tools else False,
                    'has_output': hasattr(response, 'output'),
                    'has_tool_calls': hasattr(response, 'tool_calls'),
                    'base64_urls_count': len(base64_image_urls)
                })
        except Exception as e:
            logger.error(f"[OpenAI Client] Error extracting image URLs from response: {e}", exc_info=True, extra={
                'job_id': job_id,
                'error_type': type(e).__name__,
                'error_message': str(e),
                'base64_urls_count': len(base64_image_urls)
            })
            # Don't fail the request if image extraction fails, just log it
            # Still include base64-converted URLs if available
            image_urls.extend(base64_image_urls)
            logger.info("[OpenAI Client] Added base64 URLs after extraction error", extra={
                'job_id': job_id,
                'final_image_urls_count': len(image_urls)
            })
        
        response_details = {
            "output_text": content,
            "image_urls": image_urls,
            "usage": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens
            },
            "model": model
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
