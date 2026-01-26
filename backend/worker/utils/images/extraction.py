import re
from typing import List, Any, Set
from urllib.parse import urlparse
import logging

logger = logging.getLogger(__name__)

def clean_image_url(url: str) -> str:
    """
    Clean an image URL by removing trailing punctuation that shouldn't be part of the URL.
    
    This handles cases where URLs are extracted from text that includes trailing punctuation
    like closing parentheses, periods, commas, etc.
    
    Args:
        url: Raw URL that may have trailing punctuation
        
    Returns:
        Cleaned URL with trailing punctuation removed
    """
    if not url or not isinstance(url, str):
        return url
    
    # Remove trailing punctuation that's commonly found after URLs in text
    # This includes: ), ), ), ., ,, ;, :, !, ?, etc.
    # But preserve query parameters and fragments
    cleaned = url.rstrip('.,!?;:')
    
    # Handle multiple closing parentheses (common in markdown or formatted text)
    # e.g., "https://example.com/image.jpg))" -> "https://example.com/image.jpg"
    while cleaned.endswith(')'):
        # Check if the parenthesis is part of a query parameter or fragment
        # If there's a '?' or '#' before the last '(', it might be part of the URL
        last_open = cleaned.rfind('(')
        last_qmark = cleaned.rfind('?')
        last_hash = cleaned.rfind('#')
        
        # If there's no matching '(' or if the '(' is before '?' or '#', remove trailing ')'
        if last_open == -1 or (last_qmark != -1 and last_open < last_qmark) or (last_hash != -1 and last_open < last_hash):
            cleaned = cleaned[:-1]
        else:
            break
    
    return cleaned


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


def extract_image_urls(text: str) -> List[str]:
    """
    Extract image URLs from text content.
    Supports: png, jpg, jpeg, gif, webp, svg, bmp, ico
    Handles URLs with query parameters and cleans trailing punctuation.
    
    Args:
        text: Text content to search for image URLs
        
    Returns:
        List of unique, cleaned image URLs found in the text
    """
    if not text or not isinstance(text, str):
        return []
    
    # Regex pattern to match image URLs
    # Matches URLs ending with image extensions, optionally followed by query parameters
    # Using non-capturing groups to get full URLs
    # Updated to be more permissive to catch URLs with trailing punctuation
    image_url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp|ico)(?:\?[^\s<>"{}|\\^`\[\]]*)?[^\s<>"{}|\\^`\[\]]*'
    
    matches = re.findall(image_url_pattern, text, re.IGNORECASE)
    if not matches:
        return []
    
    # Clean each URL to remove trailing punctuation
    cleaned_urls = []
    for url in matches:
        cleaned = clean_image_url(url)
        # Validate that the cleaned URL is still a valid image URL
        if cleaned and is_image_url(cleaned):
            cleaned_urls.append(cleaned)
    
    # Remove duplicates and return
    return list(set(cleaned_urls))


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


def deduplicate_image_urls(urls: List[str], job_id: Optional[str] = None, tenant_id: Optional[str] = None) -> List[str]:
    """
    Remove duplicate image URLs, normalizing by removing query parameters for comparison.
    
    Args:
        urls: List of image URLs
        job_id: Optional job ID for logging
        tenant_id: Optional tenant ID for logging
        
    Returns:
        Deduplicated list of URLs (preserving original URLs, not normalized ones)
    """
    if not urls:
        return []
    
    seen_normalized = {}
    deduplicated = []
    duplicates_count = 0
    
    for url in urls:
        if not url:
            continue
        
        # Normalize URL by removing query parameters for comparison
        try:
            parsed = urlparse(url)
            normalized = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        except Exception:
            normalized = url
        
        if normalized not in seen_normalized:
            seen_normalized[normalized] = url
            deduplicated.append(url)
        else:
            duplicates_count += 1
    
    if duplicates_count > 0:
        logger.info("[Image Utils] Deduplicated image URLs", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'original_count': len(urls),
            'deduplicated_count': len(deduplicated),
            'duplicates_removed': duplicates_count
        })
    
    return deduplicated
