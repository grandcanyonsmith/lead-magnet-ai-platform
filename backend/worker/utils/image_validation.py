"""
Image validation utilities

This module provides functions for validating image URLs, image bytes,
and base64 data URLs.
"""

import base64
import logging
from typing import List, Tuple, Optional
from urllib.parse import urlparse
from io import BytesIO

logger = logging.getLogger(__name__)

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    logger.warning("[Image Validation] PIL/Pillow not available. Image validation will be limited.")

from .image_extraction import is_image_url


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
        logger.warning(f"[Image Validation] Error parsing URL for problematic check: {e}")
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
            logger.warning(f"[Image Validation] Filtered invalid image URL", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'url_preview': url[:100] + '...' if len(url) > 100 else url,
                'reason': reason
            })
    
    if filtered_urls:
        logger.info(f"[Image Validation] Filtered {len(filtered_urls)} invalid image URL(s), {len(valid_urls)} valid URL(s) remaining", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'total_urls': len(image_urls),
            'valid_urls_count': len(valid_urls),
            'filtered_urls_count': len(filtered_urls),
            'filtered_reasons': [reason for _, reason in filtered_urls]
        })
    
    return valid_urls, filtered_urls


def validate_image_bytes(
    image_bytes: bytes,
    max_size_mb: int = 20,
    job_id: Optional[str] = None,
    tenant_id: Optional[str] = None
) -> Tuple[bool, str, str]:
    """
    Validate that image bytes represent a valid image and detect the format.
    
    Uses PIL/Pillow to verify the image is valid and detect the actual format
    from the image data itself, not just headers or file extensions.
    
    Args:
        image_bytes: Raw image bytes to validate
        max_size_mb: Maximum image size in MB (default: 20MB)
        job_id: Optional job ID for logging
        tenant_id: Optional tenant ID for logging
        
    Returns:
        Tuple of (is_valid, mime_type, error_message)
        - is_valid: True if bytes represent a valid image
        - mime_type: Detected MIME type (e.g., 'image/png') or empty string if invalid
        - error_message: Error description if invalid, empty string if valid
        
    Example:
        >>> bytes_data = b'...'
        >>> is_valid, mime_type, error = validate_image_bytes(bytes_data)
        >>> if is_valid:
        ...     print(f"Valid {mime_type} image")
    """
    if not image_bytes or len(image_bytes) == 0:
        return False, "", "Image bytes are empty"
    
    # Check size limit (convert MB to bytes)
    max_size_bytes = max_size_mb * 1024 * 1024
    if len(image_bytes) > max_size_bytes:
        return False, "", f"Image size ({len(image_bytes) / 1024 / 1024:.2f}MB) exceeds maximum ({max_size_mb}MB)"
    
    if not PIL_AVAILABLE:
        # Without PIL, we can't validate, so return a warning but allow it
        logger.warning("[Image Validation] PIL/Pillow not available, skipping image validation", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'image_size_bytes': len(image_bytes)
        })
        # Try to guess MIME type from magic bytes as fallback
        if image_bytes.startswith(b'\x89PNG\r\n\x1a\n'):
            return True, 'image/png', ""
        elif image_bytes.startswith(b'\xff\xd8\xff'):
            return True, 'image/jpeg', ""
        elif image_bytes.startswith(b'GIF87a') or image_bytes.startswith(b'GIF89a'):
            return True, 'image/gif', ""
        elif image_bytes.startswith(b'RIFF') and b'WEBP' in image_bytes[:12]:
            return True, 'image/webp', ""
        else:
            return False, "", "Could not determine image format (PIL not available)"
    
    try:
        # Open image with PIL to validate it's actually an image
        image = Image.open(BytesIO(image_bytes))
        
        # Verify the image can be loaded (this will raise an exception if invalid)
        image.verify()
        
        # Get the format from PIL
        image_format = image.format
        if not image_format:
            return False, "", "Could not determine image format"
        
        # Map PIL format to MIME type
        format_to_mime = {
            'PNG': 'image/png',
            'JPEG': 'image/jpeg',
            'JPG': 'image/jpeg',
            'GIF': 'image/gif',
            'WEBP': 'image/webp',
        }
        
        mime_type = format_to_mime.get(image_format.upper())
        if not mime_type:
            return False, "", f"Unsupported image format: {image_format}. Supported: PNG, JPEG, GIF, WebP"
        
        logger.debug("[Image Validation] Image validation successful", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'image_size_bytes': len(image_bytes),
            'format': image_format,
            'mime_type': mime_type
        })
        
        return True, mime_type, ""
        
    except Image.UnidentifiedImageError:
        return False, "", "Image bytes do not represent a valid image format"
    except Exception as e:
        logger.error("[Image Validation] Error validating image bytes", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'image_size_bytes': len(image_bytes),
            'error': str(e)
        }, exc_info=True)
        return False, "", f"Error validating image: {str(e)}"


