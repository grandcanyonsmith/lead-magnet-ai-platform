"""
Image URL extraction utilities
"""

import re
import base64
import logging
import requests
import hashlib
import time
from typing import List, Any, Set, Optional, Tuple
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO

from services.cache_service import CacheService

logger = logging.getLogger(__name__)

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    logger.warning("[Image Utils] PIL/Pillow not available - image validation and optimization disabled")

# Constants
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB
MAX_IMAGE_WIDTH_PX = 2048  # Maximum width before resizing
IMAGE_CACHE_TTL_SECONDS = 3600  # 1 hour
MAX_CONCURRENT_DOWNLOADS = 5
DEFAULT_USER_AGENT = "LeadMagnetAI/1.0 (Image Downloader)"
MAX_DOWNLOAD_RETRIES = 3

# Global image cache instance
_image_cache: Optional[CacheService] = None


def get_image_cache() -> CacheService:
    """Get or create the global image cache instance."""
    global _image_cache
    if _image_cache is None:
        _image_cache = CacheService(max_size=256, ttl_seconds=IMAGE_CACHE_TTL_SECONDS)
    return _image_cache


def get_url_hash(url: str) -> str:
    """Generate a hash for a URL to use as cache key."""
    return hashlib.sha256(url.encode('utf-8')).hexdigest()


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


def validate_image_size(image_bytes: bytes, job_id: Optional[str] = None, tenant_id: Optional[str] = None) -> Tuple[bool, Optional[str]]:
    """
    Validate image size against maximum limit.
    
    Args:
        image_bytes: Image bytes to validate
        job_id: Optional job ID for logging
        tenant_id: Optional tenant ID for logging
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    image_size = len(image_bytes)
    
    if image_size > MAX_IMAGE_SIZE_BYTES:
        size_mb = image_size / (1024 * 1024)
        max_mb = MAX_IMAGE_SIZE_BYTES / (1024 * 1024)
        error_msg = f"Image size {size_mb:.2f}MB exceeds maximum {max_mb}MB"
        logger.warning(f"[Image Utils] {error_msg}", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'image_size_bytes': image_size,
            'max_size_bytes': MAX_IMAGE_SIZE_BYTES
        })
        return False, error_msg
    
    if image_size > MAX_IMAGE_SIZE_BYTES * 0.8:  # Warn if > 80% of max
        size_mb = image_size / (1024 * 1024)
        logger.warning("[Image Utils] Large image detected, may need optimization", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'image_size_bytes': image_size,
            'size_mb': size_mb
        })
    
    return True, None


def validate_image_format(image_bytes: bytes, job_id: Optional[str] = None, tenant_id: Optional[str] = None) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Validate that bytes are actually a valid image format.
    
    Args:
        image_bytes: Image bytes to validate
        job_id: Optional job ID for logging
        tenant_id: Optional tenant ID for logging
        
    Returns:
        Tuple of (is_valid, mime_type, error_message)
    """
    if not PIL_AVAILABLE:
        # Without PIL, we can't validate format - return True but unknown type
        return True, None, None
    
    if not image_bytes or len(image_bytes) == 0:
        return False, None, "Image bytes are empty"
    
    try:
        # Try to open image with PIL
        img = Image.open(BytesIO(image_bytes))
        img.verify()  # Verify it's a valid image
        
        # Get format
        img_format = img.format
        if img_format:
            mime_type = f"image/{img_format.lower()}"
        else:
            mime_type = None
        
        return True, mime_type, None
    except Exception as e:
        error_msg = f"Invalid image format: {str(e)}"
        logger.warning(f"[Image Utils] {error_msg}", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'error': str(e),
            'image_size_bytes': len(image_bytes)
        })
        return False, None, error_msg


