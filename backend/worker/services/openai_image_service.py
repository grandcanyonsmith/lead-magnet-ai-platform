"""OpenAI Images API helper functions."""

from typing import Any, Dict, Optional


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

    try:
        return client.images.generate(**params)
    except Exception as e:
        # Defensive fallback for real-world OpenAI param differences.
        msg = str(e)
        if "Unknown parameter: 'response_format'" in msg and "response_format" in params:
            params.pop("response_format", None)
            return client.images.generate(**params)
        raise
