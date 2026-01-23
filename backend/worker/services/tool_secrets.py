"""
Tool secrets utilities.

Provides normalization, prompt injection, and log redaction helpers
for secrets configured in tenant settings.
"""
from __future__ import annotations

import logging
import os
import re
from typing import Any, Dict, Optional

import boto3

logger = logging.getLogger(__name__)

TOOL_SECRETS_START = "<<TOOL_SECRETS_START>>"
TOOL_SECRETS_END = "<<TOOL_SECRETS_END>>"

_SECRET_BLOCK_PATTERN = re.compile(
    re.escape(TOOL_SECRETS_START) + r".*?" + re.escape(TOOL_SECRETS_END),
    re.DOTALL,
)
_ENV_KEY_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def normalize_tool_secrets(raw: Any) -> Dict[str, str]:
    if not isinstance(raw, dict):
        return {}
    normalized: Dict[str, str] = {}
    for key, value in raw.items():
        try:
            key_str = str(key).strip()
        except Exception:
            continue
        if not key_str or not _ENV_KEY_PATTERN.match(key_str):
            logger.warning(
                "[ToolSecrets] Skipping invalid secret key",
                extra={"key": key_str},
            )
            continue
        if value is None:
            continue
        try:
            value_str = str(value)
        except Exception:
            continue
        if not value_str.strip():
            continue
        normalized[key_str] = value_str
    return normalized


def build_tool_secrets_block(tool_secrets: Dict[str, str]) -> str:
    if not tool_secrets:
        return ""
    lines = [
        TOOL_SECRETS_START,
        "Tool secrets are available for shell and computer use. Use them as needed and never print them.",
        "Secrets:",
    ]
    for key in sorted(tool_secrets.keys()):
        lines.append(f"- {key}={tool_secrets[key]}")
    lines.append(TOOL_SECRETS_END)
    return "\n".join(lines)


def append_tool_secrets(instructions: str, tool_secrets: Dict[str, str]) -> str:
    block = build_tool_secrets_block(tool_secrets)
    if not block:
        return instructions
    base = (instructions or "").rstrip()
    if not base:
        return block
    return f"{base}\n\n{block}"


def redact_tool_secrets_text(text: Optional[str]) -> Optional[str]:
    if not text:
        return text
    return _SECRET_BLOCK_PATTERN.sub("[TOOL_SECRETS_REDACTED]", text)


def redact_tool_secrets_value(value: Any) -> Any:
    if isinstance(value, str):
        return redact_tool_secrets_text(value)
    if isinstance(value, list):
        return [redact_tool_secrets_value(item) for item in value]
    if isinstance(value, dict):
        return {k: redact_tool_secrets_value(v) for k, v in value.items()}
    return value


def _fetch_settings_from_dynamodb(tenant_id: str) -> Optional[Dict[str, Any]]:
    table_name = (os.environ.get("USER_SETTINGS_TABLE") or "").strip()
    if not table_name:
        return None
    region = os.environ.get("AWS_REGION", "us-east-1")
    try:
        dynamodb = boto3.resource("dynamodb", region_name=region)
        table = dynamodb.Table(table_name)
        response = table.get_item(Key={"tenant_id": tenant_id})
        return response.get("Item")
    except Exception:
        logger.debug(
            "[ToolSecrets] Failed to fetch settings from DynamoDB",
            extra={"tenant_id": tenant_id},
            exc_info=True,
        )
        return None


def get_tool_secrets(db_service: Optional[Any], tenant_id: Optional[str]) -> Dict[str, str]:
    if not tenant_id:
        return {}
    settings: Optional[Dict[str, Any]] = None
    if db_service is not None:
        try:
            settings = db_service.get_settings(tenant_id)
        except Exception:
            settings = None
    if settings is None:
        settings = _fetch_settings_from_dynamodb(tenant_id)
    return normalize_tool_secrets((settings or {}).get("tool_secrets"))
