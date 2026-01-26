import json
from typing import Any, Dict, Set

def get_attr_or_key(obj: Any, key: str) -> Any:
    if isinstance(obj, dict):
        return obj.get(key)
    return getattr(obj, key, None)

def to_dict(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            # If it's a simple string that isn't JSON, wrap it (defensive)
            # But for function args, it should be JSON.
            return {}
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if hasattr(value, "dict"):
        return value.dict()
    return {}

FILE_LIKE_TLDS = {
    "pdf", "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tif", "tiff",
    "txt", "csv", "json", "xml", "html", "htm", "md",
    "zip", "tar", "gz", "tgz", "bz2", "7z", "rar",
    "mp3", "mp4", "mov", "avi", "mkv", "wav", "flac",
}

def is_likely_filename_domain(domain: str) -> bool:
    if not domain or "." not in domain:
        return False
    tld = domain.rsplit(".", 1)[-1].lower()
    return tld in FILE_LIKE_TLDS

def supports_responses_api(openai_client: Any) -> bool:
    try:
        supports = getattr(openai_client, "supports_responses", None)
        if callable(supports):
            return bool(supports())
    except Exception:
        return False
    try:
        client = getattr(openai_client, "client", openai_client)
        responses_client = getattr(client, "responses", None)
        return callable(getattr(responses_client, "create", None))
    except Exception:
        return False

def get_responses_client(openai_client: Any) -> Any:
    try:
        client = getattr(openai_client, "client", openai_client)
        return getattr(client, "responses", None)
    except Exception:
        return None

def is_incomplete_openai_stream_error(err: Exception) -> bool:
    """
    The OpenAI Python SDK streaming iterator expects a terminal `response.completed`
    event. If the underlying connection is interrupted, the SDK raises:
      RuntimeError: Didn't receive a `response.completed` event.

    This is typically transient; callers should retry or fall back to non-streaming.
    """
    try:
        msg = str(err) or ""
    except Exception:
        msg = ""
    lower = msg.lower()
    if "response.completed" in lower and ("didn't receive" in lower or "did not receive" in lower):
        return True
    # Defensive: treat common network-ish exceptions as transient even without the exact message
    if type(err).__name__ in ("APIConnectionError", "APITimeoutError", "ReadTimeout", "ConnectTimeout"):
        return True
    return False
