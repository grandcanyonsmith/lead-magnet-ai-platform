"""
AI Service
Handles OpenAI API interactions for report generation and HTML rewriting.
"""

import os
import logging
from typing import Optional, Dict, Tuple, List
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
            tools = [{"type": "web_search_preview"}]
        
        # Filter out tools that require additional configuration we don't have
        # file_search requires vector_store_ids
        # computer_use_preview requires container (mandatory for code interpreter)
        filtered_tools = []
        for tool in tools:
            tool_type = tool.get("type") if isinstance(tool, dict) else tool
            tool_dict = tool if isinstance(tool, dict) else {"type": tool}
            
            # Skip file_search if vector_store_ids is not provided or is empty
            if tool_type == "file_search":
                vector_store_ids = tool_dict.get("vector_store_ids")
                if not vector_store_ids or (isinstance(vector_store_ids, list) and len(vector_store_ids) == 0):
                    logger.warning(f"Skipping file_search tool - vector_store_ids not provided or empty")
                    continue
            
            # Skip computer_use_preview if container is not provided or is empty
            # Container is REQUIRED for computer_use_preview (code interpreter)
            if tool_type == "computer_use_preview":
                container = tool_dict.get("container")
                if not container or (isinstance(container, str) and container.strip() == ""):
                    logger.warning(f"Skipping computer_use_preview tool - container parameter is REQUIRED but not provided or empty. Tool config: {tool_dict}")
                    continue
                # Log successful inclusion for debugging
                logger.info(f"Including computer_use_preview tool with container: {container}")
            
            filtered_tools.append(tool_dict)
        
        # Final validation: Double-check that no invalid tools made it through
        validated_tools = []
        for tool in filtered_tools:
            tool_type = tool.get("type") if isinstance(tool, dict) else tool
            tool_dict = tool if isinstance(tool, dict) else {"type": tool}
            
            # Final check for computer_use_preview - must have container
            if tool_type == "computer_use_preview":
                container = tool_dict.get("container")
                if not container or (isinstance(container, str) and container.strip() == ""):
                    logger.error(f"CRITICAL: computer_use_preview tool passed validation without container! Filtering it out now. tool_dict: {tool_dict}")
                    continue
            
            # Final check for file_search - must have vector_store_ids
            if tool_type == "file_search":
                vector_store_ids = tool_dict.get("vector_store_ids")
                if not vector_store_ids or (isinstance(vector_store_ids, list) and len(vector_store_ids) == 0):
                    logger.error(f"CRITICAL: file_search tool passed validation without vector_store_ids! Filtering it out now. tool_dict: {tool_dict}")
                    continue
            
            validated_tools.append(tool_dict)
        
        # If validation removed tools, use default
        if len(validated_tools) == 0:
            logger.warning(f"All tools were removed during validation, using default web_search_preview")
            validated_tools = [{"type": "web_search_preview"}]
        
        # CRITICAL: Ensure tool_choice='required' never exists with empty tools
        # This is the single consolidated check (replaces 4-5 redundant checks)
        tools_length = len(validated_tools) if validated_tools else 0
        if tool_choice == "required" and tools_length == 0:
            logger.warning(f"[AI Service] tool_choice is 'required' but tools array is empty (length={tools_length}). Changing tool_choice to 'auto' to prevent API error.")
            tool_choice = "auto"
            # Ensure we have at least one tool
            if not validated_tools or len(validated_tools) == 0:
                validated_tools = [{"type": "web_search_preview"}]
                logger.info(f"[AI Service] Added default tool: web_search_preview")
        
        logger.info(f"Final tools after filtering and validation: {validated_tools}")
        
        return validated_tools, tool_choice
    
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
        reasoning_level: Optional[str] = "medium"
    ) -> Dict:
        """
        Build OpenAI API parameters dict.
        
        Args:
            model: OpenAI model name
            instructions: System instructions
            input_text: User input text
            tools: Validated tools list
            tool_choice: How to use tools
            has_computer_use: Whether computer_use_preview tool is present
            is_o3_model: Whether model is o3
            reasoning_level: Reasoning level for o3 models (None to skip)
            
        Returns:
            Parameters dict for OpenAI API call
        """
        # Build base params
        params = {
            "model": model,
            "instructions": instructions,
            "input": input_text,
        }
        
        # Only add tools parameter if:
        # 1. tools array is not empty
        # 2. tool_choice is not "none" (if tool_choice is "none", don't include tools)
        if tool_choice == "none":
            # Don't include tools parameter when tool_choice is "none"
            logger.info("tool_choice is 'none', not including tools parameter")
        elif tools and len(tools) > 0:
            params["tools"] = tools
        else:
            # If tool_choice is not "none" but tools is empty, add default tool
            logger.warning("Tools array is empty but tool_choice is not 'none'. Adding default web_search_preview tool.")
            params["tools"] = [{"type": "web_search_preview"}]
        
        # Add truncation="auto" if computer_use_preview is used
        if has_computer_use:
            params["truncation"] = "auto"
            logger.info("Added truncation='auto' for computer_use_preview tool")
        
        # Add tool_choice ONLY if:
        # 1. tool_choice is not "none"
        # 2. tools array exists and is not empty
        if tool_choice != "none":
            tools_in_params = params.get("tools", [])
            
            # CRITICAL: Never set tool_choice='required' if tools is empty
            if tool_choice == "required":
                if not tools_in_params or len(tools_in_params) == 0:
                    logger.error("[AI Service] ABORT: tool_choice='required' but tools is empty in params! Not setting tool_choice parameter.")
                else:
                    if len(tools_in_params) > 0:
                        params["tool_choice"] = tool_choice
                        logger.debug(f"[AI Service] Set tool_choice='{tool_choice}' with {len(tools_in_params)} tools")
            elif tools_in_params and len(tools_in_params) > 0:
                # For 'auto', only set if tools exist
                params["tool_choice"] = tool_choice
                logger.debug(f"[AI Service] Set tool_choice='{tool_choice}' with {len(tools_in_params)} tools")
            else:
                logger.warning(f"[AI Service] Not setting tool_choice='{tool_choice}' because tools array is empty in params.")
        
        # Add reasoning_level only for o3 models
        if is_o3_model and reasoning_level is not None:
            params["reasoning_level"] = reasoning_level
            logger.info(f"Using reasoning_level={reasoning_level} for o3 model: {model}")
        else:
            # Explicitly ensure reasoning_level is NOT added for non-o3 models
            if "reasoning_level" in params:
                logger.warning(f"Removing reasoning_level parameter for non-o3 model: {model}")
                del params["reasoning_level"]
        
        # ABSOLUTE FINAL CHECK: Right before API call, verify tool_choice='required' is never set with empty tools
        if "tool_choice" in params and params["tool_choice"] == "required":
            tools_in_params = params.get("tools", [])
            if not tools_in_params or len(tools_in_params) == 0:
                logger.critical("[AI Service] CRITICAL: tool_choice='required' found in params with empty tools! Removing tool_choice parameter.")
                del params["tool_choice"]
                # Add default tool if we're going to use tools
                if "tools" not in params or not params.get("tools"):
                    params["tools"] = [{"type": "web_search_preview"}]
                    logger.warning("[AI Service] Added default tool since tool_choice was removed")
        
        logger.debug(f"[AI Service] Final params before API call", extra={
            'has_tools': 'tools' in params,
            'tools_count': len(params.get('tools', [])),
            'has_tool_choice': 'tool_choice' in params,
            'tool_choice_value': params.get('tool_choice'),
            'model': model
        })
        
        return params
    
    def _extract_image_urls(self, response, tools: List[Dict]) -> List[str]:
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
                        
                        # ImageGenerationCall.result contains base64 encoded image
                        # Check if there's a URL field (might be added dynamically)
                        if hasattr(item, 'url') and item.url:
                            image_urls.append(item.url)
                            logger.info(f"Found image URL from ImageGenerationCall.url: {item.url}")
                        elif hasattr(item, 'image_url') and item.image_url:
                            image_urls.append(item.image_url)
                            logger.info(f"Found image URL from ImageGenerationCall.image_url: {item.image_url}")
                        # Check if result might be a URL (though docs say it's base64)
                        elif hasattr(item, 'result') and item.result:
                            if item.result.startswith('http'):
                                image_urls.append(item.result)
                                logger.info(f"Found image URL from ImageGenerationCall.result: {item.result}")
                            else:
                                # result is base64 - decode and upload to S3 to get a URL
                                try:
                                    logger.info(f"ImageGenerationCall.result is base64 (length={len(item.result)}), uploading to S3")
                                    
                                    # Handle data URI format: data:image/png;base64,...
                                    base64_data = item.result
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
                                    
                                    image_urls.append(public_url)
                                    logger.info(f"Uploaded base64 image to S3: {public_url}")
                                except Exception as upload_error:
                                    logger.error(f"Failed to upload base64 image to S3: {upload_error}", exc_info=True)
            
            # Log if no images found but image_generation tool was used
            has_image_tool = any(
                (isinstance(t, dict) and t.get("type") == "image_generation") or 
                (isinstance(t, str) and t == "image_generation")
                for t in tools
            )
            if has_image_tool and not image_urls:
                logger.warning(f"image_generation tool was used but no image URLs found. Response.output length: {len(response.output) if hasattr(response, 'output') and response.output else 0}")
                if hasattr(response, 'output') and response.output:
                    for idx, item in enumerate(response.output):
                        logger.warning(f"output[{idx}]: type={getattr(item, 'type', 'unknown')}, attributes={[attr for attr in dir(item) if not attr.startswith('_')]}")
                        if hasattr(item, 'type') and item.type == 'image_generation_call':
                            try:
                                if hasattr(item, 'model_dump'):
                                    logger.warning(f"ImageGenerationCall full dump: {item.model_dump()}")
                            except:
                                pass
        except Exception as e:
            logger.warning(f"Error extracting image URLs: {e}", exc_info=True)
        
        return image_urls
    
    def _process_api_response(
        self,
        response,
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
        
        # Log token usage for cost tracking
        usage = response.usage
        cost_data = calculate_openai_cost(
            model,
            usage.input_tokens or 0,
            usage.output_tokens or 0
        )
        logger.info(
            f"[AI Service] Report generation completed successfully",
            extra={
                'model': model,
                'total_tokens': usage.total_tokens or 0,
                'input_tokens': usage.input_tokens or 0,
                'output_tokens': usage.output_tokens or 0,
                'cost_usd': cost_data['cost_usd'],
                'output_length': len(report),
                'images_generated': len(image_urls),
                'image_urls': image_urls[:3] if image_urls else []  # Log first 3 URLs
            }
        )
        
        usage_info = {
            'model': model,
            'input_tokens': usage.input_tokens or 0,
            'output_tokens': usage.output_tokens or 0,
            'total_tokens': usage.total_tokens or 0,
            'cost_usd': cost_data['cost_usd'],
            'service_type': 'openai_worker_report',
        }
        
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
        Handle OpenAI API errors with retry logic for reasoning_level errors.
        
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
        
        # If reasoning_level is not supported and we're using an o3 model, retry without it
        # (This shouldn't happen for o3 models, but handle gracefully)
        if ("reasoning_level" in error_message.lower() or "unsupported" in error_message.lower()) and is_o3_model:
            logger.warning(f"reasoning_level parameter not supported for o3 model, retrying without it: {error_message}")
            try:
                # Re-validate tools and tool_choice for retry
                retry_tools, retry_tool_choice = self._validate_and_filter_tools(tools, tool_choice)
                
                # Check if computer_use_preview is in tools (requires truncation="auto")
                has_computer_use = any(
                    (isinstance(t, dict) and t.get("type") == "computer_use_preview") or 
                    (isinstance(t, str) and t == "computer_use_preview")
                    for t in retry_tools
                )
                
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
                
                response = self.client.responses.create(**params_no_reasoning)
                
                # Process response
                report, usage_info, request_details, response_details = self._process_api_response(
                    response=response,
                    model=model,
                    instructions=instructions,
                    input_text=input_text,
                    previous_context=previous_context,
                    context=context,
                    tools=retry_tools,
                    tool_choice=retry_tool_choice,
                    params=params_no_reasoning
                )
                
                logger.info(
                    f"Report generation completed (without reasoning_level). "
                    f"Tokens: {usage_info['total_tokens']} "
                    f"(input: {usage_info['input_tokens']}, output: {usage_info['output_tokens']})"
                    + (f" Images generated: {len(response_details.get('image_urls', []))}" if response_details.get('image_urls') else "")
                )
                
                return report, usage_info, request_details, response_details
            except Exception as retry_error:
                # If retry also fails, continue with original error
                error_message = str(retry_error)
                error_type = type(retry_error).__name__
        
        # Provide more descriptive error messages with detailed logging
        logger.error(
            f"[AI Service] OpenAI API error occurred",
            extra={
                'model': model,
                'error_type': error_type,
                'error_message': error_message,
                'tools': [t.get('type') if isinstance(t, dict) else t for t in tools] if tools else [],
                'tool_choice': tool_choice,
                'instructions_length': len(instructions),
                'context_length': len(context)
            },
            exc_info=True
        )
        
        if "API key" in error_message or "authentication" in error_message.lower():
            logger.error(f"[AI Service] Authentication error - check API key configuration")
            raise Exception(f"OpenAI API authentication failed. Please check your API key configuration: {error_message}")
        elif "rate limit" in error_message.lower() or "quota" in error_message.lower():
            logger.warning(f"[AI Service] Rate limit exceeded - request should be retried")
            raise Exception(f"OpenAI API rate limit exceeded. Please try again later: {error_message}")
        elif "tool_choice" in error_message.lower() and "required" in error_message.lower() and "tools" in error_message.lower():
            logger.error(f"[AI Service] Invalid tool_choice configuration - tool_choice='required' but tools empty")
            raise Exception(f"OpenAI API error: Invalid workflow configuration. Tool choice 'required' was specified but no tools are available. This has been automatically fixed - please try again. Original error: {error_message}")
        elif "model" in error_message.lower() and "not found" in error_message.lower():
            logger.error(f"[AI Service] Invalid model specified: {model}")
            raise Exception(f"Invalid AI model specified. Please check your workflow configuration: {error_message}")
        elif "timeout" in error_message.lower():
            logger.warning(f"[AI Service] Request timeout - request took too long")
            raise Exception(f"OpenAI API request timed out. The request took too long to complete: {error_message}")
        elif "connection" in error_message.lower():
            logger.error(f"[AI Service] Connection error - network issue")
            raise Exception(f"Unable to connect to OpenAI API. Please check your network connection: {error_message}")
        else:
            logger.error(f"[AI Service] Unexpected API error: {error_type}")
            raise Exception(f"OpenAI API error ({error_type}): {error_message}")
    
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
        tools: Optional[list] = None,
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
        
        # Check if computer_use_preview is in tools (requires truncation="auto")
        has_computer_use = any(
            (isinstance(t, dict) and t.get("type") == "computer_use_preview") or 
            (isinstance(t, str) and t == "computer_use_preview")
            for t in validated_tools
        )
        
        # Check if model is o3
        is_o3_model = self._is_o3_model(model)
        
        logger.info(f"[AI Service] Generating report", extra={
            'model': model,
            'tools_count': len(validated_tools) if validated_tools else 0,
            'tools': [t.get('type') if isinstance(t, dict) else t for t in validated_tools] if validated_tools else [],
            'tool_choice': normalized_tool_choice,
            'has_computer_use': has_computer_use,
            'instructions_length': len(instructions),
            'context_length': len(context),
            'previous_context_length': len(previous_context)
        })
        
        # Build input text
        input_text = self._build_input_text(context, previous_context)
        full_context = f"{previous_context}\n\n--- Current Step Context ---\n{context}" if previous_context else context
        
        try:
            # Build API parameters
            params = self._build_api_params(
                model=model,
                instructions=instructions,
                input_text=input_text,
                tools=validated_tools,
                tool_choice=normalized_tool_choice,
                has_computer_use=has_computer_use,
                is_o3_model=is_o3_model,
                reasoning_level="medium"
            )
            
            # Make API call
            response = self.client.responses.create(**params)
            
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
        
        # Build system instructions
        instructions = f"""You are an expert web developer and content designer.

Your task is to create a beautifully styled HTML document based on user submission data and a template design.

Requirements:
1. Use the submission data provided as the basis for the document
2. Style the HTML to match the design and structure of the provided template
3. Apply the template's styling, layout, and visual design
4. Ensure semantic HTML structure
5. Include proper headings, sections, and formatting
6. Make it visually appealing and professional
7. Personalize the content based on the submission data
8. DO NOT use placeholder syntax like {{PLACEHOLDER_NAME}} - generate complete, personalized content directly

{('Template Style Notes: ' + template_style) if template_style else ''}

{('Additional Instructions: ' + ai_instructions) if ai_instructions else ''}

Return ONLY the complete HTML document, with no additional commentary or markdown code blocks."""
        
        # Build user message with submission data and template
        user_message = f"""Given this submission data:

{submission_context}

And this template to style it after:

{template_html}

Generate a complete HTML document that:
- Contains personalized content based on the submission data
- Matches the template's design, layout, and styling
- Is ready to use as a final document"""
        
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
                'submission_data': submission_data,
                'template_html': template_html[:500] + '...' if len(template_html) > 500 else template_html,  # Truncate for storage
                'template_style': template_style,
                'ai_instructions': ai_instructions,
            }
            
            response = self.client.responses.create(**params)
            
            html_content = response.output_text
            
            # Log token usage
            usage = response.usage
            logger.info(
                f"HTML generation from submission completed. "
                f"Tokens: {usage.total_tokens} "
                f"(input: {usage.input_tokens}, output: {usage.output_tokens})"
            )
            
            # Calculate cost
            cost_data = calculate_openai_cost(
                model,
                usage.input_tokens or 0,
                usage.output_tokens or 0
            )
            
            usage_info = {
                'model': model,
                'input_tokens': usage.input_tokens or 0,
                'output_tokens': usage.output_tokens or 0,
                'total_tokens': usage.total_tokens or 0,
                'cost_usd': cost_data['cost_usd'],
                'service_type': 'openai_worker_html',
            }
            
            # Clean up markdown code blocks if present
            html_content = self._clean_html_markdown(html_content)
            
            # Capture response details
            response_details = {
                'output_text': html_content,
                'usage': {
                    'input_tokens': usage.input_tokens or 0,
                    'output_tokens': usage.output_tokens or 0,
                    'total_tokens': usage.total_tokens or 0,
                },
                'model': getattr(response, 'model', model),
            }
            
            return html_content, usage_info, request_details, response_details
            
        except Exception as e:
            # Use simplified error handling for HTML generation
            error_type = type(e).__name__
            error_message = str(e)
            
            if "API key" in error_message or "authentication" in error_message.lower():
                raise Exception(f"OpenAI API authentication failed: {error_message}")
            elif "rate limit" in error_message.lower() or "quota" in error_message.lower():
                raise Exception(f"OpenAI API rate limit exceeded: {error_message}")
            elif "model" in error_message.lower() and "not found" in error_message.lower():
                raise Exception(f"Invalid AI model specified: {error_message}")
            else:
                raise Exception(f"OpenAI API error ({error_type}): {error_message}")

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
        
        # Format submission data for context
        submission_context = ""
        if submission_data:
            submission_context = "\n\nAdditional Context:\n" + "\n".join([
                f"- {key}: {value}"
                for key, value in submission_data.items()
            ])
        
        # Build system instructions
        instructions = f"""You are an expert web developer and content designer.

Your task is to create a beautifully styled HTML document based on research content and a template design.

Requirements:
1. Use the research content provided as the basis for the document
2. Style the HTML to match the design and structure of the provided template
3. Maintain all research content and facts accurately
4. Apply the template's styling, layout, and visual design
5. Ensure semantic HTML structure
6. Include proper headings, sections, and formatting
7. Make it visually appealing and professional
8. DO NOT use placeholder syntax like {{PLACEHOLDER_NAME}} - generate complete, personalized content directly
9. Personalize all content based on the research and submission data provided

{('Template Style Notes: ' + template_style) if template_style else ''}

Return ONLY the complete HTML document, with no additional commentary or markdown code blocks."""
        
        # Build user message with research and template
        user_message = f"""Given this research content from Step 1:

{research_content}
{submission_context}

And this template to style it after:

{template_html}

Generate a complete HTML document that:
- Contains all the research content
- Matches the template's design, layout, and styling
- Is ready to use as a final document"""
        
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
                'research_content': research_content[:1000] + '...' if len(research_content) > 1000 else research_content,  # Truncate for storage
                'template_html': template_html[:500] + '...' if len(template_html) > 500 else template_html,  # Truncate for storage
                'template_style': template_style,
                'submission_data': submission_data,
            }
            
            response = self.client.responses.create(**params)
            
            html_content = response.output_text
            
            # Log token usage
            usage = response.usage
            logger.info(
                f"Styled HTML generation completed. "
                f"Tokens: {usage.total_tokens} "
                f"(input: {usage.input_tokens}, output: {usage.output_tokens})"
            )
            
            # Calculate cost
            cost_data = calculate_openai_cost(
                model,
                usage.input_tokens or 0,
                usage.output_tokens or 0
            )
            
            usage_info = {
                'model': model,
                'input_tokens': usage.input_tokens or 0,
                'output_tokens': usage.output_tokens or 0,
                'total_tokens': usage.total_tokens or 0,
                'cost_usd': cost_data['cost_usd'],
                'service_type': 'openai_worker_html',
            }
            
            # Clean up markdown code blocks if present
            html_content = self._clean_html_markdown(html_content)
            
            # Capture response details
            response_details = {
                'output_text': html_content,
                'usage': {
                    'input_tokens': usage.input_tokens or 0,
                    'output_tokens': usage.output_tokens or 0,
                    'total_tokens': usage.total_tokens or 0,
                },
                'model': getattr(response, 'model', model),
            }
            
            return html_content, usage_info, request_details, response_details
            
        except Exception as e:
            # Use simplified error handling for HTML generation
            error_type = type(e).__name__
            error_message = str(e)
            
            if "API key" in error_message or "authentication" in error_message.lower():
                raise Exception(f"OpenAI API authentication failed: {error_message}")
            elif "rate limit" in error_message.lower() or "quota" in error_message.lower():
                raise Exception(f"OpenAI API rate limit exceeded: {error_message}")
            elif "model" in error_message.lower() and "not found" in error_message.lower():
                raise Exception(f"Invalid AI model specified: {error_message}")
            else:
                raise Exception(f"OpenAI API error ({error_type}): {error_message}")

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
            
            response = self.client.responses.create(**params)
            
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