def optimize_image(image_bytes: bytes, content_type: str, job_id: Optional[str] = None, tenant_id: Optional[str] = None) -> Tuple[bytes, str]:
    """
    Optimize image by resizing and compressing if needed.
    
    Args:
        image_bytes: Original image bytes
        content_type: MIME type of the image
        job_id: Optional job ID for logging
        tenant_id: Optional tenant ID for logging
        
    Returns:
        Tuple of (optimized_bytes, new_content_type)
    """
    if not PIL_AVAILABLE:
        return image_bytes, content_type
    
    try:
        img = Image.open(BytesIO(image_bytes))
        original_format = img.format
        original_size = len(image_bytes)
        original_width = img.width
        original_height = img.height
        
        # Resize if width exceeds maximum
        if img.width > MAX_IMAGE_WIDTH_PX:
            ratio = MAX_IMAGE_WIDTH_PX / img.width
            new_height = int(img.height * ratio)
            img = img.resize((MAX_IMAGE_WIDTH_PX, new_height), Image.Resampling.LANCZOS)
            logger.info("[Image Utils] Resized image", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'original_size': (original_width, original_height),
                'new_size': (MAX_IMAGE_WIDTH_PX, new_height)
            })
        
        # Optimize based on format
        output = BytesIO()
        
        if content_type in ('image/jpeg', 'image/jpg'):
            # Compress JPEG
            img.save(output, format='JPEG', quality=85, optimize=True)
            new_content_type = 'image/jpeg'
        elif content_type == 'image/webp':
            # Compress WebP
            img.save(output, format='WebP', quality=85, method=6)
            new_content_type = 'image/webp'
        elif content_type == 'image/png':
            # For large PNGs, consider converting to JPEG if appropriate
            if original_size > 2 * 1024 * 1024 and not img.mode in ('RGBA', 'LA', 'P'):
                # Convert large non-transparent PNGs to JPEG
                if img.mode == 'RGBA':
                    # Create white background
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[3] if img.mode == 'RGBA' else None)
                    img = background
                img.save(output, format='JPEG', quality=85, optimize=True)
                new_content_type = 'image/jpeg'
                logger.info("[Image Utils] Converted large PNG to JPEG", extra={
                    'job_id': job_id,
                    'tenant_id': tenant_id,
                    'original_size_bytes': original_size
                })
            else:
                # Optimize PNG
                img.save(output, format='PNG', optimize=True)
                new_content_type = 'image/png'
        else:
            # Keep original format
            img.save(output, format=original_format or 'PNG')
            new_content_type = content_type
        
        optimized_bytes = output.getvalue()
        optimized_size = len(optimized_bytes)
        
        if optimized_size < original_size:
            reduction_pct = (1 - optimized_size / original_size) * 100
            logger.info("[Image Utils] Image optimized", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'original_size_bytes': original_size,
                'optimized_size_bytes': optimized_size,
                'reduction_percent': reduction_pct
            })
        
        return optimized_bytes, new_content_type
    except Exception as e:
        logger.warning("[Image Utils] Failed to optimize image, using original", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'error': str(e)
        })
        return image_bytes, content_type


