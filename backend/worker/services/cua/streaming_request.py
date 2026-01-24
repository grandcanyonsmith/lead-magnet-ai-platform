from dataclasses import dataclass
from typing import Dict, Any, List, Optional, Tuple


@dataclass(frozen=True)
class NormalizedCUARequest:
    job_id: Optional[str]
    tenant_id: Optional[str]
    model: str
    requested_model: str
    instructions: str
    input_text: str
    tools: List[Any]
    tool_choice: str
    params: Dict[str, Any]
    max_iterations: int
    max_duration_seconds: int
    aws_env_overrides: Dict[str, str]
    aws_shell_forced: bool
    has_computer_use: bool
    has_image_generation: bool
    tool_types: List[Any]
    image_tool_model: Optional[str]


def normalize_stream_request(event: Optional[Dict[str, Any]]) -> NormalizedCUARequest:
    payload: Dict[str, Any] = event if isinstance(event, dict) else {}

    job_id = payload.get("job_id")
    tenant_id = payload.get("tenant_id")
    model = payload.get("model", "computer-use-preview")
    requested_model = model
    instructions = payload.get("instructions", "") or ""
    input_text = payload.get("input_text", "") or ""
    tools = _normalize_tools(payload.get("tools", []))
    tool_choice = payload.get("tool_choice", "auto")
    params = payload.get("params", {}) if isinstance(payload.get("params"), dict) else {}
    max_iterations = _coerce_int(payload.get("max_iterations", 100), 100)
    max_duration = _coerce_int(payload.get("max_duration_seconds", 900), 900)

    aws_credentials = payload.get("aws_credentials") if isinstance(payload, dict) else None
    aws_env_overrides = _build_aws_env_overrides(aws_credentials)

    tools, aws_shell_forced = _coerce_tools_for_aws(instructions, input_text, tools)

    tool_types, has_image_generation, image_tool_model = _collect_tool_metadata(tools)
    has_computer_use = _has_computer_use(tools)

    if has_computer_use and model != "computer-use-preview":
        model = "computer-use-preview"

    return NormalizedCUARequest(
        job_id=job_id,
        tenant_id=tenant_id,
        model=model,
        requested_model=requested_model,
        instructions=instructions,
        input_text=input_text,
        tools=tools,
        tool_choice=tool_choice,
        params=params,
        max_iterations=max_iterations,
        max_duration_seconds=max_duration,
        aws_env_overrides=aws_env_overrides,
        aws_shell_forced=aws_shell_forced,
        has_computer_use=has_computer_use,
        has_image_generation=has_image_generation,
        tool_types=tool_types,
        image_tool_model=image_tool_model,
    )


def _coerce_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _normalize_tools(tools: Any) -> List[Any]:
    if not tools:
        return []
    if isinstance(tools, list):
        return tools
    return [tools]


def _build_aws_env_overrides(aws_credentials: Any) -> Dict[str, str]:
    overrides: Dict[str, str] = {}
    if not isinstance(aws_credentials, dict):
        return overrides
    for key in (
        "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY",
        "AWS_SESSION_TOKEN",
        "AWS_REGION",
        "AWS_DEFAULT_REGION",
        "AWS_PROFILE",
    ):
        value = aws_credentials.get(key)
        if isinstance(value, str) and value.strip():
            overrides[key] = value.strip()
    return overrides


def _is_aws_task(text: str) -> bool:
    if not text:
        return False
    lowered = text.lower()
    return any(
        token in lowered
        for token in (
            "aws",
            "s3",
            "s3://",
            "bucket",
            "presigned",
            "iam",
            "aws_access_key",
            "aws_secret_access_key",
            "aws session token",
            "upload to s3",
            "s3 upload",
        )
    )


def _coerce_tools_for_aws(
    instructions: str,
    input_text: str,
    tools: List[Any],
) -> Tuple[List[Any], bool]:
    if not _is_aws_task(f"{instructions}\n{input_text}"):
        return tools, False

    has_shell = any(
        (isinstance(t, str) and t == "shell")
        or (isinstance(t, dict) and t.get("type") == "shell")
        for t in (tools or [])
    )
    had_code_interpreter = any(
        (isinstance(t, str) and t == "code_interpreter")
        or (isinstance(t, dict) and t.get("type") == "code_interpreter")
        for t in (tools or [])
    )

    if not had_code_interpreter and has_shell:
        return tools, False

    coerced = [
        t
        for t in (tools or [])
        if not (
            (isinstance(t, str) and t == "code_interpreter")
            or (isinstance(t, dict) and t.get("type") == "code_interpreter")
        )
    ]
    if not has_shell:
        coerced.append({"type": "shell"})

    return coerced, True


def _collect_tool_metadata(tools: List[Any]) -> Tuple[List[Any], bool, Optional[str]]:
    tool_types: List[Any] = []
    image_tool_model: Optional[str] = None
    for t in tools or []:
        if isinstance(t, dict):
            tool_type = t.get("type")
            tool_types.append(tool_type)
            if tool_type == "image_generation" and isinstance(t.get("model"), str):
                image_tool_model = t.get("model")
        else:
            tool_types.append(t)
    has_image_generation = any(tt == "image_generation" for tt in tool_types)
    return tool_types, has_image_generation, image_tool_model


def _has_computer_use(tools: List[Any]) -> bool:
    return any(
        (isinstance(t, str) and t == "computer_use_preview")
        or (isinstance(t, dict) and t.get("type") == "computer_use_preview")
        for t in tools or []
    )
