"""
Image URL extraction utilities
"""

import re
from typing import List, Any, Set


def extract_image_urls(text: str) -> List[str]:
    """
    Extract image URLs from text content.
    Supports: png, jpg, jpeg, gif, webp, svg, bmp, ico
    Handles URLs with query parameters.
    
    Args:
        text: Text content to search for image URLs
        
    Returns:
        List of unique image URLs found in the text
    """
    if not text or not isinstance(text, str):
        return []
    
    # Regex pattern to match image URLs
    # Matches URLs ending with image extensions, optionally followed by query parameters
    # Using non-capturing groups to get full URLs
    image_url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp|ico)(?:\?[^\s<>"{}|\\^`\[\]]*)?'
    
    matches = re.findall(image_url_pattern, text, re.IGNORECASE)
    if not matches:
        return []
    
    # Remove duplicates and return
    return list(set(matches))


def is_image_url(url: str) -> bool:
    """
    Check if a URL is an image URL.
    
    Args:
        url: URL to check
        
    Returns:
        True if URL appears to be an image URL
    """
    if not url or not isinstance(url, str):
        return False
    return bool(re.search(r'\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)(\?.*)?$', url, re.IGNORECASE))


def extract_image_urls_from_object(obj: Any) -> List[str]:
    """
    Recursively extract image URLs from an object (for JSON content).
    
    Args:
        obj: Object to search (dict, list, str, etc.)
        
    Returns:
        List of unique image URLs found in the object
    """
    if not obj:
        return []
    
    urls: Set[str] = set()
    
    if isinstance(obj, str):
        urls.update(extract_image_urls(obj))
    elif isinstance(obj, list):
        for item in obj:
            urls.update(extract_image_urls_from_object(item))
    elif isinstance(obj, dict):
        for value in obj.values():
            urls.update(extract_image_urls_from_object(value))
    
    return list(urls)

