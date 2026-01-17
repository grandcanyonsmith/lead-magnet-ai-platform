"""OpenAI Images API helper functions."""

import inspect
import logging
import re
from typing import Any, Dict, Optional, Tuple, List

logger = logging.getLogger(__name__)


def _filter_generate_params(client: Any, params: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    """
    Remove params not supported by client.images.generate if the signature is strict.
    Returns (filtered_params, dropped_param_names).
    """
    try:
        sig = inspect.signature(client.images.generate)
    except Exception:
        return params, []

    if any(p.kind == p.VAR_KEYWORD for p in sig.parameters.values()):
        return params, []

    allowed = set(sig.parameters.keys())
    dropped = [key for key in params.keys() if key not in allowed]
    if not dropped:
        return params, []
    filtered = {key: value for key, value in params.items() if key in allowed}
    return filtered, dropped


def _remove_unexpected_param(params: Dict[str, Any], error_message: str) -> bool:
    match = re.search(r"unexpected keyword argument '([^']+)'", error_message)
    if not match:
        return False
    bad_param = match.group(1)
    if bad_param not in params:
        return False
    params.pop(bad_param, None)
    logger.warning(
        "[OpenAI Images] Removed unsupported param after TypeError",
        extra={"param": bad_param},
    )
    return True


def generate_images(
    client: Any,
    *,
    model: str,
    prompt: str,
    n: int = 1,
    size: str = "auto",
    quality: str = "auto",
    background: Optional[str] = None,
    output_format: Optional[str] = None,
    output_compression: Optional[int] = None,
    response_format: str = "b64_json",
    user: Optional[str] = None,
):
    """
    Generate images using the OpenAI Images API.

    NOTE: Some image models (e.g., gpt-image-1.5) are supported via Images API,
    not via the Responses API image_generation tool.
    """
    # The Images API has model-specific parameter support.
    # - gpt-image-* models support output_format/output_compression/background and return b64_json.
    #   They do NOT accept the legacy `response_format` param (OpenAI returns: Unknown parameter).
    # - dalle-* models support legacy `response_format` ("url" | "b64_json") and do not support
    #   output_format/output_compression/background.
    is_gpt_image = isinstance(model, str) and model.strip().lower().startswith("gpt-image")

    params: Dict[str, Any] = {"model": model, "prompt": prompt, "n": n}

    # Optional/legacy: only send when not "auto" to avoid unsupported values on older models.
    if size and size != "auto":
        params["size"] = size
    if quality and quality != "auto":
        params["quality"] = quality

    if is_gpt_image:
        if background and background != "auto":
            params["background"] = background
        if output_format and output_format != "auto":
            params["output_format"] = output_format
        if output_compression is not None:
            params["output_compression"] = output_compression
    else:
        # Legacy models (e.g., dalle-*) use response_format.
        if response_format:
            params["response_format"] = response_format

    if user is not None:
        params["user"] = user

    params, dropped = _filter_generate_params(client, params)
    if dropped:
        logger.info(
            "[OpenAI Images] Dropped unsupported images.generate params",
            extra={"dropped_params": dropped, "model": model},
        )

    try:
        return client.images.generate(**params)
    except TypeError as e:
        msg = str(e)
        if _remove_unexpected_param(params, msg):
            return client.images.generate(**params)
        raise
    except Exception as e:
        # Defensive fallback for real-world OpenAI param differences.
        msg = str(e)
        if "Unknown parameter: 'response_format'" in msg and "response_format" in params:
            params.pop("response_format", None)
            return client.images.generate(**params)
        logger.error(
            "[OpenAI Images] Images API call failed",
            extra={
                "model": model,
                "params_keys": list(params.keys()),
                "prompt_length": len(prompt) if isinstance(prompt, str) else None,
                "error": msg,
            },
        )
        raise
