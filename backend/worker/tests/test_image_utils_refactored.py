#!/usr/bin/env python3
"""
Unit tests for refactored image utility modules.

Tests the modular structure:
- image_extraction.py
- image_validation.py
- image_conversion.py
- image_utils.py (re-export module for backward compatibility)
"""

import sys
import os
import logging
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import pytest
import requests

# Add the worker directory to Python path
worker_dir = Path(__file__).parent.parent
sys.path.insert(0, str(worker_dir))

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============================================================================
# Image Extraction Tests
# ============================================================================

def test_extract_image_urls():
    """Test extract_image_urls function."""
    from utils.image_extraction import extract_image_urls
    
    # Test with valid image URLs
    text = "Check out https://example.com/image.jpg and https://example.com/photo.png"
    urls = extract_image_urls(text)
    assert "https://example.com/image.jpg" in urls
    assert "https://example.com/photo.png" in urls
    
    # Test with URLs with query parameters
    text = "Image: https://example.com/image.jpg?size=large&format=png"
    urls = extract_image_urls(text)
    assert len(urls) == 1
    assert "https://example.com/image.jpg" in urls[0]
    
    # Test with no image URLs
    text = "This is just regular text"
    urls = extract_image_urls(text)
    assert urls == []
    
    # Test with empty string
    urls = extract_image_urls("")
    assert urls == []
    
    # Test with None
    urls = extract_image_urls(None)
    assert urls == []


def test_is_image_url():
    """Test is_image_url function."""
    from utils.image_extraction import is_image_url
    
    assert is_image_url("https://example.com/image.jpg") is True
    assert is_image_url("https://example.com/image.png") is True
    assert is_image_url("https://example.com/image.jpeg") is True
    assert is_image_url("https://example.com/image.gif") is True
    assert is_image_url("https://example.com/image.webp") is True
    assert is_image_url("https://example.com/image.svg") is True
    assert is_image_url("https://example.com/image.bmp") is True
    assert is_image_url("https://example.com/image.ico") is True
    
    assert is_image_url("https://example.com/file.pdf") is False
    assert is_image_url("https://example.com/file.txt") is False
    assert is_image_url("not a url") is False


def test_extract_image_urls_from_object():
    """Test extract_image_urls_from_object function."""
    from utils.image_extraction import extract_image_urls_from_object
    
    # Test with dict containing image URLs
    obj = {
        "text": "Check https://example.com/image.jpg",
        "image": "https://example.com/photo.png",
        "nested": {
            "url": "https://example.com/nested.jpg"
        }
    }
    urls = extract_image_urls_from_object(obj)
    assert len(urls) >= 3
    
    # Test with list
    obj = [
        "https://example.com/image1.jpg",
        "https://example.com/image2.png"
    ]
    urls = extract_image_urls_from_object(obj)
    assert len(urls) == 2
    
    # Test with string
    obj = "Check https://example.com/image.jpg"
    urls = extract_image_urls_from_object(obj)
    assert len(urls) == 1


# ============================================================================
# Image Validation Tests
# ============================================================================

def test_is_base64_data_url():
    """Test is_base64_data_url function."""
    from utils.image_validation import is_base64_data_url
    
    # Valid base64 data URL
    assert is_base64_data_url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==") is True
    
    # Invalid - not base64
    assert is_base64_data_url("data:image/png;base64,invalid") is False
    
    # Invalid - not a data URL
    assert is_base64_data_url("https://example.com/image.jpg") is False
    
    # Invalid - empty
    assert is_base64_data_url("") is False


def test_is_valid_http_url():
    """Test is_valid_http_url function."""
    from utils.image_validation import is_valid_http_url
    
    assert is_valid_http_url("https://example.com/image.jpg") is True
    assert is_valid_http_url("http://example.com/image.jpg") is True
    assert is_valid_http_url("https://example.com/image.jpg?size=large") is True
    
    assert is_valid_http_url("ftp://example.com/image.jpg") is False
    assert is_valid_http_url("not a url") is False
    assert is_valid_http_url("") is False


def test_is_problematic_url():
    """Test is_problematic_url function."""
    from utils.image_validation import is_problematic_url
    
    # Firebase Storage URL (problematic)
    assert is_problematic_url("https://firebasestorage.googleapis.com/v0/b/bucket/o/image.jpg") is True
    
    # Regular URL (not problematic)
    assert is_problematic_url("https://example.com/image.jpg") is False
    
    # Empty string
    assert is_problematic_url("") is False


def test_validate_image_url_for_openai():
    """Test validate_image_url_for_openai function."""
    from utils.image_validation import validate_image_url_for_openai
    
    # Valid HTTP URL
    is_valid, reason = validate_image_url_for_openai("https://example.com/image.jpg")
    assert is_valid is True
    assert reason is None
    
    # Base64 data URL
    data_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    is_valid, reason = validate_image_url_for_openai(data_url)
    assert is_valid is True
    
    # Invalid URL
    is_valid, reason = validate_image_url_for_openai("not a url")
    assert is_valid is False
    assert reason is not None


def test_validate_and_filter_image_urls():
    """Test validate_and_filter_image_urls function."""
    from utils.image_validation import validate_and_filter_image_urls
    
    urls = [
        "https://example.com/image1.jpg",
        "https://example.com/image2.png",
        "not a url",
        "https://example.com/image3.jpg"
    ]
    
    valid_urls, filtered = validate_and_filter_image_urls(urls)
    
    assert len(valid_urls) == 3
    assert len(filtered) == 1
    assert "not a url" not in valid_urls


