"""
HTML sanitization utilities.
"""

import re
from typing import Optional


_TEMPLATE_PLACEHOLDER_PATTERN = re.compile(r"\{\{\s*[^{}]+\s*\}\}")
_FORM_BLOCK_PATTERN = re.compile(r"<form\b[^>]*>.*?</form>", flags=re.IGNORECASE | re.DOTALL)
_FORM_ELEMENT_PATTERN = re.compile(r"<(input|select|textarea)\b[^>]*>", flags=re.IGNORECASE)


def strip_template_placeholders(html: Optional[str]) -> Optional[str]:
    """
    Remove any {{PLACEHOLDER}} tokens from HTML output.
    """
    if not isinstance(html, str):
        return html
    if "{{" not in html:
        return html
    return _TEMPLATE_PLACEHOLDER_PATTERN.sub("", html)


def strip_form_elements(html: Optional[str]) -> Optional[str]:
    """
    Remove opt-in/signup form elements from HTML deliverables.
    """
    if not isinstance(html, str):
        return html
    if "<form" not in html and "<input" not in html and "<select" not in html and "<textarea" not in html:
        return html
    cleaned = _FORM_BLOCK_PATTERN.sub("", html)
    cleaned = _FORM_ELEMENT_PATTERN.sub("", cleaned)
    return cleaned
