"""
HTML processing utilities.
"""

import re


def strip_html_tags(text: str) -> str:
    """
    Strip HTML tags from text.
    
    This is a best-effort conversion of HTML-ish strings to plain text so the final
    template render doesn't anchor on intermediate HTML from earlier steps.
    
    Features:
    - Removes <script> and <style> blocks entirely (content included)
    - Removes all other HTML tags (keeping content)
    - Normalizes multiple newlines to double newlines
    
    Args:
        text: The text containing HTML tags
        
    Returns:
        Cleaned text with HTML tags removed
    """
    if not text:
        return ""
    
    # Remove script/style blocks first (including content)
    text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.IGNORECASE | re.DOTALL)
    
    # Remove remaining tags
    text = re.sub(r"<[^>]+>", "", text)
    
    # Normalize whitespace
    # Replace 3 or more newlines with 2
    text = re.sub(r"\n{3,}", "\n\n", text)
    
    return text.strip()

