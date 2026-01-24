"""Prompt override utilities for worker-side AI calls."""
from __future__ import annotations

import re
from typing import Any, Dict, Optional


def _coerce_prompt_text(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    if not value.strip():
        return None
    return value


def normalize_prompt_overrides(raw: Any) -> Optional[Dict[str, Dict[str, Any]]]:
    if not isinstance(raw, dict):
        return None
    normalized: Dict[str, Dict[str, Any]] = {}
    for key, value in raw.items():
        if not isinstance(value, dict):
            continue
        instructions = _coerce_prompt_text(value.get("instructions"))
        prompt = _coerce_prompt_text(value.get("prompt"))
        enabled = value.get("enabled")
        enabled_flag = enabled if isinstance(enabled, bool) else None
        if instructions or prompt or enabled_flag is not None:
            normalized[key] = {}
            if enabled_flag is not None:
                normalized[key]["enabled"] = enabled_flag
            if instructions:
                normalized[key]["instructions"] = instructions
            if prompt:
                normalized[key]["prompt"] = prompt
    return normalized


def apply_prompt_template(
    template: Optional[str], variables: Dict[str, Optional[str]]
) -> Optional[str]:
    if not template:
        return template

    pattern = re.compile(r"\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}")

    def replace(match: re.Match[str]) -> str:
        key = match.group(1)
        value = variables.get(key)
        if value is None:
            return match.group(0)
        return str(value)

    return pattern.sub(replace, template)


def resolve_prompt_override(
    key: str,
    defaults: Dict[str, Any],
    overrides: Optional[Dict[str, Dict[str, Any]]],
    variables: Optional[Dict[str, Optional[str]]] = None,
) -> Dict[str, Any]:
    override = overrides.get(key) if overrides else None
    enabled = True
    if isinstance(override, dict) and isinstance(override.get("enabled"), bool):
        enabled = bool(override.get("enabled"))

    instructions = defaults.get("instructions")
    prompt = defaults.get("prompt")
    model = defaults.get("model")
    tools = defaults.get("tools")
    tool_choice = defaults.get("tool_choice")
    service_tier = defaults.get("service_tier")
    reasoning_effort = defaults.get("reasoning_effort")
    text_verbosity = defaults.get("text_verbosity")

    if enabled and isinstance(override, dict):
        instructions = override.get("instructions") or instructions
        prompt = override.get("prompt") or prompt
        model = override.get("model") or model
        tools = override.get("tools") or tools
        tool_choice = override.get("tool_choice") or tool_choice
        service_tier = override.get("service_tier") or service_tier
        reasoning_effort = override.get("reasoning_effort") or reasoning_effort
        text_verbosity = override.get("text_verbosity") or text_verbosity

    resolved_vars = variables or {}
    return {
        "instructions": apply_prompt_template(instructions, resolved_vars),
        "prompt": apply_prompt_template(prompt, resolved_vars),
        "model": model,
        "tools": tools,
        "tool_choice": tool_choice,
        "service_tier": service_tier,
        "reasoning_effort": reasoning_effort,
        "text_verbosity": text_verbosity,
    }


def get_prompt_overrides(
    db_service: Optional[Any],
    tenant_id: Optional[str],
) -> Optional[Dict[str, Dict[str, Any]]]:
    if not db_service or not tenant_id:
        return None
    try:
        settings = db_service.get_settings(tenant_id) or {}
    except Exception:
        return None
    return normalize_prompt_overrides(settings.get("prompt_overrides"))
