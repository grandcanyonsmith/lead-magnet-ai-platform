import logging
import requests
import time
from typing import List, Optional, Tuple
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import base64

from services.cache_service import CacheService
from .processing import validate_image_size, validate_image_format, optimize_image

logger = logging.getLogger(__name__)

# Constants
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB
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

import hashlib
def get_url_hash(url: str) -> str:
    """Generate a hash for a URL to use as cache key."""
    return hashlib.sha256(url.encode('utf-8')).hexdigest()

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
