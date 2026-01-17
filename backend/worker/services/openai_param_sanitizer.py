"""OpenAI parameter sanitation helpers."""

import logging
from typing import Any, Dict

from utils.decimal_utils import convert_decimals_to_float

logger = logging.getLogger(__name__)


def _strip_key_recursive(obj: Any, key_to_strip: str) -> Any:
    if isinstance(obj, dict):
        return {
            k: _strip_key_recursive(v, key_to_strip)
            for k, v in obj.items()
            if k != key_to_strip
        }
    if isinstance(obj, list):
        return [_strip_key_recursive(v, key_to_strip) for v in obj]
    return obj


def sanitize_api_params(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Remove internal-only keys that should never be sent to OpenAI.
    Also converts all Decimal values to float to prevent JSON serialization errors.
    """
    api_params = dict(params)
    api_params.pop("job_id", None)
    api_params.pop("tenant_id", None)
    # The Responses API rejects unknown fields on input items; we sometimes annotate
    # internal events with `is_error`, so strip it defensively before sending.
    api_params = _strip_key_recursive(api_params, "is_error")

    # Convert all Decimal values to float to prevent JSON serialization errors
    # This handles Decimal values that might be present in input, instructions, tools, etc.
    api_params = convert_decimals_to_float(api_params)

    # Normalize legacy token limit params to Responses API shape.
    # If upstream sends max_tokens or max_completion_tokens, map to max_output_tokens.
    if "max_output_tokens" not in api_params:
        if api_params.get("max_completion_tokens") is not None:
            api_params["max_output_tokens"] = api_params.pop("max_completion_tokens")
        elif api_params.get("max_tokens") is not None:
            api_params["max_output_tokens"] = api_params.pop("max_tokens")
    else:
        api_params.pop("max_completion_tokens", None)
        api_params.pop("max_tokens", None)

    # OpenAI requires certain fields to be integers. DynamoDB often stores numbers as Decimal,
    # and our Decimal -> float conversion can turn whole numbers into floats (e.g., 2048.0),
    # which the OpenAI API will reject for integer-typed params like `max_output_tokens`.
    if api_params.get("max_output_tokens") is not None:
        raw_max_output_tokens = api_params.get("max_output_tokens")
        try:
            if isinstance(raw_max_output_tokens, bool):
                raise ValueError("max_output_tokens must be an int, not bool")

            if isinstance(raw_max_output_tokens, float):
                if not raw_max_output_tokens.is_integer():
                    logger.warning(
                        "[OpenAI Client] max_output_tokens was a non-integer float; truncating",
                        extra={"max_output_tokens": raw_max_output_tokens},
                    )
                max_output_tokens = int(raw_max_output_tokens)
            else:
                max_output_tokens = int(raw_max_output_tokens)

            if max_output_tokens > 0:
                api_params["max_output_tokens"] = max_output_tokens
            else:
                api_params.pop("max_output_tokens", None)
        except Exception as e:
            logger.warning(
                "[OpenAI Client] Invalid max_output_tokens; omitting to avoid API error",
                extra={"max_output_tokens": str(raw_max_output_tokens), "error": str(e)},
            )
            api_params.pop("max_output_tokens", None)

    return api_params