def validate_base64_data_url(
    data_url: str,
    max_size_mb: int = 20,
    job_id: Optional[str] = None,
    tenant_id: Optional[str] = None
) -> Tuple[bool, Optional[bytes], str]:
    """
    Validate a base64 data URL and extract the image bytes.
    
    Args:
        data_url: Base64 data URL to validate (format: data:image/...;base64,...)
        max_size_mb: Maximum image size in MB (default: 20MB)
        job_id: Optional job ID for logging
        tenant_id: Optional tenant ID for logging
        
    Returns:
        Tuple of (is_valid, image_bytes, error_message)
        - is_valid: True if data URL is valid
        - image_bytes: Decoded image bytes if valid, None otherwise
        - error_message: Error description if invalid, empty string if valid
    """
    if not data_url or not isinstance(data_url, str):
        return False, None, "Data URL is empty or not a string"
    
    if not is_base64_data_url(data_url):
        return False, None, "Not a valid base64 data URL format"
    
    try:
        # Parse data URL: data:image/png;base64,<base64_data>
        parts = data_url.split(';base64,', 1)
        if len(parts) != 2:
            return False, None, "Invalid data URL format: missing base64 data"
        
        mime_part = parts[0]
        base64_data = parts[1]
        
        # Extract MIME type
        if not mime_part.startswith('data:image/'):
            return False, None, f"Invalid MIME type in data URL: {mime_part}"
        
        # Check size before decoding (base64 is ~33% larger than binary)
        estimated_binary_size = len(base64_data) * 3 / 4
        max_size_bytes = max_size_mb * 1024 * 1024
        if estimated_binary_size > max_size_bytes:
            return False, None, f"Data URL too large (estimated {estimated_binary_size / 1024 / 1024:.2f}MB, max {max_size_mb}MB)"
        
        # Decode base64
        try:
            image_bytes = base64.b64decode(base64_data, validate=True)
        except Exception as e:
            return False, None, f"Invalid base64 encoding: {str(e)}"
        
        if len(image_bytes) == 0:
            return False, None, "Decoded image bytes are empty"
        
        # Validate the decoded bytes are actually a valid image
        is_valid, detected_mime_type, error_message = validate_image_bytes(
            image_bytes=image_bytes,
            max_size_mb=max_size_mb,
            job_id=job_id,
            tenant_id=tenant_id
        )
        
        if not is_valid:
            return False, None, f"Invalid image data: {error_message}"
        
        # Verify MIME type matches detected type
        expected_mime = mime_part.replace('data:', '')
        if detected_mime_type != expected_mime:
            logger.warning("[Image Validation] MIME type mismatch in data URL", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'declared_mime_type': expected_mime,
                'detected_mime_type': detected_mime_type
            })
            # Still return valid, but with detected MIME type
        
        return True, image_bytes, ""
        
    except Exception as e:
        logger.error("[Image Validation] Error validating base64 data URL", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'error': str(e)
        }, exc_info=True)
        return False, None, f"Error validating data URL: {str(e)}"

