"""
Image URL extraction utilities
"""

import re
import base64
import logging
import requests
from typing import List, Any, Set, Tuple, Optional
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


def is_problematic_url(url: str) -> bool:
    """
    Check if a URL is problematic for OpenAI API to access directly.
    
    Some URLs (like Firebase Storage URLs) may require authentication or
    have access restrictions that prevent OpenAI's servers from downloading them.
    These URLs should be downloaded locally and converted to base64 data URLs.
    
    Args:
        url: URL to check
        
    Returns:
        True if URL is problematic and should be downloaded locally
    """
    if not url or not isinstance(url, str):
        return False
    
    try:
        parsed = urlparse(url)
        hostname = parsed.netloc.lower()
        
        # Check for Firebase Storage URLs
        if 'firebasestorage.googleapis.com' in hostname:
            return True
        
        # Add other problematic URL patterns here if needed
        # For example:
        # - Private storage services that require authentication
        # - URLs with access tokens that expire quickly
        # - Internal/private network URLs
        
        return False
    except Exception as e:
        logger.warning(f"[Image Utils] Error parsing URL for problematic check: {e}")
        return False


def download_image_and_convert_to_data_url(
    url: str,
    timeout: int = 30,
    job_id: Optional[str] = None,
    tenant_id: Optional[str] = None
) -> Optional[str]:
    """
    Download an image from a URL and convert it to a base64 data URL.
    
    This function is used for URLs that OpenAI API cannot access directly
    (e.g., Firebase Storage URLs with authentication tokens).
    
    Args:
        url: URL of the image to download
        timeout: Request timeout in seconds (default: 30)
        job_id: Optional job ID for logging
        tenant_id: Optional tenant ID for logging
        
    Returns:
        Base64 data URL string (format: data:image/...;base64,...) or None if download fails
        
    Example:
        >>> data_url = download_image_and_convert_to_data_url("https://example.com/image.png")
        >>> # Returns: "data:image/png;base64,iVBORw0KGgoAAAANS..."
    """
    if not url or not isinstance(url, str):
        logger.error("[Image Utils] Invalid URL provided for download", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'url': str(url)
        })
        return None
    
    # Validate URL scheme
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            logger.error("[Image Utils] URL must use HTTP or HTTPS scheme", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'url_preview': url[:100] + '...' if len(url) > 100 else url,
                'scheme': parsed.scheme
            })
            return None
    except Exception as e:
        logger.error("[Image Utils] Error parsing URL", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'url_preview': url[:100] + '...' if len(url) > 100 else url,
            'error': str(e)
        })
        return None
    
    logger.info("[Image Utils] Downloading image from URL for base64 conversion", extra={
        'job_id': job_id,
        'tenant_id': tenant_id,
        'url_preview': url[:100] + '...' if len(url) > 100 else url,
        'timeout': timeout
    })
    
    try:
        # Download image
        response = requests.get(url, timeout=timeout, stream=True)
        response.raise_for_status()
        
        # Read the content
        image_bytes = response.content
        image_size = len(image_bytes)
        
        if image_size == 0:
            logger.error("[Image Utils] Downloaded image is empty", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'url_preview': url[:100] + '...' if len(url) > 100 else url
            })
            return None
        
        # Detect MIME type from Content-Type header or file extension
        mime_type = response.headers.get('Content-Type', '').split(';')[0].strip()
        
        # If Content-Type is not available or not an image type, try to detect from URL
        if not mime_type or not mime_type.startswith('image/'):
            # Try to detect from file extension
            url_lower = url.lower()
            if url_lower.endswith('.png') or '.png?' in url_lower:
                mime_type = 'image/png'
            elif url_lower.endswith('.jpg') or '.jpg?' in url_lower or url_lower.endswith('.jpeg') or '.jpeg?' in url_lower:
                mime_type = 'image/jpeg'
            elif url_lower.endswith('.gif') or '.gif?' in url_lower:
                mime_type = 'image/gif'
            elif url_lower.endswith('.webp') or '.webp?' in url_lower:
                mime_type = 'image/webp'
            else:
                # Default to PNG if we can't determine
                mime_type = 'image/png'
                logger.warning("[Image Utils] Could not determine MIME type, defaulting to image/png", extra={
                    'job_id': job_id,
                    'tenant_id': tenant_id,
                    'url_preview': url[:100] + '...' if len(url) > 100 else url,
                    'content_type_header': response.headers.get('Content-Type')
                })
        
        # Encode to base64
        b64_string = base64.b64encode(image_bytes).decode("utf-8")
        
        # Create data URL
        data_url = f"data:{mime_type};base64,{b64_string}"
        
        logger.info("[Image Utils] Successfully downloaded and converted image to data URL", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'url_preview': url[:100] + '...' if len(url) > 100 else url,
            'image_size_bytes': image_size,
            'mime_type': mime_type,
            'data_url_length': len(data_url)
        })
        
        return data_url
        
    except requests.Timeout:
        logger.error("[Image Utils] Timeout downloading image from URL", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'url_preview': url[:100] + '...' if len(url) > 100 else url,
            'timeout': timeout
        })
        return None
    except requests.HTTPError as e:
        logger.error("[Image Utils] HTTP error downloading image from URL", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'url_preview': url[:100] + '...' if len(url) > 100 else url,
            'status_code': e.response.status_code if e.response else None,
            'error': str(e)
        })
        return None
    except requests.RequestException as e:
        logger.error("[Image Utils] Request error downloading image from URL", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'url_preview': url[:100] + '...' if len(url) > 100 else url,
            'error': str(e)
        })
        return None
    except Exception as e:
        logger.error("[Image Utils] Unexpected error downloading/converting image", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'url_preview': url[:100] + '...' if len(url) > 100 else url,
            'error': str(e)
        }, exc_info=True)
        return None

