"""Chat-completions fallback utilities for OpenAI."""

from typing import Any, Dict, List, Optional

import openai


def supports_chat_completions(client: Any) -> bool:
    """Return True if the client supports chat completions."""
    try:
        return hasattr(client, "chat") and hasattr(client.chat, "completions")
    except Exception:
        return False


def _coerce_content_to_text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: List[str] = []
        for item in content:
            if isinstance(item, dict):
                item_type = item.get("type")
                if item_type in ("input_text", "text"):
                    text = item.get("text")
                    if text:
                        parts.append(str(text))
                    continue
                if "text" in item:
                    text = item.get("text")
                    if text:
                        parts.append(str(text))
                    continue
                if item_type in ("input_image", "image_url"):
                    # Images cannot be sent in chat completions fallback.
                    continue
            elif isinstance(item, str):
                parts.append(item)
        return "\n".join([p for p in parts if p])
    if isinstance(content, dict):
        if content.get("type") in ("input_text", "text") and "text" in content:
            return str(content.get("text", ""))
        if "text" in content:
            return str(content.get("text", ""))
    try:
        return str(content)
    except Exception:
        return ""


def _coerce_input_to_text(input_value: Any) -> str:
    if input_value is None:
        return ""
    if isinstance(input_value, str):
        return input_value
    if isinstance(input_value, list):
        parts: List[str] = []
        for item in input_value:
            if isinstance(item, dict) and "role" in item and "content" in item:
                part = _coerce_content_to_text(item.get("content"))
            else:
                part = _coerce_content_to_text(item)
            if part:
                parts.append(part)
        return "\n".join(parts)
    if isinstance(input_value, dict):
        if "text" in input_value:
            return str(input_value.get("text", ""))
        if "content" in input_value:
            return _coerce_content_to_text(input_value.get("content"))
    try:
        return str(input_value)
    except Exception:
        return ""


def build_chat_messages(instructions: str, input_value: Any) -> List[Dict[str, Any]]:
    messages: List[Dict[str, Any]] = []
    if isinstance(instructions, str) and instructions.strip():
        messages.append({"role": "system", "content": instructions})

    if isinstance(input_value, list) and all(isinstance(i, dict) and "role" in i for i in input_value):
        for item in input_value:
            role = item.get("role") or "user"
            content_text = _coerce_content_to_text(item.get("content"))
            if content_text:
                messages.append({"role": role, "content": content_text})
    else:
        user_text = _coerce_input_to_text(input_value)
        messages.append({"role": "user", "content": user_text})

    if len(messages) == 1 and messages[0].get("role") == "system":
        messages.append({"role": "user", "content": ""})
    if not messages:
        messages = [{"role": "user", "content": ""}]

    return messages


def build_chat_response_format(text_cfg: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(text_cfg, dict):
        return None
    fmt = text_cfg.get("format")
    if not isinstance(fmt, dict):
        return None
    fmt_type = fmt.get("type")
    if fmt_type == "json_object":
        return {"type": "json_object"}
    if fmt_type == "json_schema":
        name = fmt.get("name")
        schema = fmt.get("schema")
        if not (isinstance(name, str) and name and isinstance(schema, dict) and schema):
            return None
        json_schema: Dict[str, Any] = {
            "name": name,
            "schema": schema,
        }
        description = fmt.get("description")
        if isinstance(description, str) and description:
            json_schema["description"] = description
        strict = fmt.get("strict")
        if isinstance(strict, bool):
            json_schema["strict"] = strict
        return {"type": "json_schema", "json_schema": json_schema}
    return None


def build_chat_completion_params(api_params: Dict[str, Any]) -> Dict[str, Any]:
    params = dict(api_params)
    instructions = params.pop("instructions", "")
    input_value = params.pop("input", "")
    max_output_tokens = params.pop("max_output_tokens", None)
    text_cfg = params.pop("text", None)

    params.pop("reasoning", None)
    params.pop("service_tier", None)
    params.pop("previous_response_id", None)

    params["messages"] = build_chat_messages(instructions, input_value)

    if (
        max_output_tokens is not None
        and "max_completion_tokens" not in params
        and "max_tokens" not in params
    ):
        params["max_completion_tokens"] = max_output_tokens

    response_format = build_chat_response_format(text_cfg)
    if response_format:
        params["response_format"] = response_format

    tools = params.get("tools")
    tool_choice = params.get("tool_choice")
    if tools:
        filtered_tools = [
            tool for tool in tools
            if isinstance(tool, dict) and tool.get("type") == "function"
        ]
        if filtered_tools:
            params["tools"] = filtered_tools
            if tool_choice:
                params["tool_choice"] = tool_choice
        else:
            params.pop("tools", None)
            params.pop("tool_choice", None)
    elif tool_choice:
        params.pop("tool_choice", None)

    return params


def chat_completions_create(client: Any, **params):
    if supports_chat_completions(client):
        return client.chat.completions.create(**params)
    if hasattr(openai, "ChatCompletion"):
        return openai.ChatCompletion.create(**params)
    raise AttributeError("OpenAI client does not support chat completions")


def create_chat_completion_fallback(client: Any, api_params: Dict[str, Any]):
    chat_params = build_chat_completion_params(api_params)
    for _ in range(3):
        try:
            return chat_completions_create(client, **chat_params)
        except openai.BadRequestError as e:
            error_message = str(e)
            error_body = getattr(e, "body", {}) or {}
            error_info = error_body.get("error", {}) if isinstance(error_body, dict) else {}
            error_param = error_info.get("param") if isinstance(error_info, dict) else None
            updated = False

            def _param_unsupported(param_name: str) -> bool:
                unsupported_marker = (
                    "Unsupported parameter" in error_message
                    or "Unknown parameter" in error_message
                    or "not supported" in error_message
                )
                if isinstance(error_param, str):
                    return (
                        unsupported_marker
                        and (
                            error_param == param_name
                            or error_param.startswith(f"{param_name}.")
                            or error_param.startswith(f"{param_name}[")
                        )
                    )
                return unsupported_marker and param_name in error_message

            if _param_unsupported("max_tokens"):
                max_tokens_value = chat_params.pop("max_tokens", None)
                if max_tokens_value is not None and "max_completion_tokens" not in chat_params:
                    chat_params["max_completion_tokens"] = max_tokens_value
                    updated = True
            elif _param_unsupported("max_completion_tokens"):
                max_completion_tokens_value = chat_params.pop("max_completion_tokens", None)
                if max_completion_tokens_value is not None and "max_tokens" not in chat_params:
                    chat_params["max_tokens"] = max_completion_tokens_value
                    updated = True

            if (
                "response_format" in error_message
                or (isinstance(error_param, str) and "response_format" in error_param)
            ):
                if "response_format" in chat_params:
                    chat_params.pop("response_format", None)
                    updated = True

            if updated:
                continue
            raise
