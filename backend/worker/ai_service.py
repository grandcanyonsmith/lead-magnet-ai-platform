"""
AI Service
Handles OpenAI API interactions for report generation and HTML rewriting.
"""

import os
import logging
from typing import Optional, Dict, Tuple, List, Any
import boto3
import json
import base64
from ulid import new as ulid
from openai import OpenAI
from cost_service import calculate_openai_cost
from s3_service import S3Service

logger = logging.getLogger(__name__)


class AIService:
    """Service for AI-powered content generation."""
    
    def __init__(self):
        """Initialize OpenAI client with API key from Secrets Manager."""
        self.openai_api_key = self._get_openai_key()
        self.client = OpenAI(api_key=self.openai_api_key)
        self.s3_service = S3Service()
    
    def _get_openai_key(self) -> str:
        """Get OpenAI API key from AWS Secrets Manager."""
        secret_name = os.environ.get('OPENAI_SECRET_NAME', 'leadmagnet/openai-api-key')
        region = os.environ.get('AWS_REGION', 'us-east-1')
        
        logger.info(f"[OpenAI Key] Retrieving API key from Secrets Manager", extra={
            'secret_name': secret_name,
            'region': region
        })
        
        # Create a Secrets Manager client
        session = boto3.session.Session()
        client = session.client(
            service_name='secretsmanager',
            region_name=region
        )
        
        try:
            logger.debug(f"[OpenAI Key] Calling get_secret_value for secret: {secret_name}")
            response = client.get_secret_value(SecretId=secret_name)
            
            # Parse the secret value
            if 'SecretString' in response:
                secret = response['SecretString']
                logger.debug(f"[OpenAI Key] Secret retrieved successfully, length: {len(secret)}")
                # Handle both plain string and JSON format
                try:
                    secret_dict = json.loads(secret)
                    api_key = secret_dict.get('api_key', secret)
                    logger.info(f"[OpenAI Key] Successfully parsed JSON secret, API key length: {len(api_key) if api_key else 0}")
                    return api_key
                except json.JSONDecodeError:
                    logger.debug(f"[OpenAI Key] Secret is plain string format, using directly")
                    return secret
            else:
                logger.error(f"[OpenAI Key] Secret binary format not supported")
                raise ValueError("Secret binary format not supported")
                
        except Exception as e:
            logger.error(f"[OpenAI Key] Failed to retrieve OpenAI API key from Secrets Manager", extra={
                'secret_name': secret_name,
                'region': region,
                'error_type': type(e).__name__,
                'error_message': str(e)
            }, exc_info=True)
            raise
    
    def _is_o3_model(self, model: str) -> bool:
        """Check if model is an o3 model."""
        return (
            model.startswith('o3') or 
            'o3-deep-research' in model.lower() or
            model.lower() == 'o3-mini' or
            model.lower() == 'o3'
        )
    
    @staticmethod
    def _default_tool() -> Dict[str, str]:
        """Return a fresh default tool configuration."""
        return {"type": "web_search_preview"}
    
    def _has_tool_type(self, tools: List[Dict], tool_type: str) -> bool:
        """Check if a specific tool type exists in the tools list."""
        return any(
            (isinstance(t, dict) and t.get("type") == tool_type) or 
            (isinstance(t, str) and t == tool_type)
            for t in tools
        )
    
    def _has_computer_use(self, tools: List[Dict]) -> bool:
        """Check if computer_use_preview tool is present."""
        return self._has_tool_type(tools, "computer_use_preview")
    
    def _has_image_generation(self, tools: List[Dict]) -> bool:
        """Check if image_generation tool is present."""
        return self._has_tool_type(tools, "image_generation")
    
    def _ensure_tools_and_choice(self, tools: Optional[List[Dict]], tool_choice: str) -> Tuple[List[Dict], str]:
        """
        Ensure tools list and tool_choice are always in a valid combination.
        """
        normalized_tools: List[Dict] = list(tools) if tools else []
        normalized_choice = tool_choice or "auto"

        if normalized_choice == "none":
            return [], "none"

        if not normalized_tools:
            logger.warning("[AI Service] No tools supplied; adding default web_search_preview tool")
            normalized_tools = [self._default_tool()]
            if normalized_choice == "required":
                logger.warning("[AI Service] tool_choice='required' but no tools provided; downgrading to 'auto'")
                normalized_choice = "auto"

        if normalized_choice == "required" and len(normalized_tools) == 0:
            logger.warning("[AI Service] tool_choice='required' but tools array empty. Changing to 'auto'")
            normalized_choice = "auto"
            normalized_tools = [self._default_tool()]

        return normalized_tools, normalized_choice

    def _normalize_tool(self, tool) -> Tuple[str, Dict]:
        """Normalize a tool to dict format and extract tool type."""
        tool_type = tool.get("type") if isinstance(tool, dict) else tool
        tool_dict = tool.copy() if isinstance(tool, dict) else {"type": tool}
        return tool_type, tool_dict
    
    def _normalize_container(self, container: Any, tool_type: str) -> Optional[Dict]:
        """Normalize container parameter to dict format."""
        if not container:
            return None
        elif isinstance(container, str):
            if container.strip() == "":
                return None
            return {"type": "auto"} if container.strip() == "auto" else {"id": container.strip()}
        elif isinstance(container, dict):
            return container
        else:
            return None
    
    def _validate_container_tool(self, tool_dict: Dict, tool_type: str) -> Optional[Dict]:
        """Validate and normalize container tool (code_interpreter or computer_use_preview)."""
        container = tool_dict.get("container")
        normalized_container = self._normalize_container(container, tool_type)
        
        if not normalized_container:
            if tool_type == "code_interpreter":
                # Auto-add container for code_interpreter
                tool_dict["container"] = {"type": "auto"}
                logger.info(f"Auto-added container for code_interpreter tool")
                return tool_dict
            else:
                # computer_use_preview requires container
                logger.warning(f"Skipping {tool_type} tool - container parameter is REQUIRED but not provided. Tool config: {tool_dict}")
                return None
        
        tool_dict["container"] = normalized_container
        if isinstance(container, str):
            logger.info(f"Converted {tool_type} container string to dict: {normalized_container}")
        return tool_dict
    
    def _validate_file_search_tool(self, tool_dict: Dict) -> Optional[Dict]:
        """Validate file_search tool has vector_store_ids."""
        vector_store_ids = tool_dict.get("vector_store_ids")
        if not vector_store_ids or (isinstance(vector_store_ids, list) and len(vector_store_ids) == 0):
            logger.warning(f"Skipping file_search tool - vector_store_ids not provided or empty")
            return None
        return tool_dict
    
    def _filter_invalid_tools(self, tools: List) -> List[Dict]:
        """Filter out tools that require additional configuration we don't have."""
        filtered_tools = []
        for tool in tools:
            tool_type, tool_dict = self._normalize_tool(tool)
            
            # Validate container tools
            if tool_type in ["code_interpreter", "computer_use_preview"]:
                validated_tool = self._validate_container_tool(tool_dict, tool_type)
                if not validated_tool:
                    continue
                tool_dict = validated_tool
            
            # Validate file_search tool
            if tool_type == "file_search":
                validated_tool = self._validate_file_search_tool(tool_dict)
                if not validated_tool:
                    continue
                tool_dict = validated_tool
            
            filtered_tools.append(tool_dict)
        
        return filtered_tools
    
    def _final_validate_tools(self, filtered_tools: List[Dict]) -> List[Dict]:
        """Final validation pass to ensure no invalid tools made it through."""
        validated_tools = []
        for tool in filtered_tools:
            tool_type, tool_dict = self._normalize_tool(tool)
            
            # Final check for tools requiring containers
            if tool_type in ["code_interpreter", "computer_use_preview"]:
                validated_tool = self._validate_container_tool(tool_dict, tool_type)
                if not validated_tool:
                    logger.error(f"CRITICAL: {tool_type} tool passed initial validation without container! Filtering it out now. tool_dict: {tool_dict}")
                    continue
                tool_dict = validated_tool
            
            # Final check for file_search
            if tool_type == "file_search":
                validated_tool = self._validate_file_search_tool(tool_dict)
                if not validated_tool:
                    logger.error(f"CRITICAL: file_search tool passed initial validation without vector_store_ids! Filtering it out now. tool_dict: {tool_dict}")
                    continue
                tool_dict = validated_tool
            
            validated_tools.append(tool_dict)
        
        return validated_tools
    
    def _validate_and_filter_tools(self, tools: Optional[list], tool_choice: str) -> Tuple[List[Dict], str]:
        """
        Validate and filter tools, ensuring tool_choice='required' never exists with empty tools.
        
        Args:
            tools: List of tool dictionaries or strings
            tool_choice: How model should use tools - "auto", "required", or "none"
            
        Returns:
            Tuple of (validated tools list, normalized tool_choice)
        """
        # Default to web_search_preview if no tools provided (backward compatibility)
        if tools is None or len(tools) == 0:
            tools = [self._default_tool()]
        
        # Filter out invalid tools
        filtered_tools = self._filter_invalid_tools(tools)
        
        # Final validation pass
        validated_tools = self._final_validate_tools(filtered_tools)
        
        # CRITICAL: Check tool_choice='required' BEFORE assigning default tools
        # If tool_choice is 'required' but all tools were filtered out, change to 'auto'
        tools_length = len(validated_tools) if validated_tools else 0
        if tool_choice == "required" and tools_length == 0:
            logger.warning(f"[AI Service] tool_choice is 'required' but tools array is empty (length={tools_length}). Changing tool_choice to 'auto' to prevent API error.", extra={
                'original_tool_choice': tool_choice,
                'validated_tools_count': tools_length,
                'original_tools': [t.get('type') if isinstance(t, dict) else t for t in tools] if tools else []
            })
            tool_choice = "auto"
        
        # If validation removed all tools, use default tool
        # This happens after tool_choice check so we don't force 'required' with only default tool
        validated_tools, normalized_choice = self._ensure_tools_and_choice(validated_tools, tool_choice)
        
        logger.info("[AI Service] Final tools after filtering and validation", extra={
            'tools_count': len(validated_tools),
            'tools': [t.get('type') if isinstance(t, dict) else t for t in validated_tools],
            'tool_choice': normalized_choice
        })
        
        return validated_tools, normalized_choice
    
    def _build_input_text(self, context: str, previous_context: str) -> str:
        """Build input text from context and previous context."""
        full_context = context
        if previous_context:
            full_context = f"{previous_context}\n\n--- Current Step Context ---\n{context}"
        return f"Generate a report based on the following information:\n\n{full_context}"
    
    def _build_api_params(
        self,
        model: str,
        instructions: str,
        input_text: str,
        tools: List[Dict],
        tool_choice: str,
        has_computer_use: bool,
        is_o3_model: bool,
        reasoning_level: Optional[str] = None  # not used; Responses API doesn't support it
    ) -> Dict:
        """
        Build OpenAI API parameters dict (robust against tool_choice/tools mismatches).
        
        Args:
            model: OpenAI model name
            instructions: System instructions
            input_text: User input text
            tools: Validated tools list
            tool_choice: How to use tools
            has_computer_use: Whether computer_use_preview tool is present
            is_o3_model: Whether model is o3
            reasoning_level: Reasoning level for o3 models (None to skip, not supported in Responses API)
            
        Returns:
            Parameters dict for OpenAI API call
        """
        normalized_tools, normalized_choice = self._ensure_tools_and_choice(tools, tool_choice)

        params = {
            "model": model,
            "instructions": instructions,
            "input": input_text,
        }

        logger.debug("[AI Service] Building API params", extra={
            "model": model,
            "tool_choice": normalized_choice,
            "tools_count": len(normalized_tools),
            "tools": [t.get("type") if isinstance(t, dict) else t for t in normalized_tools],
            "has_computer_use": has_computer_use,
        })

        if normalized_choice != "none":
            params["tools"] = normalized_tools
            logger.debug("[AI Service] Using tools", extra={
                "count": len(normalized_tools),
                "tools": [t.get("type") if isinstance(t, dict) else t for t in normalized_tools],
            })

        if has_computer_use:
            params["truncation"] = "auto"
            logger.info("[AI Service] Added truncation='auto' for computer_use_preview tool")

        # Set tool_choice only when it's not "none".
        if normalized_choice != "none":
            tools_in_params = params.get("tools", [])
            if normalized_choice == "required" and not tools_in_params:
                logger.warning("[AI Service] tool_choice='required' but tools empty; downgrading to 'auto' and adding default tool")
                params["tool_choice"] = "auto"
                params["tools"] = [self._default_tool()]
            else:
                params["tool_choice"] = normalized_choice
                logger.debug(f"[AI Service] Set tool_choice='{normalized_choice}' with {len(tools_in_params)} tools")

        # Absolutely final clamp: never send 'required' without tools.
        if params.get("tool_choice") == "required" and not params.get("tools"):
            logger.warning("[AI Service] Final clamp: switching 'required' → 'auto' and adding default tool")
            params["tool_choice"] = "auto"
            params["tools"] = [self._default_tool()]

        logger.debug("[AI Service] Final params before API call", extra={
            "has_tools": "tools" in params,
            "tools_count": len(params.get("tools", [])) if "tools" in params else 0,
            "has_tool_choice": "tool_choice" in params,
            "tool_choice_value": params.get("tool_choice"),
            "model": model,
            "has_truncation": "truncation" in params
        })
        return params
    
    def _parse_data_uri(self, base64_data: str) -> Tuple[str, str, str]:
        """
        Parse data URI format and extract content type and base64 data.
        
        Args:
            base64_data: Base64 data string, potentially with data URI prefix
            
        Returns:
            Tuple of (base64_data, content_type, file_ext)
        """
        content_type = 'image/png'  # default
        file_ext = 'png'
        
        if base64_data.startswith('data:'):
            # Extract content type and base64 data from data URI
            parts = base64_data.split(',', 1)
            if len(parts) == 2:
                header = parts[0]
                base64_data = parts[1]
                # Extract content type from header: data:image/png;base64
                if 'image/' in header:
                    img_type = header.split('image/')[1].split(';')[0]
                    content_type = f'image/{img_type}'
                    file_ext = img_type if img_type in ['png', 'jpeg', 'jpg', 'gif', 'webp'] else 'png'
        
        return base64_data, content_type, file_ext
    
    def _upload_base64_image_to_s3(self, base64_data: str, content_type: str) -> Optional[str]:
        """
        Upload base64 encoded image to S3 and return public URL.
        
        Args:
            base64_data: Base64 encoded image data
            content_type: MIME type of the image
            
        Returns:
            Public URL of uploaded image, or None if upload fails
        """
        try:
            logger.info(f"ImageGenerationCall.result is base64 (length={len(base64_data)}), uploading to S3")
            
            # Parse data URI if present
            base64_data, content_type, file_ext = self._parse_data_uri(base64_data)
            
            # Decode base64 to binary
            image_bytes = base64.b64decode(base64_data)
            
            # Generate S3 key for image
            image_id = str(ulid())
            s3_key = f"images/{image_id}.{file_ext}"
            
            # Upload to S3 and get URL
            _, public_url = self.s3_service.upload_image(
                key=s3_key,
                image_data=image_bytes,
                content_type=content_type,
                public=True
            )
            
            logger.info(f"Uploaded base64 image to S3: {public_url}")
            return public_url
        except Exception as upload_error:
            logger.error(f"Failed to upload base64 image to S3: {upload_error}", exc_info=True)
            return None
    
    def _extract_url_from_image_generation_call(self, item: Any) -> Optional[str]:
        """
        Extract image URL from a single ImageGenerationCall item.
        
        Args:
            item: ImageGenerationCall object from OpenAI response
            
        Returns:
            Image URL if found, None otherwise
        """
        # Check if there's a URL field (might be added dynamically)
        if hasattr(item, 'url') and item.url:
            logger.info(f"Found image URL from ImageGenerationCall.url: {item.url}")
            return item.url
        
        if hasattr(item, 'image_url') and item.image_url:
            logger.info(f"Found image URL from ImageGenerationCall.image_url: {item.image_url}")
            return item.image_url
        
        # Check if result might be a URL (though docs say it's base64)
        if hasattr(item, 'result') and item.result:
            if item.result.startswith('http'):
                logger.info(f"Found image URL from ImageGenerationCall.result: {item.result}")
                return item.result
            else:
                # result is base64 - decode and upload to S3 to get a URL
                return self._upload_base64_image_to_s3(item.result, 'image/png')
        
        return None
    
    def _log_missing_images(self, response: Any, tools: List[Dict]) -> None:
        """Log debugging information when images are expected but not found."""
        logger.warning(f"image_generation tool was used but no image URLs found. Response.output length: {len(response.output) if hasattr(response, 'output') and response.output else 0}")
        if hasattr(response, 'output') and response.output:
            for idx, item in enumerate(response.output):
                logger.warning(f"output[{idx}]: type={getattr(item, 'type', 'unknown')}, attributes={[attr for attr in dir(item) if not attr.startswith('_')]}")
                if hasattr(item, 'type') and item.type == 'image_generation_call':
                    try:
                        if hasattr(item, 'model_dump'):
                            logger.warning(f"ImageGenerationCall full dump: {item.model_dump()}")
                    except Exception:
                        pass
    
    def _extract_image_urls(self, response: Any, tools: List[Dict]) -> List[str]:
        """
        Extract image URLs from OpenAI response if image_generation tool was used.
        
        Args:
            response: OpenAI API response object
            tools: List of tools used in the request
            
        Returns:
            List of image URLs
        """
        image_urls = []
        try:
            # OpenAI Responses API returns `output` array (not `output_items`)
            # Each item can be of various types including ImageGenerationCall
            # ImageGenerationCall has: type="image_generation_call", result (base64), status
            if hasattr(response, 'output') and response.output:
                logger.info(f"Found output: {len(response.output)} items")
                for idx, item in enumerate(response.output):
                    # Check if item is an ImageGenerationCall
                    if hasattr(item, 'type') and item.type == 'image_generation_call':
                        logger.info(f"Found ImageGenerationCall at output[{idx}]: status={getattr(item, 'status', 'unknown')}")
                        # Log all attributes to see what's available
                        item_attrs = [attr for attr in dir(item) if not attr.startswith('_')]
                        logger.info(f"ImageGenerationCall attributes: {item_attrs}")
                        
                        # Try to get the full item as dict to see all fields
                        try:
                            if hasattr(item, 'model_dump'):
                                item_dict = item.model_dump()
                                logger.info(f"ImageGenerationCall as dict: {json.dumps({k: (v[:100] if isinstance(v, str) and len(v) > 100 else v) for k, v in item_dict.items()}, indent=2, default=str)}")
                            elif hasattr(item, '__dict__'):
                                logger.info(f"ImageGenerationCall __dict__: {item.__dict__}")
                        except Exception as e:
                            logger.warning(f"Could not serialize ImageGenerationCall: {e}")
                        
                        # Extract URL from this ImageGenerationCall
                        url = self._extract_url_from_image_generation_call(item)
                        if url:
                            image_urls.append(url)
            
            # Log if no images found but image_generation tool was used
            has_image_tool = self._has_image_generation(tools)
            if has_image_tool and not image_urls:
                self._log_missing_images(response, tools)
        except Exception as e:
            logger.warning(f"Error extracting image URLs: {e}", exc_info=True)
        
        return image_urls
    
    def _build_usage_info(self, response: Any, model: str, service_type: str) -> Dict:
        """
        Build standardized usage info dictionary from API response.
        
        Args:
            response: OpenAI API response object
            model: Model name used
            service_type: Service type identifier
            
        Returns:
            Usage info dictionary
        """
        usage = response.usage
        cost_data = calculate_openai_cost(
            model,
            usage.input_tokens or 0,
            usage.output_tokens or 0
        )
        
        return {
            'model': model,
            'input_tokens': usage.input_tokens or 0,
            'output_tokens': usage.output_tokens or 0,
            'total_tokens': usage.total_tokens or 0,
            'cost_usd': cost_data['cost_usd'],
            'service_type': service_type,
        }
    
    def _make_api_call(self, params: Dict) -> Any:
        """
        Make OpenAI API call with logging and error handling.
        
        Args:
            params: API parameters dictionary
            
        Returns:
            OpenAI API response object
            
        Raises:
            Exception: If API call fails
        """
        logger.debug("[AI Service] Making OpenAI API call", extra={
            'model': params.get('model'),
            'has_tools': 'tools' in params,
            'tools_count': len(params.get('tools', [])) if 'tools' in params else 0,
            'has_tool_choice': 'tool_choice' in params,
            'tool_choice': params.get('tool_choice')
        })
        
        response = self.client.responses.create(**params)
        
        logger.debug("[AI Service] API call completed successfully", extra={
            'model': params.get('model'),
            'has_output_text': hasattr(response, 'output_text'),
            'output_length': len(response.output_text) if hasattr(response, 'output_text') else 0
        })
        
        return response
    
    def _process_api_response(
        self,
        response: Any,
        model: str,
        instructions: str,
        input_text: str,
        previous_context: str,
        context: str,
        tools: List[Dict],
        tool_choice: str,
        params: Dict
    ) -> Tuple[str, Dict, Dict, Dict]:
        """
        Process OpenAI API response and build return values.
        
        Args:
            response: OpenAI API response object
            model: Model name used
            instructions: System instructions used
            input_text: Input text used
            previous_context: Previous context string
            context: Current context string
            tools: Tools used
            tool_choice: Tool choice used
            params: Parameters dict used for API call
            
        Returns:
            Tuple of (report content, usage info dict, request details dict, response details dict)
        """
        report = response.output_text
        
        # Extract image URLs from tool outputs if image_generation was used
        image_urls = self._extract_image_urls(response, tools)
        
        # Capture request details (after API call to ensure we capture final params)
        request_details = {
            'model': model,
            'instructions': instructions,
            'input': input_text,
            'previous_context': previous_context,  # Contains ALL previous step outputs
            'context': context,  # Current step context (form data for step 0, empty for others)
            'tools': params.get('tools', []),
            'tool_choice': params.get('tool_choice', 'auto'),
            'truncation': params.get('truncation'),
            'reasoning_level': params.get('reasoning_level'),
        }
        
        # If previous_context contains multiple steps, parse and include them separately for clarity
        if previous_context and '===' in previous_context:
            # Extract individual step outputs from previous_context
            step_sections = previous_context.split('===')
            previous_steps = []
            for i in range(1, len(step_sections), 2):
                if i + 1 < len(step_sections):
                    step_header = step_sections[i].strip()
                    step_content = step_sections[i + 1].strip() if i + 1 < len(step_sections) else ""
                    if step_header and step_content:
                        previous_steps.append({
                            'step': step_header,
                            'output': step_content
                        })
            if previous_steps:
                request_details['all_previous_steps'] = previous_steps
        
        # Build usage info
        usage_info = self._build_usage_info(response, model, 'openai_worker_report')
        
        # Log token usage for cost tracking
        usage = response.usage
        logger.info(
            f"[AI Service] Report generation completed successfully",
            extra={
                'model': model,
                'total_tokens': usage_info['total_tokens'],
                'input_tokens': usage_info['input_tokens'],
                'output_tokens': usage_info['output_tokens'],
                'cost_usd': usage_info['cost_usd'],
                'output_length': len(report),
                'images_generated': len(image_urls),
                'image_urls': image_urls[:3] if image_urls else []  # Log first 3 URLs
            }
        )
        
        # Capture response details including image URLs
        response_details = {
            'output_text': report,
            'image_urls': image_urls,  # Add image URLs
            'usage': {
                'input_tokens': usage.input_tokens or 0,
                'output_tokens': usage.output_tokens or 0,
                'total_tokens': usage.total_tokens or 0,
            },
            'model': getattr(response, 'model', model),
        }
        
        return report, usage_info, request_details, response_details
    
    def _classify_error(self, error_message: str) -> str:
        """
        Classify error message into error category.
        
        Args:
            error_message: Error message string
            
        Returns:
            Error category string
        """
        error_lower = error_message.lower()
        if "API key" in error_message or "authentication" in error_lower:
            return "authentication"
        elif "rate limit" in error_lower or "quota" in error_lower:
            return "rate_limit"
        elif "tool_choice" in error_lower and "required" in error_lower and "tools" in error_lower:
            return "tool_choice_config"
        elif "model" in error_lower and "not found" in error_lower:
            return "model_not_found"
        elif "timeout" in error_lower:
            return "timeout"
        elif "connection" in error_lower:
            return "connection"
        else:
            return "unknown"
    
    def _create_error_exception(self, error_category: str, error_type: str, error_message: str, model: str, tools: List[Dict], tool_choice: str) -> Exception:
        """
        Create standardized exception based on error category.
        
        Args:
            error_category: Category of error
            error_type: Type name of the exception
            error_message: Original error message
            model: Model name used
            tools: Tools used
            tool_choice: Tool choice used
            
        Returns:
            Exception object with appropriate message
        """
        if error_category == "authentication":
            logger.error(f"[AI Service] Authentication error - check API key configuration")
            return Exception(f"OpenAI API authentication failed. Please check your API key configuration: {error_message}")
        elif error_category == "rate_limit":
            logger.warning(f"[AI Service] Rate limit exceeded - request should be retried")
            return Exception(f"OpenAI API rate limit exceeded. Please try again later: {error_message}")
        elif error_category == "tool_choice_config":
            logger.error(f"[AI Service] Invalid tool_choice configuration - tool_choice='required' but tools empty", extra={
                'error_message': error_message,
                'error_type': error_type,
                'tool_choice': tool_choice,
                'tools_count': len(tools) if tools else 0,
                'tools': [t.get('type') if isinstance(t, dict) else t for t in tools] if tools else []
            })
            return Exception(f"OpenAI API error: Invalid workflow configuration. Tool choice 'required' was specified but no tools are available. This has been automatically fixed - please try again. Original error: {error_message}")
        elif error_category == "model_not_found":
            logger.error(f"[AI Service] Invalid model specified: {model}")
            return Exception(f"Invalid AI model specified. Please check your workflow configuration: {error_message}")
        elif error_category == "timeout":
            logger.warning(f"[AI Service] Request timeout - request took too long")
            return Exception(f"OpenAI API request timed out. The request took too long to complete: {error_message}")
        elif error_category == "connection":
            logger.error(f"[AI Service] Connection error - network issue")
            return Exception(f"Unable to connect to OpenAI API. Please check your network connection: {error_message}")
        else:
            logger.error(f"[AI Service] Unexpected API error: {error_type}")
            return Exception(f"OpenAI API error ({error_type}): {error_message}")
    
    def _retry_without_required_tool_choice(
        self,
        model: str,
        tools: List[Dict],
        instructions: str,
        context: str,
        previous_context: str,
        is_o3_model: bool
    ) -> Optional[Tuple[str, Dict, Dict, Dict]]:
        """
        Retry API call without 'required' tool_choice.
        
        Returns:
            Tuple of (report, usage_info, request_details, response_details) if successful, None if retry fails
        """
        logger.warning("[AI Service] Recovering from 'required' without tools by retrying with tool_choice='auto' and a default tool")
        try:
            retry_tools, retry_choice = self._ensure_tools_and_choice(tools, "auto")
            input_text = self._build_input_text(context, previous_context)
            params_retry = self._build_api_params(
                model=model,
                instructions=instructions,
                input_text=input_text,
                tools=retry_tools,
                tool_choice=retry_choice,
                has_computer_use=self._has_computer_use(retry_tools),
                is_o3_model=is_o3_model,
                reasoning_level=None
            )
            response = self._make_api_call(params_retry)
            return self._process_api_response(
                response=response,
                model=model,
                instructions=instructions,
                input_text=input_text,
                previous_context=previous_context,
                context=context,
                tools=retry_tools,
                tool_choice=retry_choice,
                params=params_retry
            )
        except Exception:
            return None
    
    def _retry_without_reasoning_level(
        self,
        model: str,
        tools: List[Dict],
        tool_choice: str,
        instructions: str,
        context: str,
        previous_context: str,
        is_o3_model: bool
    ) -> Optional[Tuple[str, Dict, Dict, Dict]]:
        """
        Retry API call without reasoning_level parameter.
        
        Returns:
            Tuple of (report, usage_info, request_details, response_details) if successful, None if retry fails
        """
        logger.warning(f"reasoning_level parameter not supported for o3 model, retrying without it")
        try:
            # Re-validate tools and tool_choice for retry
            retry_tools, retry_tool_choice = self._validate_and_filter_tools(tools, tool_choice)
            
            # Check if computer_use_preview is in tools (requires truncation="auto")
            has_computer_use = self._has_computer_use(retry_tools)
            
            # Build params without reasoning_level
            input_text = self._build_input_text(context, previous_context)
            params_no_reasoning = self._build_api_params(
                model=model,
                instructions=instructions,
                input_text=input_text,
                tools=retry_tools,
                tool_choice=retry_tool_choice,
                has_computer_use=has_computer_use,
                is_o3_model=is_o3_model,
                reasoning_level=None  # Skip reasoning_level for retry
            )
            
            response = self._make_api_call(params_no_reasoning)
            
            # Process response
            report, usage_info, request_details, response_details = self._process_api_response(
                response=response,
                model=model,
                instructions=instructions,
                input_text=input_text,
                previous_context=previous_context,
                context=context,
                tools=retry_tools,
                tool_choice=retry_tool_choice or "auto",
                params=params_no_reasoning
            )
            
            logger.info(
                f"Report generation completed (without reasoning_level). "
                f"Tokens: {usage_info['total_tokens']} "
                f"(input: {usage_info['input_tokens']}, output: {usage_info['output_tokens']})"
                + (f" Images generated: {len(response_details.get('image_urls', []))}" if response_details.get('image_urls') else "")
            )
            
            return report, usage_info, request_details, response_details
        except Exception:
            return None
    
    def _handle_openai_error(
        self,
        error: Exception,
        model: str,
        tools: List[Dict],
        tool_choice: str,
        instructions: str,
        context: str,
        is_o3_model: bool,
        full_context: str,
        previous_context: str
    ) -> Tuple[str, Dict, Dict, Dict]:
        """
        Handle OpenAI API errors with retry logic for reasoning_level errors and tool_choice errors.
        
        Args:
            error: The exception that occurred
            model: Model name used
            tools: Tools used
            tool_choice: Tool choice used
            instructions: System instructions used
            context: Current context
            is_o3_model: Whether model is o3
            full_context: Full context string
            previous_context: Previous context string
            
        Returns:
            Tuple of (report content, usage info dict, request details dict, response details dict)
            
        Raises:
            Exception: If error cannot be handled or retry fails
        """
        error_type = type(error).__name__
        error_message = str(error)
        
        # Special recovery: API complained about 'required' without 'tools'
        if "Tool choice 'required' must be specified with 'tools' parameter" in error_message:
            result = self._retry_without_required_tool_choice(
                model=model,
                tools=tools,
                instructions=instructions,
                context=context,
                previous_context=previous_context,
                is_o3_model=is_o3_model
            )
            if result:
                return result
            # If retry fails, continue with original error
            error_message = str(error)
            error_type = type(error).__name__
        
        # If reasoning_level is not supported and we're using an o3 model, retry without it
        # (This shouldn't happen for o3 models, but handle gracefully)
        if ("reasoning_level" in error_message.lower() or "unsupported" in error_message.lower()) and is_o3_model:
            result = self._retry_without_reasoning_level(
                model=model,
                tools=tools,
                tool_choice=tool_choice,
                instructions=instructions,
                context=context,
                previous_context=previous_context,
                is_o3_model=is_o3_model
            )
            if result:
                return result
            # If retry fails, continue with original error
            error_message = str(error)
            error_type = type(error).__name__
        
        # Provide more descriptive error messages with detailed logging
        logger.error(
            f"[AI Service] OpenAI API error occurred",
            extra={
                'model': model,
                'error_type': error_type,
                'error_message': error_message,
                'tools_count': len(tools) if tools else 0,
                'tools': [t.get('type') if isinstance(t, dict) else t for t in tools] if tools else [],
                'tool_choice': tool_choice,
                'instructions_length': len(instructions),
                'context_length': len(context)
            },
            exc_info=True
        )
        
        # Classify and create appropriate exception
        error_category = self._classify_error(error_message)
        raise self._create_error_exception(
            error_category=error_category,
            error_type=error_type,
            error_message=error_message,
            model=model,
            tools=tools,
            tool_choice=tool_choice
        )
    
    def _clean_html_markdown(self, html_content: str) -> str:
        """Clean markdown code blocks from HTML content."""
        if html_content.startswith('```html'):
            html_content = html_content.replace('```html', '').replace('```', '').strip()
        elif html_content.startswith('```'):
            html_content = html_content.split('```')[1].strip()
            if html_content.startswith('html'):
                html_content = html_content[4:].strip()
        return html_content
    
    def generate_report(
        self,
        model: str,
        instructions: str,
        context: str,
        previous_context: str = "",
        tools: Optional[List[Dict]] = None,
        tool_choice: str = "auto",
    ) -> Tuple[str, Dict, Dict, Dict]:
        """
        Generate a report using OpenAI with configurable tools.
        
        Args:
            model: OpenAI model to use (e.g., 'gpt-5')
            instructions: System instructions for the AI
            context: User context/data to generate report from
            previous_context: Optional context from previous steps (accumulated)
            tools: List of tool dictionaries (e.g., [{"type": "web_search_preview"}])
            tool_choice: How model should use tools - "auto", "required", or "none"
            
        Returns:
            Tuple of (generated report content, usage info dict, request details dict, response details dict)
        """
        # Validate and filter tools
        validated_tools, normalized_tool_choice = self._validate_and_filter_tools(tools, tool_choice)
        
        logger.debug(f"[AI Service] After tool validation", extra={
            'validated_tools_count': len(validated_tools) if validated_tools else 0,
            'validated_tools': [t.get('type') if isinstance(t, dict) else t for t in validated_tools] if validated_tools else [],
            'normalized_tool_choice': normalized_tool_choice,
            'original_tool_choice': tool_choice
        })
        
        # Detect image_generation tool, but do NOT force tool_choice='required'.
        has_image_generation = self._has_image_generation(validated_tools)
        # Intentionally not changing normalized_tool_choice here:
        # 'required' doesn't guarantee the image tool is picked and can cause invalid requests.
        
        # CRITICAL VALIDATION: Ensure tool_choice='required' never exists with empty tools
        if normalized_tool_choice == "required":
            if not validated_tools or len(validated_tools) == 0:
                logger.error("[AI Service] CRITICAL: tool_choice='required' but validated_tools is empty!", extra={
                    'original_tool_choice': tool_choice,
                    'has_image_generation': has_image_generation,
                    'validated_tools_count': 0
                })
                raise ValueError("Invalid workflow configuration: tool_choice='required' but no valid tools available after validation. Please check your workflow step configuration and ensure at least one valid tool is included.")
        
        # Check if computer_use_preview is in tools (requires truncation="auto")
        has_computer_use = self._has_computer_use(validated_tools)
        
        # Check if model is o3
        is_o3_model = self._is_o3_model(model)
        
        logger.info(f"[AI Service] Generating report", extra={
            'model': model,
            'tools_count': len(validated_tools) if validated_tools else 0,
            'tools': [t.get('type') if isinstance(t, dict) else t for t in validated_tools] if validated_tools else [],
            'tool_choice': normalized_tool_choice,
            'has_computer_use': has_computer_use,
            'has_image_generation': has_image_generation,
            'instructions_length': len(instructions),
            'context_length': len(context),
            'previous_context_length': len(previous_context)
        })
        
        # Build input text
        input_text = self._build_input_text(context, previous_context)
        full_context = f"{previous_context}\n\n--- Current Step Context ---\n{context}" if previous_context else context
        
        try:
            # Build API parameters
            # NOTE: reasoning_level is NOT supported in Responses API, so we don't pass it
            logger.debug(f"[AI Service] About to build API params", extra={
                'model': model,
                'normalized_tool_choice': normalized_tool_choice,
                'validated_tools_count': len(validated_tools) if validated_tools else 0
            })
            
            params = self._build_api_params(
                model=model,
                instructions=instructions,
                input_text=input_text,
                tools=validated_tools,
                tool_choice=normalized_tool_choice,
                has_computer_use=has_computer_use,
                is_o3_model=is_o3_model,
                reasoning_level=None  # Not supported in Responses API
            )
            
            logger.debug(f"[AI Service] API params built successfully", extra={
                'params_keys': list(params.keys()),
                'has_tools': 'tools' in params,
                'tools_count': len(params.get('tools', [])) if 'tools' in params else 0,
                'has_tool_choice': 'tool_choice' in params,
                'tool_choice_value': params.get('tool_choice')
            })
            
            # Make API call
            logger.info(f"[AI Service] Making OpenAI API call", extra={
                'model': model,
                'has_tools': 'tools' in params,
                'tools_count': len(params.get('tools', [])) if 'tools' in params else 0,
                'has_tool_choice': 'tool_choice' in params,
                'tool_choice': params.get('tool_choice')
            })
            
            response = self._make_api_call(params)
            
            # Process response
            return self._process_api_response(
                response=response,
                model=model,
                instructions=instructions,
                input_text=input_text,
                previous_context=previous_context,
                context=context,
                tools=validated_tools,
                tool_choice=normalized_tool_choice,
                params=params
            )
            
        except Exception as e:
            # Handle errors with retry logic
            return self._handle_openai_error(
                error=e,
                model=model,
                tools=validated_tools,
                tool_choice=normalized_tool_choice,
                instructions=instructions,
                context=context,
                is_o3_model=is_o3_model,
                full_context=full_context,
                previous_context=previous_context
            )
    
    def _build_html_instructions(self, template_style: str, ai_instructions: str, include_research: bool) -> str:
        """
        Build system instructions for HTML generation.
        
        Args:
            template_style: Optional style description/guidance
            ai_instructions: AI instructions from workflow
            include_research: Whether research content is included
            
        Returns:
            System instructions string
        """
        base_instructions = """You are an expert web developer and content designer.

Your task is to create a beautifully styled HTML document"""
        
        if include_research:
            base_instructions += " based on research content and a template design."
            requirements = """Requirements:
1. Use the research content provided as the basis for the document
2. Style the HTML to match the design and structure of the provided template
3. Maintain all research content and facts accurately
4. Apply the template's styling, layout, and visual design
5. Ensure semantic HTML structure
6. Include proper headings, sections, and formatting
7. Make it visually appealing and professional
8. DO NOT use placeholder syntax like {PLACEHOLDER_NAME} - generate complete, personalized content directly
9. Personalize all content based on the research and submission data provided"""
        else:
            base_instructions += " based on user submission data and a template design."
            requirements = """Requirements:
1. Use the submission data provided as the basis for the document
2. Style the HTML to match the design and structure of the provided template
3. Apply the template's styling, layout, and visual design
4. Ensure semantic HTML structure
5. Include proper headings, sections, and formatting
6. Make it visually appealing and professional
7. Personalize the content based on the submission data
8. DO NOT use placeholder syntax like {PLACEHOLDER_NAME} - generate complete, personalized content directly"""
        
        instructions = f"""{base_instructions}

{requirements}

{('Template Style Notes: ' + template_style) if template_style else ''}

{('Additional Instructions: ' + ai_instructions) if ai_instructions else ''}

Return ONLY the complete HTML document, with no additional commentary or markdown code blocks."""
        
        return instructions
    
    def _build_html_user_message(self, content: str, template_html: str, submission_data: Optional[dict], include_research: bool) -> str:
        """
        Build user message for HTML generation.
        
        Args:
            content: Research content or submission context
            template_html: HTML template
            submission_data: Optional submission data
            include_research: Whether content is research (True) or submission (False)
            
        Returns:
            User message string
        """
        submission_context = ""
        if submission_data:
            if include_research:
                submission_context = "\n\nAdditional Context:\n" + "\n".join([
                    f"- {key}: {value}"
                    for key, value in submission_data.items()
                ])
            else:
                submission_context = "\n".join([
                    f"- {key}: {value}"
                    for key, value in submission_data.items()
                ])
        
        if include_research:
            user_message = f"""Given this research content from Step 1:

{content}
{submission_context}

And this template to style it after:

{template_html}

Generate a complete HTML document that:
- Contains all the research content
- Matches the template's design, layout, and styling
- Is ready to use as a final document"""
        else:
            user_message = f"""Given this submission data:

{submission_context}

And this template to style it after:

{template_html}

Generate a complete HTML document that:
- Contains personalized content based on the submission data
- Matches the template's design, layout, and styling
- Is ready to use as a final document"""
        
        return user_message
    
    def _process_html_api_response(self, response: Any, model: str) -> Tuple[str, Dict, Dict]:
        """
        Process HTML API response and extract usage info and response details.
        
        Args:
            response: OpenAI API response object
            model: Model name used
            
        Returns:
            Tuple of (html_content, usage_info, response_details)
        """
        html_content = response.output_text
        
        # Log token usage
        usage = response.usage
        logger.info(
            f"HTML generation completed. "
            f"Tokens: {usage.total_tokens} "
            f"(input: {usage.input_tokens}, output: {usage.output_tokens})"
        )
        
        # Build usage info
        usage_info = self._build_usage_info(response, model, 'openai_worker_html')
        
        # Clean up markdown code blocks if present
        html_content = self._clean_html_markdown(html_content)
        
        # Capture response details
        usage = response.usage
        response_details = {
            'output_text': html_content,
            'usage': {
                'input_tokens': usage.input_tokens or 0,
                'output_tokens': usage.output_tokens or 0,
                'total_tokens': usage.total_tokens or 0,
            },
            'model': getattr(response, 'model', model),
        }
        
        return html_content, usage_info, response_details
    
    def _generate_html_internal(
        self,
        content: str,
        template_html: str,
        template_style: str,
        submission_data: Optional[dict],
        ai_instructions: str,
        model: str,
        include_research: bool
    ) -> Tuple[str, Dict, Dict, Dict]:
        """
        Internal unified method for HTML generation.
        
        Args:
            content: Research content or submission context
            template_html: HTML template
            template_style: Optional style description
            submission_data: Optional submission data
            ai_instructions: AI instructions from workflow
            model: Model to use
            include_research: Whether content is research (True) or submission (False)
            
        Returns:
            Tuple of (html_content, usage_info, request_details, response_details)
        """
        # Build instructions and user message
        instructions = self._build_html_instructions(template_style, ai_instructions, include_research)
        user_message = self._build_html_user_message(content, template_html, submission_data, include_research)
        
        try:
            params = {
                "model": model,
                "instructions": instructions,
                "input": user_message,
            }
            
            # Capture request details
            request_details = {
                'model': model,
                'instructions': instructions,
                'input': user_message,
            }
            
            if include_research:
                request_details['research_content'] = content[:1000] + '...' if len(content) > 1000 else content
            else:
                request_details['submission_data'] = submission_data
            
            request_details['template_html'] = template_html[:500] + '...' if len(template_html) > 500 else template_html
            request_details['template_style'] = template_style
            if not include_research:
                request_details['ai_instructions'] = ai_instructions
            
            response = self._make_api_call(params)
            
            html_content, usage_info, response_details = self._process_html_api_response(response, model)
            
            return html_content, usage_info, request_details, response_details
            
        except Exception as e:
            # Use simplified error handling for HTML generation
            error_type = type(e).__name__
            error_message = str(e)
            
            error_category = self._classify_error(error_message)
            if error_category == "authentication":
                raise Exception(f"OpenAI API authentication failed: {error_message}")
            elif error_category == "rate_limit":
                raise Exception(f"OpenAI API rate limit exceeded: {error_message}")
            elif error_category == "model_not_found":
                raise Exception(f"Invalid AI model specified: {error_message}")
            else:
                raise Exception(f"OpenAI API error ({error_type}): {error_message}")
    
    def generate_html_from_submission(
        self,
        submission_data: dict,
        template_html: str,
        template_style: str = '',
        ai_instructions: str = '',
        model: str = 'gpt-5',
    ) -> Tuple[str, Dict, Dict, Dict]:
        """
        Generate HTML document directly from submission data and template.
        
        Used when research is disabled but HTML generation is enabled.
        Takes submission data and generates HTML styled to match the template.
        
        Args:
            submission_data: Form submission data
            template_html: The HTML template to style the output after
            template_style: Optional style description/guidance
            ai_instructions: AI instructions from workflow
            model: OpenAI model to use
            
        Returns:
            Styled HTML document matching the template
        """
        logger.info(f"Generating HTML from submission with model: {model}")
        
        # Format submission data for context
        submission_context = "\n".join([
            f"- {key}: {value}"
            for key, value in submission_data.items()
        ])
        
        return self._generate_html_internal(
            content=submission_context,
            template_html=template_html,
            template_style=template_style,
            submission_data=submission_data,
            ai_instructions=ai_instructions,
            model=model,
            include_research=False
        )

    def generate_styled_html(
        self,
        research_content: str,
        template_html: str,
        template_style: str = '',
        submission_data: dict = None,
        model: str = 'gpt-5',
    ) -> Tuple[str, Dict, Dict, Dict]:
        """
        Generate styled HTML document from research content and template.
        
        Takes the research from Step 1 and uses it as context to generate
        a properly styled HTML document that matches the template's design.
        
        Args:
            research_content: The markdown report content from Step 1 (research)
            template_html: The HTML template to style the output after
            template_style: Optional style description/guidance
            submission_data: Additional submission data to include (name, email, etc.)
            model: OpenAI model to use
            
        Returns:
            Styled HTML document matching the template
        """
        logger.info(f"Generating styled HTML with model: {model}")
        
        return self._generate_html_internal(
            content=research_content,
            template_html=template_html,
            template_style=template_style,
            submission_data=submission_data,
            ai_instructions='',
            model=model,
            include_research=True
        )

    def rewrite_html(
        self,
        html_content: str,
        model: str = 'gpt-5',
    ) -> str:
        """
        Rewrite/enhance HTML content using AI.
        
        Args:
            html_content: Original HTML content
            model: OpenAI model to use
            
        Returns:
            Enhanced HTML content
        """
        logger.info(f"Rewriting HTML with model: {model}")
        
        instructions = """You are an expert web developer and content editor.
        Your task is to enhance HTML documents by:
        1. Improving formatting and structure
        2. Adding appropriate styling classes
        3. Ensuring semantic HTML
        4. Improving readability
        5. Maintaining all original content
        
        Return ONLY the enhanced HTML, with no additional commentary."""
        
        try:
            params = {
                "model": model,
                "instructions": instructions,
                "input": f"Enhance this HTML document:\n\n{html_content}",
            }
            
            response = self._make_api_call(params)
            
            enhanced_html = response.output_text
            
            # Log token usage
            usage = response.usage
            logger.info(
                f"HTML rewriting completed. "
                f"Tokens: {usage.total_tokens} "
                f"(input: {usage.input_tokens}, output: {usage.output_tokens})"
            )
            
            # Clean up markdown code blocks if present
            enhanced_html = self._clean_html_markdown(enhanced_html)
            
            return enhanced_html
            
        except Exception as e:
            error_type = type(e).__name__
            error_message = str(e)
            
            # Provide more descriptive error messages for HTML rewriting
            if "API key" in error_message or "authentication" in error_message.lower():
                raise Exception(f"OpenAI API authentication failed during HTML rewrite: {error_message}")
            elif "rate limit" in error_message.lower() or "quota" in error_message.lower():
                raise Exception(f"OpenAI API rate limit exceeded during HTML rewrite: {error_message}")
            elif "timeout" in error_message.lower():
                raise Exception(f"OpenAI API request timed out during HTML rewrite: {error_message}")
            else:
                # For HTML rewrite, we return original HTML on error (handled in processor.py)
                logger.error(f"Error rewriting HTML: {e}")
                raise Exception(f"HTML rewrite failed ({error_type}): {error_message}")

