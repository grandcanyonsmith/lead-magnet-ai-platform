"""
Content Detector Utility
Detects content type (HTML vs Markdown) from content and step name.
"""


def detect_content_type(content: str, step_name: str = '') -> str:
    """
    Detect content type (HTML or Markdown) from content and step name.
    
    Args:
        content: Content string to analyze
        step_name: Optional step name that may hint at content type
        
    Returns:
        File extension string: '.html' or '.md'
    """
    content_stripped = content.strip()
    step_name_lower = step_name.lower()
    
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

