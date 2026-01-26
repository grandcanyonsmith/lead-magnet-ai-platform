"""
Image URL extraction utilities
"""

import logging
from typing import List, Any, Optional, Tuple
import requests

# Import from new modules
from .images.extraction import (
    clean_image_url,
    is_image_url,
    extract_image_urls,
    extract_image_urls_from_object,
    is_problematic_url,
    deduplicate_image_urls
)
from .images.processing import (
    validate_image_size,
    validate_image_format,
    optimize_image,
    add_overlay_to_screenshot,
    MAX_IMAGE_SIZE_BYTES,
    MAX_IMAGE_WIDTH_PX,
    PIL_AVAILABLE
)
from .images.download import (
    get_image_cache,
    get_url_hash,
    retry_download_image,
    download_images_concurrent,
    download_image_and_convert_to_data_url,
    IMAGE_CACHE_TTL_SECONDS,
    MAX_CONCURRENT_DOWNLOADS,
    DEFAULT_USER_AGENT,
    MAX_DOWNLOAD_RETRIES
)

logger = logging.getLogger(__name__)

# Re-export everything for backward compatibility
__all__ = [
    'clean_image_url',
    'is_image_url',
    'extract_image_urls',
    'extract_image_urls_from_object',
    'is_problematic_url',
    'deduplicate_image_urls',
    'validate_image_size',
    'validate_image_format',
    'optimize_image',
    'add_overlay_to_screenshot',
    'get_image_cache',
    'get_url_hash',
    'retry_download_image',
    'download_images_concurrent',
    'download_image_and_convert_to_data_url',
    'MAX_IMAGE_SIZE_BYTES',
    'MAX_IMAGE_WIDTH_PX',
    'IMAGE_CACHE_TTL_SECONDS',
    'MAX_CONCURRENT_DOWNLOADS',
    'DEFAULT_USER_AGENT',
    'MAX_DOWNLOAD_RETRIES',
    'PIL_AVAILABLE'
]
