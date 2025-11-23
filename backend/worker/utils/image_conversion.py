"""
Image conversion utilities

This module provides functions for downloading images and converting
them between different formats (e.g., URL to base64 data URL).
"""

import base64
import logging
import requests
from typing import Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

from .image_validation import validate_image_bytes


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
        logger.error("[Image Conversion] Invalid URL provided for download", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'url': str(url)
        })
        return None
    
    # Validate URL scheme
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            logger.error("[Image Conversion] URL must use HTTP or HTTPS scheme", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'url_preview': url[:100] + '...' if len(url) > 100 else url,
                'scheme': parsed.scheme
            })
            return None
    except Exception as e:
        logger.error("[Image Conversion] Error parsing URL", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'url_preview': url[:100] + '...' if len(url) > 100 else url,
            'error': str(e)
        })
        return None
    
    logger.info("[Image Conversion] Downloading image from URL for base64 conversion", extra={
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
            logger.error("[Image Conversion] Downloaded image is empty", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'url_preview': url[:100] + '...' if len(url) > 100 else url
            })
            return None
        
        # Validate that the downloaded bytes are actually a valid image
        is_valid, mime_type, error_message = validate_image_bytes(
            image_bytes=image_bytes,
            job_id=job_id,
            tenant_id=tenant_id
        )
        
        if not is_valid:
            logger.error("[Image Conversion] Downloaded content is not a valid image", extra={
                'job_id': job_id,
                'tenant_id': tenant_id,
                'url_preview': url[:100] + '...' if len(url) > 100 else url,
                'image_size_bytes': image_size,
                'error_message': error_message,
                'content_type_header': response.headers.get('Content-Type')
            })
            return None
        
        # Encode to base64
        b64_string = base64.b64encode(image_bytes).decode("utf-8")
        
        # Create data URL using validated MIME type
        data_url = f"data:{mime_type};base64,{b64_string}"
        
        logger.info("[Image Conversion] Successfully downloaded and converted image to data URL", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'url_preview': url[:100] + '...' if len(url) > 100 else url,
            'image_size_bytes': image_size,
            'mime_type': mime_type,
            'data_url_length': len(data_url)
        })
        
        return data_url
        
    except requests.Timeout:
        logger.error("[Image Conversion] Timeout downloading image from URL", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'url_preview': url[:100] + '...' if len(url) > 100 else url,
            'timeout': timeout
        })
        return None
    except requests.HTTPError as e:
        logger.error("[Image Conversion] HTTP error downloading image from URL", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'url_preview': url[:100] + '...' if len(url) > 100 else url,
            'status_code': e.response.status_code if e.response else None,
            'error': str(e)
        })
        return None
    except requests.RequestException as e:
        logger.error("[Image Conversion] Request error downloading image from URL", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'url_preview': url[:100] + '...' if len(url) > 100 else url,
            'error': str(e)
        })
        return None
    except Exception as e:
        logger.error("[Image Conversion] Unexpected error downloading/converting image", extra={
            'job_id': job_id,
            'tenant_id': tenant_id,
            'url_preview': url[:100] + '...' if len(url) > 100 else url,
            'error': str(e)
        }, exc_info=True)
        return None

