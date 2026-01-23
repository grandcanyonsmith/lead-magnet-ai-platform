"""
OpenAI Response Service
Handles processing and serialization of OpenAI API responses.
"""
import logging
import json
import copy
from typing import Dict, List, Any, Optional, Tuple
from services.response_parser import ResponseParser
from services.tool_secrets import redact_tool_secrets_text, redact_tool_secrets_value
from cost_service import calculate_openai_cost

logger = logging.getLogger(__name__)


class OpenAIResponseService:
    """Service for processing OpenAI API responses."""
    
    @staticmethod
    def process_api_response(
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
        
        # Log raw response structure for debugging
        logger.info("[OpenAI Response Service] Processing API response", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'model': model,
            'response_type': type(response).__name__
        })
        
        # Responses API uses output_text instead of choices[0].message.content
        content = getattr(response, "output_text", "")
        if not content and hasattr(response, "choices"):
            # Fallback for backwards compatibility
            if response.choices and len(response.choices) > 0:
                content = response.choices[0].message.content or ""
        
        # Extract and convert base64 images in JSON responses
        base64_image_urls = []
        if content and image_handler:
            try:
                updated_content, base64_image_urls = OpenAIResponseService._extract_and_convert_base64_images(
                    content=content,
                    image_handler=image_handler,
                    tenant_id=tenant_id,
                    job_id=job_id,
                    context=context,
                    step_name=step_name,
                    step_instructions=step_instructions or instructions
                )
                if updated_content != content:
                    content = updated_content
            except Exception as e:
                logger.warning(f"[OpenAI Response Service] Error converting base64 images: {e}", exc_info=True)
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
        raw_api_request = redact_tool_secrets_value(raw_api_request)
        
        request_details = {
            "model": model,
            "instructions": redact_tool_secrets_text(instructions),
            "input": redact_tool_secrets_text(input_text),
            "previous_context": previous_context,
            "context": context,
            "tools": tools,
            "tool_choice": tool_choice,
            # Store full raw API request body (exact what was sent to OpenAI)
            "raw_api_request": raw_api_request
        }
        
        # Extract image URLs from response using ResponseParser
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
        
        code_executor_logs = OpenAIResponseService._extract_code_executor_logs(response)
        
        # Serialize full raw API response object
        raw_api_response = OpenAIResponseService._serialize_response(response)
        
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
        
        if code_executor_logs:
            response_details["code_executor_logs"] = code_executor_logs
        
        return content, usage_info, request_details, response_details

    @staticmethod
    def _extract_and_convert_base64_images(
        content: str,
        image_handler,
        tenant_id: Optional[str] = None,
        job_id: Optional[str] = None,
        context: Optional[str] = None,
        step_name: Optional[str] = None,
        step_instructions: Optional[str] = None
    ) -> Tuple[str, List[str]]:
        """
        Extract base64-encoded images from JSON response and convert them to URLs.
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
                        # Extract filename from asset only if it has a meaningful name
                        filename = asset.get('name', '') or None
                        
                        # Upload base64 image to S3 with context for AI naming
                        image_url = image_handler.upload_base64_image_to_s3(
                            image_b64=data_field,
                            content_type=content_type,
                            tenant_id=tenant_id,
                            job_id=job_id,
                            filename=filename,
                            context=context,
                            step_name=step_name,
                            step_instructions=step_instructions,
                            image_index=len(image_urls)  # Use current count as index
                        )
                        
                        if image_url:
                            # Replace base64 data with URL
                            asset['data'] = image_url
                            asset['encoding'] = 'url'
                            # Keep original data in a backup field for reference
                            asset['original_data_encoding'] = 'base64'
                            image_urls.append(image_url)
                            modified = True
                            
                            logger.info("[OpenAI Response Service] Converted base64 image to URL", extra={
                                'asset_id': asset.get('id', 'unknown'),
                                'image_filename': filename,
                                'content_type': content_type
                            })
                    except Exception as e:
                        logger.error(f"[OpenAI Response Service] Error converting base64 image: {e}", exc_info=True)
            
            # If we modified any assets, update the content
            if modified:
                updated_content = json.dumps(data, indent=2)
            
            return updated_content, image_urls
            
        except Exception as e:
            logger.error(f"[OpenAI Response Service] Error processing base64 images: {e}", exc_info=True)
            # Return original content on error
            return content, []
    
    @staticmethod
    def _extract_code_executor_logs(response: Any) -> List[Dict[str, Any]]:
        """
        Extract code interpreter logs from Responses API output items.
        """
        output_items = getattr(response, "output", None)
        if output_items is None and isinstance(response, dict):
            output_items = response.get("output")
        if not isinstance(output_items, list):
            return []
        
        def _get_attr(obj: Any, key: str) -> Any:
            if isinstance(obj, dict):
                return obj.get(key)
            return getattr(obj, key, None)
        
        def _normalize_type(value: Any) -> Optional[str]:
            if value is None:
                return None
            if isinstance(value, str):
                return value
            if hasattr(value, "value"):
                try:
                    return str(value.value)
                except Exception:
                    return str(value)
            return str(value)
        
        def _stringify(value: Any) -> Optional[str]:
            if value is None:
                return None
            if isinstance(value, str):
                return value
            try:
                return json.dumps(value)
            except Exception:
                return str(value)
        
        logs: List[Dict[str, Any]] = []
        
        for item in output_items:
            item_type = _normalize_type(_get_attr(item, "type"))
            tool_name = None
            if item_type in ("tool_call", "tool_calls", "function_call"):
                tool_name = _normalize_type(
                    _get_attr(item, "tool_name")
                    or _get_attr(item, "name")
                    or _get_attr(_get_attr(item, "function"), "name")
                )
                if tool_name != "code_interpreter":
                    continue
            elif item_type != "code_interpreter_call":
                continue
            
            call_id = _get_attr(item, "call_id") or _get_attr(item, "id")
            status = _get_attr(item, "status")
            code = (
                _get_attr(item, "code")
                or _get_attr(item, "input")
                or _get_attr(item, "script")
            )

            container_id = None
            container = (
                _get_attr(item, "container")
                or _get_attr(item, "container_id")
                or _get_attr(item, "containerId")
            )
            if isinstance(container, dict):
                container_id = (
                    _get_attr(container, "id")
                    or _get_attr(container, "container_id")
                    or _get_attr(container, "containerId")
                )
            elif container is not None:
                container_id = _stringify(container)
            
            outputs_raw = _get_attr(item, "outputs") or _get_attr(item, "output") or []
            if isinstance(outputs_raw, dict):
                outputs_raw = [outputs_raw]
            elif not isinstance(outputs_raw, list):
                outputs_raw = [outputs_raw] if outputs_raw else []
            
            outputs: List[Dict[str, Any]] = []
            for output in outputs_raw:
                output_type = _normalize_type(_get_attr(output, "type"))
                entry: Dict[str, Any] = {}
                if output_type:
                    entry["type"] = output_type
                
                if output_type == "logs":
                    logs_text = (
                        _get_attr(output, "logs")
                        or _get_attr(output, "text")
                        or _get_attr(output, "stdout")
                    )
                    if logs_text is not None:
                        entry["logs"] = _stringify(logs_text)
                elif output_type == "error":
                    error_text = (
                        _get_attr(output, "error")
                        or _get_attr(output, "message")
                        or _get_attr(output, "stderr")
                    )
                    if error_text is not None:
                        entry["error"] = _stringify(error_text)
                else:
                    image_url = _get_attr(output, "image_url") or _get_attr(output, "url")
                    if image_url:
                        entry["image_url"] = _stringify(image_url)
                    if not entry:
                        entry["data"] = _stringify(output)
                
                if entry:
                    outputs.append(entry)
            
            log_entry = {
                "call_id": _stringify(call_id) if call_id is not None else None,
                "status": _stringify(status) if status is not None else None,
                "code": _stringify(code) if code is not None else None,
                "tool_name": tool_name,
                "outputs": outputs,
            }
            if container_id:
                log_entry["container_id"] = _stringify(container_id)
            logs.append(log_entry)
        
        return logs

    @staticmethod
    def _serialize_response(response: Any) -> Dict[str, Any]:
        """
        Serialize OpenAI API response object to a dictionary.
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
                    except Exception:
                        pass
                # Fallback to dict() if available (Pydantic v1 or simple objects)
                if hasattr(response, 'dict'):
                    return response.dict()
            
            # Try to convert attributes to dict if model_dump/dict don't work
            result = {}
            for attr in dir(response):
                if not attr.startswith('_'):
                    try:
                        value = getattr(response, attr)
                        if not callable(value):
                            if isinstance(value, (str, int, float, bool, type(None))):
                                result[attr] = value
                            else:
                                result[attr] = str(value)
                    except Exception:
                        pass
            return result
        except Exception as e:
            return {
                "error": "Failed to serialize response",
                "error_message": str(e),
                "response_type": type(response).__name__
            }

