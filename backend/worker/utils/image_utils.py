"""
Image URL extraction utilities
"""

import re
import logging
from typing import List, Any, Set, Tuple
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


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


def is_base64_data_url(url: str) -> bool:
    """
    Check if a URL is a base64 data URL.
    
    Args:
        url: URL to check
        
    Returns:
        True if URL is a base64 data URL (format: data:image/...;base64,...)
    """
    if not url or not isinstance(url, str):
        return False
    return url.startswith('data:image/') and ';base64,' in url


def is_valid_http_url(url: str) -> bool:
    """
    Check if a URL is a valid HTTP/HTTPS URL.
    
    Args:
        url: URL to check
        
    Returns:
        True if URL is a valid HTTP/HTTPS URL
    """
    if not url or not isinstance(url, str):
        return False
    
    try:
        parsed = urlparse(url)
        return parsed.scheme in ('http', 'https') and parsed.netloc != ''
    except Exception:
        return False


def validate_image_url_for_openai(url: str) -> Tuple[bool, str]:
    """
    Validate that an image URL is suitable for OpenAI API.
    
    OpenAI API accepts:
    - HTTP/HTTPS URLs pointing to images
    - Base64 data URLs (data:image/...;base64,...)
    
    However, we filter out base64 data URLs because:
    1. They should have been converted to S3 URLs already
    2. They can be very large and cause API errors
    3. Corrupted base64 data causes validation errors
    
    Args:
        url: Image URL to validate
        
    Returns:
        Tuple of (is_valid, reason)
        - is_valid: True if URL is valid for OpenAI API
        - reason: Reason string if invalid, empty string if valid
    """
    if not url or not isinstance(url, str):
        return False, "URL is empty or not a string"
    
    # Filter out base64 data URLs - they should be S3 URLs by this point
    if is_base64_data_url(url):
        return False, "Base64 data URL detected (should be converted to S3 URL)"
    
    # Only allow HTTP/HTTPS URLs
    if not is_valid_http_url(url):
        return False, "Not a valid HTTP/HTTPS URL"
    
    # Check if it looks like an image URL (optional, but helpful)
    if not is_image_url(url):
        logger.warning(f"URL does not have image extension: {url[:100]}")
        # Don't reject it - some URLs might not have extensions but still be valid images
    
    return True, ""


def validate_and_filter_image_urls(
    image_urls: List[str],
    job_id: str = None,
    tenant_id: str = None
) -> Tuple[List[str], List[Tuple[str, str]]]:
    """
    Validate and filter a list of image URLs for OpenAI API.
    
    Filters out:
    - Base64 data URLs (should be S3 URLs)
    - Invalid HTTP/HTTPS URLs
    - Empty or None values
    
    Args:
        image_urls: List of image URLs to validate
        job_id: Optional job ID for logging
        tenant_id: Optional tenant ID for logging
        
    Returns:
        Tuple of (valid_urls, filtered_urls_with_reasons)
        - valid_urls: List of valid image URLs
        - filtered_urls_with_reasons: List of tuples (url, reason) for filtered URLs
    """
    if not image_urls:
        return [], []
    
    valid_urls = []
    filtered_urls = []
    
    for url in image_urls:
        # Skip empty/None values
        if not url:
            filtered_urls.append((str(url), "Empty or None value"))
            continue
        
        # Validate URL
        is_valid, reason = validate_image_url_for_openai(url)
        
        if is_valid:
            valid_urls.append(url)
        else:
            filtered_urls.append((url, reason))
            logger.warning(f"[Image Utils] Filtered invalid image URL", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'url_preview': url[:100] + '...' if len(url) > 100 else url,
                'reason': reason
            })
    
    if filtered_urls:
        logger.info(f"[Image Utils] Filtered {len(filtered_urls)} invalid image URL(s), {len(valid_urls)} valid URL(s) remaining", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'total_urls': len(image_urls),
            'valid_urls_count': len(valid_urls),
            'filtered_urls_count': len(filtered_urls),
            'filtered_reasons': [reason for _, reason in filtered_urls]
        })
    
    return valid_urls, filtered_urls