def retry_download_image(
    url: str,
    timeout: int = 30,
    max_retries: int = MAX_DOWNLOAD_RETRIES,
    job_id: Optional[str] = None,
    tenant_id: Optional[str] = None
) -> Optional[requests.Response]:
    """
    Download image with exponential backoff retry logic.
    
    Args:
        url: URL to download
        timeout: Request timeout in seconds
        max_retries: Maximum number of retry attempts
        job_id: Optional job ID for logging
        tenant_id: Optional tenant ID for logging
        
    Returns:
        Response object or None if all retries failed
    """
    headers = {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept': 'image/*'
    }
    
    # Add Referer header from source URL domain
    try:
        parsed = urlparse(url)
        if parsed.scheme and parsed.netloc:
            headers['Referer'] = f"{parsed.scheme}://{parsed.netloc}/"
    except Exception:
        pass
    
    last_error = None
    
    for attempt in range(max_retries):
        try:
            response = requests.get(url, timeout=timeout, stream=True, headers=headers)
            response.raise_for_status()
            return response
        except requests.Timeout as e:
            last_error = e
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s
                logger.warning("[Image Utils] Download timeout, retrying", extra={
                    'job_id': job_id,
                    'tenant_id': tenant_id,
                    'url_preview': url[:100] + '...' if len(url) > 100 else url,
                    'attempt': attempt + 1,
                    'max_retries': max_retries,
                    'wait_time': wait_time
                })
                time.sleep(wait_time)
            else:
                logger.error("[Image Utils] Download timeout after all retries", extra={
                    'job_id': job_id,
                    'tenant_id': tenant_id,
                    'url_preview': url[:100] + '...' if len(url) > 100 else url,
                    'attempts': max_retries
                })
        except requests.HTTPError as e:
            # Don't retry on 4xx errors (client errors)
            if e.response and 400 <= e.response.status_code < 500:
                logger.error("[Image Utils] Client error, not retrying", extra={
                    'job_id': job_id,
                    'tenant_id': tenant_id,
                    'url_preview': url[:100] + '...' if len(url) > 100 else url,
                    'status_code': e.response.status_code
                })
                raise
            # Retry on 5xx errors
            last_error = e
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt
                logger.warning("[Image Utils] Server error, retrying", extra={
                    'job_id': job_id,
                    'tenant_id': tenant_id,
                    'url_preview': url[:100] + '...' if len(url) > 100 else url,
                    'status_code': e.response.status_code if e.response else None,
                    'attempt': attempt + 1,
                    'wait_time': wait_time
                })
                time.sleep(wait_time)
            else:
                logger.error("[Image Utils] Server error after all retries", extra={
                    'job_id': job_id,
                    'tenant_id': tenant_id,
                    'url_preview': url[:100] + '...' if len(url) > 100 else url,
                    'status_code': e.response.status_code if e.response else None,
                    'attempts': max_retries
                })
        except requests.RequestException as e:
            last_error = e
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt
                logger.warning("[Image Utils] Request error, retrying", extra={
                    'job_id': job_id,
                    'tenant_id': tenant_id,
                    'url_preview': url[:100] + '...' if len(url) > 100 else url,
                    'error': str(e),
                    'attempt': attempt + 1,
                    'wait_time': wait_time
                })
                time.sleep(wait_time)
            else:
                logger.error("[Image Utils] Request error after all retries", extra={
                    'job_id': job_id,
                    'tenant_id': tenant_id,
                    'url_preview': url[:100] + '...' if len(url) > 100 else url,
                    'error': str(e),
                    'attempts': max_retries
                })
    
    return None


def download_images_concurrent(
    urls: List[str],
    timeout: int = 30,
    max_workers: int = MAX_CONCURRENT_DOWNLOADS,
    job_id: Optional[str] = None,
    tenant_id: Optional[str] = None
) -> List[Tuple[str, Optional[bytes], Optional[str]]]:
    """
    Download multiple images concurrently.
    
    Args:
        urls: List of image URLs to download
        timeout: Request timeout in seconds
        max_workers: Maximum number of concurrent downloads
        job_id: Optional job ID for logging
        tenant_id: Optional tenant ID for logging
        
    Returns:
        List of tuples (url, image_bytes, content_type) - image_bytes is None if download failed
    """
    results = {}
    
    def download_single(url: str) -> Tuple[str, Optional[bytes], Optional[str]]:
        try:
            response = retry_download_image(url, timeout=timeout, job_id=job_id, tenant_id=tenant_id)
            if response:
                image_bytes = response.content
                content_type = response.headers.get('Content-Type', '')
                if not content_type or not content_type.startswith('image/'):
                    # Try to determine from URL
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
                        content_type = 'image/png'
                return (url, image_bytes, content_type)
            return (url, None, None)
        except Exception as e:
            logger.error("[Image Utils] Error downloading image in concurrent batch", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'url_preview': url[:100] + '...' if len(url) > 100 else url,
                'error': str(e)
            })
            return (url, None, None)
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_url = {executor.submit(download_single, url): url for url in urls}
        
        for future in as_completed(future_to_url):
            url, image_bytes, content_type = future.result()
            results[url] = (image_bytes, content_type)
    
    # Return results in original URL order
    return [(url, results[url][0], results[url][1]) for url in urls]


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


def download_image_and_convert_to_data_url(
    url: str,
    timeout: int = 30,
    job_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    image_index: Optional[int] = None,
    total_images: Optional[int] = None
) -> Optional[str]:
    """
    Download an image from a URL and convert it to a base64 data URL.
    
    This function is used for URLs that OpenAI API cannot access directly
    (e.g., Firebase Storage URLs with authentication tokens, gencdn.ai URLs).
    Includes caching, size validation, format validation, and optimization.
    
    Args:
        url: URL of the image to download
        timeout: Request timeout in seconds (default: 30)
        job_id: Optional job ID for logging
        tenant_id: Optional tenant ID for logging
        image_index: Optional index of image in batch (for error messages)
        total_images: Optional total number of images in batch (for error messages)
        
    Returns:
        Base64 data URL string (format: data:image/...;base64,...) or None if download fails
        
    Example:
        >>> data_url = download_image_and_convert_to_data_url("https://example.com/image.png")
        >>> # Returns: "data:image/png;base64,iVBORw0KGgoAAAANS..."
    """
    if not url or not isinstance(url, str):
        error_msg = f"Invalid URL provided for download"
        if image_index is not None:
            error_msg += f" (image {image_index + 1}"
            if total_images is not None:
                error_msg += f" of {total_images}"
            error_msg += ")"
        logger.error(f"[Image Utils] {error_msg}", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'url': str(url),
            'image_index': image_index,
            'total_images': total_images
        })
        return None
    
    # Check cache first
    cache = get_image_cache()
    cache_key = f"image_data_url:{get_url_hash(url)}"
    cached_data_url = cache.get(cache_key)
    if cached_data_url:
        logger.info("[Image Utils] Using cached image data URL", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'url_preview': url[:100] + '...' if len(url) > 100 else url,
            'image_index': image_index,
            'total_images': total_images
        })
        return cached_data_url
    
    # Validate URL scheme
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            error_msg = f"URL must use HTTP or HTTPS scheme (got {parsed.scheme})"
            if image_index is not None:
                error_msg += f" - image {image_index + 1}"
                if total_images is not None:
                    error_msg += f" of {total_images}"
            logger.error(f"[Image Utils] {error_msg}", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'url_preview': url[:100] + '...' if len(url) > 100 else url,
                'scheme': parsed.scheme,
                'image_index': image_index,
                'total_images': total_images
            })
            return None
    except Exception as e:
        error_msg = f"Error parsing URL: {str(e)}"
        if image_index is not None:
            error_msg += f" - image {image_index + 1}"
            if total_images is not None:
                error_msg += f" of {total_images}"
        logger.error(f"[Image Utils] {error_msg}", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'url_preview': url[:100] + '...' if len(url) > 100 else url,
            'error': str(e),
            'image_index': image_index,
            'total_images': total_images
        })
        return None
    
    log_context = {
        'job_id': job_id,
        'tenant_id': tenant_id,
        'url_preview': url[:100] + '...' if len(url) > 100 else url,
        'timeout': timeout
    }
    if image_index is not None:
        log_context['image_index'] = image_index + 1
    if total_images is not None:
        log_context['total_images'] = total_images
    
    logger.info("[Image Utils] Downloading image from URL for base64 conversion", extra=log_context)
    
    try:
        # Download image with retry logic
        response = retry_download_image(url, timeout=timeout, job_id=job_id, tenant_id=tenant_id)
        if not response:
            error_msg = "Failed to download image after retries"
            if image_index is not None:
                error_msg += f" (image {image_index + 1}"
                if total_images is not None:
                    error_msg += f" of {total_images}"
                error_msg += ")"
            logger.error(f"[Image Utils] {error_msg}", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'url_preview': url[:100] + '...' if len(url) > 100 else url,
                'image_index': image_index,
                'total_images': total_images
            })
            return None
        
        # Read content in chunks for large images (memory management)
        image_bytes = b''
        chunk_size = 8192  # 8KB chunks
        
        for chunk in response.iter_content(chunk_size=chunk_size):
            if chunk:
                image_bytes += chunk
                # Check size during download to avoid memory issues
                if len(image_bytes) > MAX_IMAGE_SIZE_BYTES * 1.2:  # Allow 20% buffer
                    error_msg = f"Image exceeds maximum size during download"
                    if image_index is not None:
                        error_msg += f" (image {image_index + 1}"
                        if total_images is not None:
                            error_msg += f" of {total_images}"
                        error_msg += ")"
                    logger.error(f"[Image Utils] {error_msg}", extra={
                        'job_id': job_id,
                        'tenant_id': tenant_id,
                        'url_preview': url[:100] + '...' if len(url) > 100 else url,
                        'current_size_bytes': len(image_bytes),
                        'max_size_bytes': MAX_IMAGE_SIZE_BYTES,
                        'image_index': image_index,
                        'total_images': total_images
                    })
                    return None
        
        image_size = len(image_bytes)
        
        if image_size == 0:
            error_msg = "Downloaded image is empty"
            if image_index is not None:
                error_msg += f" (image {image_index + 1}"
                if total_images is not None:
                    error_msg += f" of {total_images}"
                error_msg += ")"
            logger.error(f"[Image Utils] {error_msg}", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'url_preview': url[:100] + '...' if len(url) > 100 else url,
                'image_index': image_index,
                'total_images': total_images
            })
            return None
        
        # Validate image size
        is_valid_size, size_error = validate_image_size(image_bytes, job_id=job_id, tenant_id=tenant_id)
        if not is_valid_size:
            # Try to optimize if too large
            if image_size > MAX_IMAGE_SIZE_BYTES:
                logger.info("[Image Utils] Attempting to optimize oversized image", extra={
                    'job_id': job_id,
                    'tenant_id': tenant_id,
                    'url_preview': url[:100] + '...' if len(url) > 100 else url,
                    'original_size_bytes': image_size,
                    'image_index': image_index,
                    'total_images': total_images
                })
                # Will optimize below
            else:
                error_msg = size_error or "Image size validation failed"
                if image_index is not None:
                    error_msg += f" (image {image_index + 1}"
                    if total_images is not None:
                        error_msg += f" of {total_images}"
                    error_msg += ")"
                logger.error(f"[Image Utils] {error_msg}", extra={
                    'job_id': job_id,
                    'tenant_id': tenant_id,
                    'url_preview': url[:100] + '...' if len(url) > 100 else url,
                    'image_size_bytes': image_size,
                    'image_index': image_index,
                    'total_images': total_images
                })
                return None
        
        # Validate image format
        is_valid_format, mime_type_from_validation, format_error = validate_image_format(image_bytes, job_id=job_id, tenant_id=tenant_id)
        if not is_valid_format:
            error_msg = format_error or "Invalid image format"
            if image_index is not None:
                error_msg += f" (image {image_index + 1}"
                if total_images is not None:
                    error_msg += f" of {total_images}"
                error_msg += ")"
            logger.error(f"[Image Utils] {error_msg}", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'url_preview': url[:100] + '...' if len(url) > 100 else url,
                'image_size_bytes': image_size,
                'image_index': image_index,
                'total_images': total_images
            })
            return None
        
        # Determine MIME type
        content_type = response.headers.get('Content-Type', '')
        if not content_type or not content_type.startswith('image/'):
            # Use validated mime type if available
            if mime_type_from_validation:
                content_type = mime_type_from_validation
            else:
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
                    content_type = 'image/png'
        
        # Optimize image if needed
        optimized_bytes, optimized_content_type = optimize_image(image_bytes, content_type, job_id=job_id, tenant_id=tenant_id)
        
        # Clear original bytes from memory
        del image_bytes
        
        # Encode to base64
        b64_string = base64.b64encode(optimized_bytes).decode("utf-8")
        
        # Clear optimized bytes from memory
        optimized_size = len(optimized_bytes)
        del optimized_bytes
        
        # Create data URL
        data_url = f"data:{optimized_content_type};base64,{b64_string}"
        
        # Cache the result
        cache.set(cache_key, data_url)
        
        log_info = {
            'job_id': job_id,
            'tenant_id': tenant_id,
            'url_preview': url[:100] + '...' if len(url) > 100 else url,
            'image_size_bytes': optimized_size,
            'mime_type': optimized_content_type,
            'data_url_length': len(data_url)
        }
        if image_index is not None:
            log_info['image_index'] = image_index + 1
        if total_images is not None:
            log_info['total_images'] = total_images
        
        logger.info("[Image Utils] Successfully downloaded and converted image to data URL", extra=log_info)
        
        return data_url
        
    except requests.Timeout:
        error_msg = f"Timeout downloading image from URL (timeout: {timeout}s)"
        if image_index is not None:
            error_msg += f" - image {image_index + 1}"
            if total_images is not None:
                error_msg += f" of {total_images}"
        logger.error(f"[Image Utils] {error_msg}", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'url_preview': url[:100] + '...' if len(url) > 100 else url,
            'timeout': timeout,
            'image_index': image_index,
            'total_images': total_images
        })
        return None
    except requests.HTTPError as e:
        error_msg = f"HTTP error downloading image"
        if image_index is not None:
            error_msg += f" (image {image_index + 1}"
            if total_images is not None:
                error_msg += f" of {total_images}"
            error_msg += ")"
        logger.error(f"[Image Utils] {error_msg}", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'url_preview': url[:100] + '...' if len(url) > 100 else url,
            'status_code': e.response.status_code if e.response else None,
            'error': str(e),
            'image_index': image_index,
            'total_images': total_images
        })
        return None
    except requests.RequestException as e:
        error_msg = f"Request error downloading image"
        if image_index is not None:
            error_msg += f" (image {image_index + 1}"
            if total_images is not None:
                error_msg += f" of {total_images}"
            error_msg += ")"
        logger.error(f"[Image Utils] {error_msg}", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'url_preview': url[:100] + '...' if len(url) > 100 else url,
            'error': str(e),
            'image_index': image_index,
            'total_images': total_images
        })
        return None
    except Exception as e:
        error_msg = f"Unexpected error downloading/converting image: {str(e)}"
        if image_index is not None:
            error_msg += f" (image {image_index + 1}"
            if total_images is not None:
                error_msg += f" of {total_images}"
            error_msg += ")"
        logger.error(f"[Image Utils] {error_msg}", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'url_preview': url[:100] + '...' if len(url) > 100 else url,
            'error': str(e),
            'image_index': image_index,
            'total_images': total_images
        }, exc_info=True)
        return None

