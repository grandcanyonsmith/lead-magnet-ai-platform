"""
Content Detector Utility
Detects content type (HTML vs Markdown) from content and step name.
"""

import json
import re


def detect_content_type(content: str, step_name: str = '') -> str:
    """
    Detect content type (JSON, HTML, or Markdown) from content and step name.
    
    Args:
        content: Content string to analyze
        step_name: Optional step name that may hint at content type
        
    Returns:
        File extension string: '.json', '.html', or '.md'
    """
    if content is None:
        # #region agent log
        try:
            import time as _time
            with open('/Users/canyonsmith/lead-magnent-ai/.cursor/debug.log', 'a') as _f:
                _f.write(json.dumps({
                    "sessionId": "debug-session",
                    "runId": "test-json-1",
                    "hypothesisId": "H_json_detect",
                    "location": "backend/worker/utils/content_detector.py:detect_content_type",
                    "message": "content is None; defaulting to .md",
                    "data": {"stepName": str(step_name)[:80]},
                    "timestamp": int(_time.time() * 1000),
                }) + "\n")
        except Exception:
            pass
        # #endregion
        return '.md'

    content_stripped = str(content).strip()
    step_name_lower = step_name.lower()
    _starts_with_fence = content_stripped.startswith("```")
    _first_char = content_stripped[:1]

    # If the entire output is wrapped in a markdown code fence, unwrap it.
    # This is common when models output JSON/HTML inside ```json / ```html blocks.
    _unwrapped = False
    if content_stripped.startswith("```"):
        # Remove opening fence line (``` or ```lang)
        content_stripped = re.sub(r"^```[a-zA-Z0-9_-]*\s*\n?", "", content_stripped)
        # Remove closing fence at end
        content_stripped = re.sub(r"\n?\s*```$", "", content_stripped).strip()
        _unwrapped = True

    # Check if content looks like JSON (object or array) and is parseable.
    # We only classify as JSON when parsing succeeds to avoid misclassifying markdown that contains snippets.
    _json_parse_ok = False
    if content_stripped and content_stripped[0] in ["{", "["]:
        try:
            parsed = json.loads(content_stripped)
            if isinstance(parsed, (dict, list)):
                _json_parse_ok = True
        except Exception:
            pass
    if _json_parse_ok:
        # #region agent log
        try:
            import time as _time
            with open('/Users/canyonsmith/lead-magnent-ai/.cursor/debug.log', 'a') as _f:
                _f.write(json.dumps({
                    "sessionId": "debug-session",
                    "runId": "test-json-1",
                    "hypothesisId": "H_json_detect",
                    "location": "backend/worker/utils/content_detector.py:detect_content_type",
                    "message": "Detected JSON output",
                    "data": {
                        "stepName": str(step_name)[:80],
                        "contentLen": len(str(content)),
                        "startsWithFence": _starts_with_fence,
                        "unwrapped": _unwrapped,
                        "firstChar": _first_char,
                        "resultExt": ".json",
                    },
                    "timestamp": int(_time.time() * 1000),
                }) + "\n")
        except Exception:
            pass
        # #endregion
        return ".json"
    
    # Check if content looks like HTML
    is_html = (
        content_stripped.startswith('<!DOCTYPE') or
        content_stripped.startswith('<!doctype') or
        content_stripped.startswith('<html') or
        content_stripped.startswith('<HTML') or
        (content_stripped.startswith('<') and 
         any(tag in content_stripped[:200].lower() for tag in [
             '<html', '<head', '<body', '<div', '<p>', '<h1', '<h2', '<h3'
         ])) or
        'html' in step_name_lower  # Step name hint (e.g., "Landing Page HTML")
    )
    
    result_ext = '.html' if is_html else '.md'
    # #region agent log
    try:
        import time as _time
        with open('/Users/canyonsmith/lead-magnent-ai/.cursor/debug.log', 'a') as _f:
            _f.write(json.dumps({
                "sessionId": "debug-session",
                "runId": "test-json-1",
                "hypothesisId": "H_json_detect",
                "location": "backend/worker/utils/content_detector.py:detect_content_type",
                "message": "Detected non-JSON output",
                "data": {
                    "stepName": str(step_name)[:80],
                    "contentLen": len(str(content)),
                    "startsWithFence": _starts_with_fence,
                    "unwrapped": _unwrapped,
                    "firstChar": _first_char,
                    "isHtml": bool(is_html),
                    "resultExt": result_ext,
                },
                "timestamp": int(_time.time() * 1000),
            }) + "\n")
    except Exception:
        pass
    # #endregion
    return result_ext