def test_validate_image_bytes():
    """Test validate_image_bytes function."""
    from utils.image_validation import validate_image_bytes
    
    # Valid PNG bytes (minimal PNG header)
    png_bytes = b'\x89PNG\r\n\x1a\n'
    is_valid, format_type = validate_image_bytes(png_bytes)
    assert is_valid is True
    assert format_type == "png"
    
    # Invalid bytes
    invalid_bytes = b"not an image"
    is_valid, format_type = validate_image_bytes(invalid_bytes)
    assert is_valid is False


def test_validate_base64_data_url():
    """Test validate_base64_data_url function."""
    from utils.image_validation import validate_base64_data_url
    
    # Valid base64 data URL
    data_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    is_valid, format_type, image_bytes = validate_base64_data_url(data_url)
    assert is_valid is True
    assert format_type == "png"
    assert image_bytes is not None
    
    # Invalid base64
    invalid_data_url = "data:image/png;base64,invalid"
    is_valid, format_type, image_bytes = validate_base64_data_url(invalid_data_url)
    assert is_valid is False


# ============================================================================
# Image Conversion Tests
# ============================================================================

def test_download_image_and_convert_to_data_url():
    """Test download_image_and_convert_to_data_url function."""
    from utils.image_conversion import download_image_and_convert_to_data_url
    
    # Mock successful image download
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.content = b'\x89PNG\r\n\x1a\n'  # Minimal PNG
    mock_response.headers = {'Content-Type': 'image/png'}
    
    with patch('requests.get', return_value=mock_response), \
         patch('utils.image_validation.validate_image_bytes', return_value=(True, "png")):
        
        data_url = download_image_and_convert_to_data_url("https://example.com/image.jpg")
        assert data_url is not None
        assert data_url.startswith("data:image/png;base64,")
    
    # Test with failed download
    with patch('requests.get', side_effect=requests.RequestException("Connection error")):
        data_url = download_image_and_convert_to_data_url("https://example.com/image.jpg")
        assert data_url is None
    
    # Test with timeout
    with patch('requests.get', side_effect=requests.Timeout("Request timeout")):
        data_url = download_image_and_convert_to_data_url("https://example.com/image.jpg")
        assert data_url is None


# ============================================================================
# Backward Compatibility Tests (image_utils.py re-exports)
# ============================================================================

def test_image_utils_backward_compatibility():
    """Test that image_utils.py re-exports all functions for backward compatibility."""
    from utils import image_utils
    
    # Test extraction functions
    assert hasattr(image_utils, 'extract_image_urls')
    assert hasattr(image_utils, 'is_image_url')
    assert hasattr(image_utils, 'extract_image_urls_from_object')
    
    # Test validation functions
    assert hasattr(image_utils, 'is_base64_data_url')
    assert hasattr(image_utils, 'is_valid_http_url')
    assert hasattr(image_utils, 'is_problematic_url')
    assert hasattr(image_utils, 'validate_image_url_for_openai')
    assert hasattr(image_utils, 'validate_and_filter_image_urls')
    assert hasattr(image_utils, 'validate_image_bytes')
    assert hasattr(image_utils, 'validate_base64_data_url')
    
    # Test conversion functions
    assert hasattr(image_utils, 'download_image_and_convert_to_data_url')
    
    # Test that functions are callable
    assert callable(image_utils.extract_image_urls)
    assert callable(image_utils.is_image_url)
    assert callable(image_utils.validate_image_url_for_openai)


def test_image_utils_functions_work():
    """Test that re-exported functions actually work."""
    from utils import image_utils
    
    # Test extraction
    text = "Check https://example.com/image.jpg"
    urls = image_utils.extract_image_urls(text)
    assert len(urls) == 1
    
    # Test validation
    is_valid = image_utils.is_image_url("https://example.com/image.jpg")
    assert is_valid is True
    
    # Test conversion (mocked)
    with patch('utils.image_conversion.download_image_and_convert_to_data_url', return_value="data:image/png;base64,test"):
        result = image_utils.download_image_and_convert_to_data_url("https://example.com/image.jpg")
        assert result == "data:image/png;base64,test"


def test_image_utils_all_exports():
    """Test that __all__ contains all expected exports."""
    from utils import image_utils
    
    expected_exports = [
        'extract_image_urls',
        'is_image_url',
        'extract_image_urls_from_object',
        'is_base64_data_url',
        'is_valid_http_url',
        'is_problematic_url',
        'validate_image_url_for_openai',
        'validate_and_filter_image_urls',
        'validate_image_bytes',
        'validate_base64_data_url',
        'download_image_and_convert_to_data_url',
    ]
    
    for export_name in expected_exports:
        assert hasattr(image_utils, export_name), f"{export_name} not found in image_utils"


# ============================================================================
# Integration Tests
# ============================================================================

def test_image_processing_pipeline():
    """Test full image processing pipeline from extraction to validation."""
    from utils.image_extraction import extract_image_urls
    from utils.image_validation import validate_and_filter_image_urls
    from utils.image_conversion import download_image_and_convert_to_data_url
    
    # Extract URLs from text
    text = "Check these images: https://example.com/image1.jpg and https://example.com/image2.png"
    urls = extract_image_urls(text)
    assert len(urls) == 2
    
    # Validate URLs
    valid_urls, filtered = validate_and_filter_image_urls(urls)
    assert len(valid_urls) == 2
    
    # Convert to data URLs (mocked)
    with patch('requests.get') as mock_get:
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.content = b'\x89PNG\r\n\x1a\n'
        mock_response.headers = {'Content-Type': 'image/png'}
        mock_get.return_value = mock_response
        
        with patch('utils.image_validation.validate_image_bytes', return_value=(True, "png")):
            data_url = download_image_and_convert_to_data_url(valid_urls[0])
            assert data_url is not None
            assert data_url.startswith("data:image/png;base64,")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

