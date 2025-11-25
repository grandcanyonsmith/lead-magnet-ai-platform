#!/usr/bin/env python3
"""
Test image download error handling and retry logic.
"""

import sys
import os
from pathlib import Path
from unittest.mock import Mock, MagicMock, patch

# Add the worker directory to Python path
worker_dir = Path(__file__).parent
sys.path.insert(0, str(worker_dir))

import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_problematic_url_detection():
    """Test that problematic URLs are correctly identified."""
    logger.info("Testing problematic URL detection...")
    
    from utils.image_utils import is_problematic_url
    
    test_cases = [
        # WordPress URLs should be problematic
        ("https://tranceformativechange.com/wp-content/uploads/2019/07/BobbyBeachPubPic.png", True),
        ("https://example.com/wp-content/image.png", True),
        # Firebase URLs should be problematic
        ("https://firebasestorage.googleapis.com/image.png", True),
        # cdn.openai.com URLs should be problematic
        ("https://cdn.openai.com/image.png", True),
        # Data URLs should NOT be problematic
        ("data:image/png;base64,iVBORw0KGgo=", False),
        # Regular URLs should NOT be problematic
        ("https://example.com/image.png", False),
        ("https://cdn.example.com/image.jpg", False),
    ]
    
    for url, expected in test_cases:
        result = is_problematic_url(url)
        assert result == expected, f"URL {url} expected {expected} but got {result}"
        logger.info(f"  ✓ {url[:60]}... -> {result}")
    
    logger.info("✅ Problematic URL detection works correctly")
    return True


def test_url_extraction_from_error():
    """Test URL extraction from OpenAI error messages."""
    logger.info("Testing URL extraction from error messages...")
    
    import re
    
    error_messages = [
        ("Error while downloading https://tranceformativechange.com/wp-content/uploads/2019/07/BobbyBeachPubPic.png.", 
         "https://tranceformativechange.com/wp-content/uploads/2019/07/BobbyBeachPubPic.png"),
        ("Error while downloading https://example.com/image.png", 
         "https://example.com/image.png"),
        ("Error while downloading https://test.com/img.jpg, failed", 
         "https://test.com/img.jpg"),
    ]
    
    for error_msg, expected_url in error_messages:
        failed_image_url = None
        if 'Error while downloading' in error_msg:
            # Try to extract URL from error message using regex
            url_match = re.search(r'https?://[^\s<>"{}|\\^`\[\]]+[^\s<>"{}|\\^`\[\].,!?;:]', error_msg)
            if url_match:
                failed_image_url = url_match.group(0).rstrip('.,!?;:')
            # Also try matching with trailing punctuation removed
            if not failed_image_url:
                url_match = re.search(r'https?://[^\s<>"{}|\\^`\[\]]+', error_msg)
                if url_match:
                    failed_image_url = url_match.group(0).rstrip('.,!?;:')
            # Try extracting from error message more carefully
            if not failed_image_url:
                # Look for URL pattern after "downloading "
                download_match = re.search(r'downloading\s+(https?://[^\s<>"{}|\\^`\[\]]+)', error_msg, re.IGNORECASE)
                if download_match:
                    failed_image_url = download_match.group(1).rstrip('.,!?;:')
        
        assert failed_image_url == expected_url, f"Expected {expected_url} but got {failed_image_url}"
        logger.info(f"  ✓ Extracted: {failed_image_url}")
    
    logger.info("✅ URL extraction from error messages works correctly")
    return True


def test_build_api_params_with_problematic_urls():
    """Test that build_api_params converts problematic URLs to base64."""
    logger.info("Testing build_api_params with problematic URLs...")
    
    from services.openai_client import OpenAIClient
    
    client = OpenAIClient()
    
    # Test with WordPress URL (should be converted to base64)
    previous_image_urls = [
        "https://tranceformativechange.com/wp-content/uploads/2019/07/BobbyBeachPubPic.png"
    ]
    
    # Mock the download function to return a test data URL
    with patch('utils.image_utils.download_image_and_convert_to_data_url') as mock_download:
        mock_download.return_value = "data:image/png;base64,iVBORw0KGgo="
        
        params = client.build_api_params(
            model="gpt-5",
            instructions="Test instructions",
            input_text="Test input",
            tools=[{"type": "image_generation"}],
            tool_choice="auto",
            has_computer_use=False,
            previous_image_urls=previous_image_urls,
            job_id="test_job",
            tenant_id="test_tenant"
        )
        
        # Check that download was called (indicating problematic URL was detected)
        assert mock_download.called, "download_image_and_convert_to_data_url should have been called"
        logger.info(f"  ✓ Problematic URL was detected and conversion attempted")
        
        # Check that input contains the data URL
        input_data = params.get('input')
        if isinstance(input_data, list) and len(input_data) > 0:
            content = input_data[0].get('content', [])
            if isinstance(content, list):
                image_items = [item for item in content if item.get('type') == 'input_image']
                if image_items:
                    image_url = image_items[0].get('image_url', '')
                    assert image_url.startswith('data:'), f"Expected data URL but got {image_url[:50]}..."
                    logger.info(f"  ✓ Image URL converted to data URL")
    
    logger.info("✅ build_api_params correctly handles problematic URLs")
    return True


if __name__ == "__main__":
    try:
        test_problematic_url_detection()
        test_url_extraction_from_error()
        test_build_api_params_with_problematic_urls()
        logger.info("\n✅ All tests passed!")
    except Exception as e:
        logger.error(f"\n❌ Test failed: {e}", exc_info=True)
        sys.exit(1)

