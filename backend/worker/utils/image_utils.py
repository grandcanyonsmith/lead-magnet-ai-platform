"""
Image URL extraction utilities

This module provides backward compatibility by re-exporting all functions
from the specialized image utility modules:
- image_extraction: URL extraction from text/objects
- image_validation: URL and image bytes validation
- image_conversion: Image download and format conversion

For new code, consider importing directly from the specialized modules.
"""

# Re-export extraction functions
from .image_extraction import (
    extract_image_urls,
    is_image_url,
    extract_image_urls_from_object,
)

# Re-export validation functions
from .image_validation import (
    is_base64_data_url,
    is_valid_http_url,
    is_problematic_url,
    validate_image_url_for_openai,
    validate_and_filter_image_urls,
    validate_image_bytes,
    validate_base64_data_url,
)

# Re-export conversion functions
from .image_conversion import (
    download_image_and_convert_to_data_url,
)

__all__ = [
    # Extraction
    'extract_image_urls',
    'is_image_url',
    'extract_image_urls_from_object',
    # Validation
    'is_base64_data_url',
    'is_valid_http_url',
    'is_problematic_url',
    'validate_image_url_for_openai',
    'validate_and_filter_image_urls',
    'validate_image_bytes',
    'validate_base64_data_url',
    # Conversion
    'download_image_and_convert_to_data_url',
]
