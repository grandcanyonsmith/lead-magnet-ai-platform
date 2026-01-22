"""
HTML sanitization utilities.
"""

import re
from typing import Optional


_TEMPLATE_PLACEHOLDER_PATTERN = re.compile(r"\{\{\s*[^{}]+\s*\}\}")


def strip_template_placeholders(html: Optional[str]) -> Optional[str]:
    """
    Remove any {{PLACEHOLDER}} tokens from HTML output.
    """
    if not isinstance(html, str):
        return html
    if "{{" not in html:
        return html
    return _TEMPLATE_PLACEHOLDER_PATTERN.sub("", html)
