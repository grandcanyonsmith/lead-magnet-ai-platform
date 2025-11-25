"""
Image URL extraction utilities
"""

import re
import base64
import logging
import requests
from typing import List, Any, Set, Optional
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


def is_problematic_url(url: str) -> bool:
    """
    Check if a URL is problematic for OpenAI API to access directly.
    
    Some URLs (like Firebase Storage URLs or gencdn.ai URLs) may require 
    authentication or have access restrictions that prevent OpenAI's servers 
    from downloading them. These URLs should be downloaded locally and 
    converted to base64 data URLs.
    
    Args:
        url: URL to check
        
    Returns:
        True if URL is problematic and should be downloaded locally
    """
    if not url or not isinstance(url, str):
        return False
    
    # Skip data URLs (already base64 encoded)
    if url.startswith('data:'):
        return False
    
    try:
        parsed = urlparse(url)
        hostname = parsed.netloc.lower()
        
        # Check for Firebase Storage URLs
        if 'firebasestorage.googleapis.com' in hostname:
            return True
        
        # Check for gencdn.ai URLs (OpenAI cannot download from these)
        if 'gencdn.ai' in hostname:
            return True
        
        # Check for rendergfx.ai URLs (OpenAI cannot download from these)
        if 'rendergfx.ai' in hostname:
            return True
        
        # Check for cdn.openai.com URLs (OpenAI cannot download from these)
        if 'cdn.openai.com' in hostname:
            return True
        
        # Check for WordPress sites that might block OpenAI's user agent
        # Some WordPress sites block requests without proper user agents
        if 'wp-content' in url.lower() or 'wordpress' in hostname:
            # Be conservative - convert WordPress URLs to base64 to avoid download failures
            return True
        
        # Add other problematic URL patterns here if needed
        # For example:
        # - Private storage services that require authentication
        # - URLs with access tokens that expire quickly
        # - Internal/private network URLs
        
        return False
    except Exception as e:
        logger.warning(f"[Image Utils] Error parsing URL for problematic check: {e}")
        # If we can't parse the URL, be conservative and treat it as problematic
        return True


def download_image_and_convert_to_data_url(
    url: str,
    timeout: int = 30,
    job_id: Optional[str] = None,
    tenant_id: Optional[str] = None
) -> Optional[str]:
    """
    Download an image from a URL and convert it to a base64 data URL.
    
    This function is used for URLs that OpenAI API cannot access directly
    (e.g., Firebase Storage URLs with authentication tokens, gencdn.ai URLs).
    
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
        
        # Determine MIME type from Content-Type header or URL extension
        content_type = response.headers.get('Content-Type', '')
        if not content_type or not content_type.startswith('image/'):
            # Try to determine from URL extension
            url_lower = url.lower()
            if url_lower.endswith('.png'):
                content_type = 'image/png'
            elif url_lower.endswith(('.jpg', '.jpeg')):
                content_type = 'image/jpeg'
            elif url_lower.endswith('.gif'):
                content_type = 'image/gif'
            elif url_lower.endswith('.webp'):
                content_type = 'image/webp'
            else:
                # Default to PNG
                content_type = 'image/png'
        
        # Encode to base64
        b64_string = base64.b64encode(image_bytes).decode("utf-8")
        
        # Create data URL
        data_url = f"data:{content_type};base64,{b64_string}"
        
        logger.info("[Image Utils] Successfully downloaded and converted image to data URL", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'url_preview': url[:100] + '...' if len(url) > 100 else url,
            'image_size_bytes': image_size,
            'mime_type': content_type,
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

