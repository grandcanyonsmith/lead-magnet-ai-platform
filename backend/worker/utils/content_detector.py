"""
Content Detector Utility
Detects content type (JSON, HTML, or Markdown) from content and step name.
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
        return '.md'

    content_stripped = str(content).strip()
    step_name_lower = step_name.lower()

    # If the entire output is wrapped in a markdown code fence, unwrap it.
    # This is common when models output JSON/HTML inside ```json / ```html blocks.
    if content_stripped.startswith("```"):
        # Remove opening fence line (``` or ```lang)
        content_stripped = re.sub(r"^```[a-zA-Z0-9_-]*\s*\n?", "", content_stripped)
        # Remove closing fence at end
        content_stripped = re.sub(r"\n?\s*```$", "", content_stripped).strip()

    # Check if content looks like JSON (object or array) and is parseable.
    # We only classify as JSON when parsing succeeds to avoid misclassifying markdown that contains snippets.
    if content_stripped and content_stripped[0] in ["{", "["]:
        try:
            parsed = json.loads(content_stripped)
            if isinstance(parsed, (dict, list)):
                return ".json"
        except Exception:
            pass
    
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
    
    return '.html' if is_html else '.md'

