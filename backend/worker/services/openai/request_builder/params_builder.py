import logging
from typing import Dict, List, Optional, Any
from services.tools import ToolBuilder
from services.tool_secrets import redact_tool_secrets_text, redact_tool_secrets_value
from utils.decimal_utils import convert_decimals_to_float
from .input_builder import build_multimodal_input

logger = logging.getLogger(__name__)

# Global guardrail: workflows run autonomously with no user interaction between steps.
NO_CONFIRMATION_PREFIX = (
    "IMPORTANT: This workflow runs end-to-end with NO user interaction between steps. "
    "Do NOT ask the user for confirmation or additional input. "
    "Do NOT pause waiting for responses. "
    "If information is missing or ambiguous, make reasonable assumptions and proceed.\n\n"
)

def model_supports_reasoning(model: str) -> bool:
    """Return True if the model supports the reasoning parameter."""
    if not isinstance(model, str):
        return False
    normalized = model.strip().lower()
    if normalized.startswith("gpt-5"):
        return True
    return normalized.startswith(("o1", "o3", "o4", "o5"))

def build_api_params(
    model: str,
    instructions: str,
    input_text: str,
    tools: Optional[List[Dict]] = None,
    tool_choice: str = "auto",
    has_computer_use: bool = False,
    reasoning_level: Optional[str] = None,
    previous_image_urls: Optional[List[str]] = None,
    job_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    reasoning_effort: Optional[str] = None,
    service_tier: Optional[str] = None,
    text_verbosity: Optional[str] = None,
    max_output_tokens: Optional[int] = None,
    output_format: Optional[Dict[str, Any]] = None,
) -> Dict:
    """
    Build parameters for OpenAI Responses API call.
    """
    # Enforce autonomous execution: never ask for user confirmation mid-workflow.
    instructions_text = instructions or ""
    if not isinstance(instructions_text, str):
        logger.warning(
            "[OpenAI Request Builder] instructions was not a string; coercing to string",
            extra={
                "model": model,
                "job_id": job_id,
                "tenant_id": tenant_id,
                "instructions_type": type(instructions_text).__name__,
            },
        )
        try:
            instructions_text = str(instructions_text)
        except Exception:
            instructions_text = ""
    if input_text is None:
        logger.warning(
            "[OpenAI Request Builder] input_text was None; defaulting to empty string",
            extra={"model": model, "job_id": job_id, "tenant_id": tenant_id},
        )
        input_text = ""
    elif not isinstance(input_text, str):
        logger.warning(
            "[OpenAI Request Builder] input_text was not a string; coercing to string",
            extra={
                "model": model,
                "job_id": job_id,
                "tenant_id": tenant_id,
                "input_text_type": type(input_text).__name__,
            },
        )
        try:
            input_text = str(input_text)
        except Exception:
            input_text = ""
    instructions_lower = instructions_text.lower()
    if (
        "ask for confirmation" not in instructions_lower
        and "no user interaction" not in instructions_lower
        and "no user input" not in instructions_lower
        and "no human-in-the-loop" not in instructions_lower
    ):
        instructions_text = NO_CONFIRMATION_PREFIX + instructions_text

    # Check if image_generation tool is present
    has_image_generation = False
    if tools:
        for tool in tools:
            if isinstance(tool, dict) and tool.get('type') == 'image_generation':
                has_image_generation = True
                break
    
    # Check if model supports image inputs
    # computer-use-preview models don't support image inputs
    model_supports_images = not (
        isinstance(model, str) and 
        ('computer-use' in model.lower() or model.startswith('computer-use'))
    )
    
    # Build input: if image_generation tool is present and we have previous image URLs,
    # AND the model supports images, use list format with text and images; 
    # otherwise use string format (backward compatible)
    if (has_image_generation and previous_image_urls and len(previous_image_urls) > 0
        and model_supports_images):
        api_input = build_multimodal_input(
            input_text, previous_image_urls, job_id, tenant_id
        )
    else:
        # Use string format (backward compatible)
        api_input = input_text
        if has_image_generation and previous_image_urls:
            if not model_supports_images:
                logger.debug(
                    "[OpenAI Request Builder] Model does not support image inputs, "
                    "excluding images from input",
                    extra={'model': model}
                )
            else:
                logger.debug("[OpenAI Request Builder] Image generation tool present but no previous image URLs to include")

    if api_input is None:
        logger.warning(
            "[OpenAI Request Builder] api_input was None; defaulting to empty string",
            extra={"model": model, "job_id": job_id, "tenant_id": tenant_id},
        )
        api_input = ""
    
    params = {
        "model": model,
        "instructions": instructions_text,
        "input": api_input
    }

    # Normalize tools to a list (downstream expects iterable)
    tools = tools or []

    # Deep research model requirement:
    # Deep research models require at least one of 'web_search_preview', 'mcp', or 'file_search' tools.
    # If none are present, add 'web_search_preview' defensively so the API call is accepted.
    if isinstance(model, str) and "deep-research" in model.lower():
        required_tool_types = {"web_search_preview", "mcp", "file_search"}
        has_required_tool = False
        for t in tools:
            if isinstance(t, str):
                t_type = t
            elif isinstance(t, dict):
                t_type = t.get("type")
            else:
                continue
            if t_type in required_tool_types:
                has_required_tool = True
                break

        if not has_required_tool:
            logger.info(
                "[OpenAI Request Builder] Deep research model requires at least one of "
                "web_search_preview, mcp, or file_search. Adding web_search_preview as default.",
                extra={"model": model},
            )
            tools = list(tools)
            tools.append({"type": "web_search_preview"})
    
    if tools and len(tools) > 0:
        # Filter out incompatible tools when computer_use_preview is present
        # OpenAI doesn't support certain tools (like 'shell') alongside computer_use_preview
        if has_computer_use:
            # Tools incompatible with computer_use_preview
            # Note: 'shell' is now supported alongside computer_use_preview
            INCOMPATIBLE_WITH_CUA = {'code_interpreter'}
            filtered_tools = []
            for tool in tools:
                tool_type = tool.get('type') if isinstance(tool, dict) else tool
                if tool_type not in INCOMPATIBLE_WITH_CUA:
                    filtered_tools.append(tool)
                else:
                    logger.debug(f"Filtering out incompatible tool '{tool_type}' when computer_use_preview is present")
            tools = filtered_tools
    
    # Ensure code interpreter outputs are included when streaming.
    # This allows stdout/stderr/logs to be surfaced in streamed events.
    include_fields: List[str] = []
    if "include" in params and isinstance(params.get("include"), list):
        include_fields = list(params.get("include") or [])
    has_code_interpreter = any(
        (isinstance(tool, dict) and tool.get("type") == "code_interpreter")
        or (isinstance(tool, str) and tool == "code_interpreter")
        for tool in (tools or [])
    )
    if has_code_interpreter:
        include_fields.append("code_interpreter_call.outputs")
    if include_fields:
        # Deduplicate while preserving order
        deduped: List[str] = []
        for item in include_fields:
            if isinstance(item, str) and item not in deduped:
                deduped.append(item)
        params["include"] = deduped
        
    # Clean tools before sending to OpenAI API
    cleaned_tools = ToolBuilder.clean_tools(tools)
    
    # Log the full request payload for debugging
    if logger.isEnabledFor(logging.INFO):
        import json
        try:
            # Create a safe copy of params for logging (without api key which isn't here anyway)
            # Convert Decimals to ensure JSON serialization works
            safe_input = redact_tool_secrets_value(params.get("input"))
            safe_instructions = redact_tool_secrets_text(params.get("instructions"))
            debug_payload = convert_decimals_to_float({
                "model": params.get("model"),
                "tool_choice": params.get("tool_choice"),
                "tools": cleaned_tools,
                # Truncate input/instructions for readability (secrets redacted)
                "input_preview": str(safe_input)[:200] + "..." if safe_input else None,
                "instructions_preview": str(safe_instructions)[:200] + "..." if safe_instructions else None,
            })
            logger.info(f"[OpenAI Request Builder] Final API Payload: {json.dumps(debug_payload)}")
        except Exception:
            pass
    
    # #region agent log
    try:
        import json
        import time
        # Shell is supported alongside computer_use_preview; keep it and just log the final tool set.
        # ToolBuilder.clean_tools preserves the native shell tool type.
        
        # Convert Decimals to ensure JSON serialization works
        log_data = convert_decimals_to_float({
            "sessionId": "debug-session",
            "runId": "repro-3",
            "hypothesisId": "check-tools-after-builder",
            "location": "openai_request_builder.py:build_api_params",
            "timestamp": int(time.time() * 1000),
            "message": "Tools after ToolBuilder.clean_tools",
            "data": {
                "model": model,
                "has_computer_use": has_computer_use,
                "final_tools_count": len(cleaned_tools),
                "final_tool_types": [t.get('type') for t in cleaned_tools],
                "final_tool_names": [t.get('name') for t in cleaned_tools if t.get('type') == 'function']
            }
        })
        with open('/Users/canyonsmith/lead-magnent-ai/.cursor/debug.log', 'a') as f:
            f.write(json.dumps(log_data) + '\n')
    except Exception:
        pass
    # #endregion

    # Only add tools if we actually have any after cleaning/filtering
    if cleaned_tools:
        params["tools"] = cleaned_tools
        if tool_choice != "none":
            params["tool_choice"] = tool_choice
    elif tool_choice == "required":
        # If we filtered out all tools but tool_choice was required, we must not set tool_choice
        # to avoid API error 400: "Tool choice 'required' must be specified with 'tools' parameter."
        logger.warning(
            "[OpenAI Request Builder] All tools were filtered out but tool_choice was 'required'. "
            "Not setting tool_choice to prevent API error.",
            extra={
                "model": model,
                "original_tools_count": len(tools) if isinstance(tools, list) else None,
                "has_computer_use": has_computer_use,
            },
        )

    # Reasoning + speed controls (Responses API)
    # Map deprecated reasoning_level to reasoning_effort if provided
    if reasoning_level and not reasoning_effort:
        reasoning_effort = reasoning_level

    supports_reasoning = model_supports_reasoning(model)

    # Default to "high" reasoning for GPT-5 family unless explicitly overridden
    if reasoning_effort is None and supports_reasoning and isinstance(model, str) and model.startswith('gpt-5'):
        reasoning_effort = 'high'

    if reasoning_effort:
        if supports_reasoning:
            params["reasoning"] = {"effort": reasoning_effort}
        else:
            logger.info(
                "[OpenAI Request Builder] Skipping reasoning effort for unsupported model",
                extra={"model": model, "reasoning_effort": reasoning_effort},
            )

    # Prefer the priority tier for fastest responses on supported models (best-effort; we retry without if unsupported)
    if service_tier is None and isinstance(model, str) and model.startswith('gpt-5'):
        service_tier = 'priority'

    if service_tier:
        params["service_tier"] = service_tier

    # Output verbosity control
    text_cfg: Dict[str, Any] = {}
    if text_verbosity:
        text_cfg["verbosity"] = text_verbosity

    # Structured output / response format (Responses API)
    # See https://platform.openai.com/docs/guides/structured-outputs
    if isinstance(output_format, dict):
        fmt_type = output_format.get("type")
        if fmt_type in ("text", "json_object"):
            text_cfg["format"] = {"type": fmt_type}
            
            # Ensure "json" word appears in input messages if json_object is requested
            # OpenAI requires "json" to appear in the input messages (input field, not instructions)
            if fmt_type == "json_object":
                current_input = params.get("input", "")
                
                # Check if "json" appears in input
                has_json_in_input = False
                
                # Check input field - can be string or list (multimodal)
                if isinstance(current_input, str):
                    has_json_in_input = "json" in current_input.lower()
                elif isinstance(current_input, list) and len(current_input) > 0:
                    # For multimodal input, structure is: [{"role": "user", "content": [...]}]
                    # or direct content list: [{"type": "input_text", "text": ...}, ...]
                    for item in current_input:
                        if isinstance(item, dict):
                            # Check if this is a role-based message structure
                            if "role" in item and "content" in item:
                                content = item.get("content", [])
                                if isinstance(content, list):
                                    for content_item in content:
                                        if isinstance(content_item, dict) and content_item.get("type") == "input_text":
                                            text = content_item.get("text", "")
                                            if "json" in text.lower():
                                                has_json_in_input = True
                                                break
                                elif isinstance(content, str) and "json" in content.lower():
                                    has_json_in_input = True
                            # Check if this is a direct content item
                            elif item.get("type") == "input_text":
                                text = item.get("text", "")
                                if "json" in text.lower():
                                    has_json_in_input = True
                        if has_json_in_input:
                            break
                
                # If "json" doesn't appear in input, add it to the input field
                # OpenAI requires "json" to be in the input messages (input field specifically)
                # We check instructions too, but prioritize ensuring it's in input
                if not has_json_in_input:
                    if isinstance(current_input, str):
                        # Simple string input - append JSON instruction
                        params["input"] = current_input + "\n\nPlease output your response in JSON format."
                    elif isinstance(current_input, list) and len(current_input) > 0:
                        # Multimodal input - add to the first text content item
                        text_added = False
                        for item in current_input:
                            if isinstance(item, dict):
                                # Handle role-based message structure
                                if "role" in item and "content" in item:
                                    content = item.get("content", [])
                                    if isinstance(content, list):
                                        # Find first text item and append
                                        for content_item in content:
                                            if isinstance(content_item, dict) and content_item.get("type") == "input_text":
                                                existing_text = content_item.get("text", "")
                                                content_item["text"] = existing_text + "\n\nPlease output your response in JSON format."
                                                text_added = True
                                                break
                                        # If no text item found, add one at the beginning
                                        if not text_added:
                                            content.insert(0, {
                                                "type": "input_text",
                                                "text": "Please output your response in JSON format."
                                            })
                                            text_added = True
                                    elif isinstance(content, str):
                                        # Convert string content to list format
                                        item["content"] = [
                                            {"type": "input_text", "text": content + "\n\nPlease output your response in JSON format."}
                                        ]
                                        text_added = True
                                # Handle direct content item structure
                                elif item.get("type") == "input_text":
                                    existing_text = item.get("text", "")
                                    item["text"] = existing_text + "\n\nPlease output your response in JSON format."
                                    text_added = True
                            if text_added:
                                break
                        # If we couldn't modify the list, fallback to instructions
                        if not text_added:
                            current_instructions = params.get("instructions", "")
                            params["instructions"] = current_instructions + "\n\nIMPORTANT: Please output your response in JSON format."
                    else:
                        # Fallback: add to instructions if input format is unexpected
                        current_instructions = params.get("instructions", "")
                        params["instructions"] = current_instructions + "\n\nIMPORTANT: Please output your response in JSON format."
        elif fmt_type == "json_schema":
            name = output_format.get("name")
            schema = output_format.get("schema")
            description = output_format.get("description")
            strict = output_format.get("strict")
            if isinstance(name, str) and name and isinstance(schema, dict) and schema:
                fmt: Dict[str, Any] = {"type": "json_schema", "name": name, "schema": schema}
                if isinstance(description, str) and description:
                    fmt["description"] = description
                if isinstance(strict, bool):
                    fmt["strict"] = strict
                text_cfg["format"] = fmt

    if text_cfg:
        params["text"] = text_cfg

    # Maximum output tokens
    if max_output_tokens is not None:
        # OpenAI requires an integer. DynamoDB often stores numbers as Decimal,
        # and our sanitation may convert those to float (e.g., 2048.0).
        # Coerce to int defensively; if invalid, omit the param rather than failing the request.
        try:
            if isinstance(max_output_tokens, bool):
                raise ValueError("max_output_tokens must be an int, not bool")
            if isinstance(max_output_tokens, float):
                if not max_output_tokens.is_integer():
                    logger.warning(
                        "[OpenAI Request Builder] max_output_tokens was a non-integer float; truncating",
                        extra={"max_output_tokens": max_output_tokens},
                    )
                max_output_tokens = int(max_output_tokens)
            else:
                max_output_tokens = int(max_output_tokens)

            if max_output_tokens > 0:
                params["max_output_tokens"] = max_output_tokens
        except Exception as e:
            logger.warning(
                "[OpenAI Request Builder] Invalid max_output_tokens; omitting to avoid API error",
                extra={"max_output_tokens": str(max_output_tokens), "error": str(e)},
            )
    
    return params
