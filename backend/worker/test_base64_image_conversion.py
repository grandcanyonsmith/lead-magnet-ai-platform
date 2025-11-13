#!/usr/bin/env python3
"""
Test for base64 image conversion in visual asset generation.
Tests that base64-encoded images in JSON responses are automatically converted to URLs.
"""

import sys
import os
import json
import base64
import logging
from pathlib import Path
from unittest.mock import Mock, MagicMock, patch

# Add the worker directory to Python path
worker_dir = Path(__file__).parent
sys.path.insert(0, str(worker_dir))

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def create_test_base64_image():
    """Create a small test PNG image in base64."""
    # Small 1x1 red PNG in base64
    return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


def create_test_json_with_base64_images():
    """Create a test JSON response with base64-encoded images."""
    base64_image = create_test_base64_image()
    
    return json.dumps({
        "assets": [
            {
                "id": "cov001",
                "name": "cover_market_research_icp_1920x1080.png",
                "width": 1920,
                "height": 1080,
                "background": "#F7F8FA",
                "style": "Abstract, insight-driven motif",
                "content_type": "image/png",
                "encoding": "base64",
                "data": base64_image
            },
            {
                "id": "div_aud",
                "name": "divider_audience_1600x400.png",
                "width": 1600,
                "height": 400,
                "content_type": "image/png",
                "encoding": "base64",
                "data": base64_image
            }
        ]
    })


def test_base64_image_detection():
    """Test that base64 images are detected in JSON responses."""
    logger.info("Testing base64 image detection...")
    
    try:
        from services.openai_client import OpenAIClient
        
        # Create mock image handler
        mock_image_handler = Mock()
        mock_image_handler.upload_base64_image_to_s3 = Mock(return_value="https://example.com/image1.png")
        
        client = OpenAIClient()
        
        # Create test JSON with base64 images
        test_json = create_test_json_with_base64_images()
        
        # Test the extraction method
        updated_content, image_urls = client._extract_and_convert_base64_images(
            content=test_json,
            image_handler=mock_image_handler,
            tenant_id="test_tenant",
            job_id="test_job"
        )
        
        # Verify images were detected and converted
        assert len(image_urls) == 2, f"Expected 2 image URLs, got {len(image_urls)}"
        assert mock_image_handler.upload_base64_image_to_s3.call_count == 2, "Expected 2 upload calls"
        
        # Verify JSON was updated
        updated_data = json.loads(updated_content)
        assert updated_data["assets"][0]["encoding"] == "url", "First asset encoding should be 'url'"
        assert updated_data["assets"][0]["data"].startswith("http"), "First asset data should be a URL"
        assert updated_data["assets"][1]["encoding"] == "url", "Second asset encoding should be 'url'"
        assert updated_data["assets"][1]["data"].startswith("http"), "Second asset data should be a URL"
        
        logger.info("✅ Base64 image detection test PASSED")
        return True
        
    except Exception as e:
        logger.error(f"❌ Base64 image detection test FAILED: {e}", exc_info=True)
        return False


def test_non_json_content():
    """Test that non-JSON content is handled gracefully."""
    logger.info("Testing non-JSON content handling...")
    
    try:
        from services.openai_client import OpenAIClient
        
        mock_image_handler = Mock()
        client = OpenAIClient()
        
        # Test with plain text
        plain_text = "This is not JSON"
        updated_content, image_urls = client._extract_and_convert_base64_images(
            content=plain_text,
            image_handler=mock_image_handler
        )
        
        assert updated_content == plain_text, "Non-JSON content should be returned unchanged"
        assert len(image_urls) == 0, "No images should be extracted from non-JSON"
        assert mock_image_handler.upload_base64_image_to_s3.call_count == 0, "No uploads should occur"
        
        logger.info("✅ Non-JSON content handling test PASSED")
        return True
        
    except Exception as e:
        logger.error(f"❌ Non-JSON content handling test FAILED: {e}", exc_info=True)
        return False


def test_json_without_assets():
    """Test JSON without assets array."""
    logger.info("Testing JSON without assets...")
    
    try:
        from services.openai_client import OpenAIClient
        
        mock_image_handler = Mock()
        client = OpenAIClient()
        
        # Test with JSON that doesn't have assets
        test_json = json.dumps({"other": "data"})
        updated_content, image_urls = client._extract_and_convert_base64_images(
            content=test_json,
            image_handler=mock_image_handler
        )
        
        assert len(image_urls) == 0, "No images should be extracted"
        assert mock_image_handler.upload_base64_image_to_s3.call_count == 0, "No uploads should occur"
        
        logger.info("✅ JSON without assets test PASSED")
        return True
        
    except Exception as e:
        logger.error(f"❌ JSON without assets test FAILED: {e}", exc_info=True)
        return False


def test_image_handler_upload_with_context():
    """Test that image handler uploads with tenant/job context."""
    logger.info("Testing image handler upload with context...")
    
    try:
        from services.image_handler import ImageHandler
        from s3_service import S3Service
        
        # Create mock S3 service
        mock_s3 = Mock(spec=S3Service)
        mock_s3.upload_image = Mock(return_value=("s3://bucket/key", "https://cloudfront.example.com/key"))
        mock_s3.cloudfront_domain = "cloudfront.example.com"
        mock_s3.bucket_name = "test-bucket"
        
        image_handler = ImageHandler(mock_s3)
        
        base64_image = create_test_base64_image()
        
        # Test upload with tenant/job context
        url = image_handler.upload_base64_image_to_s3(
            image_b64=base64_image,
            content_type="image/png",
            tenant_id="test_tenant",
            job_id="test_job",
            filename="test_image.png"
        )
        
        assert url is not None, "URL should be returned"
        assert mock_s3.upload_image.called, "S3 upload should be called"
        
        # Verify S3 key includes tenant/job path
        call_args = mock_s3.upload_image.call_args
        s3_key = call_args[1]["key"]
        assert "test_tenant" in s3_key, "S3 key should include tenant_id"
        assert "test_job" in s3_key, "S3 key should include job_id"
        assert s3_key == "test_tenant/jobs/test_job/test_image.png", f"Unexpected S3 key: {s3_key}"
        
        logger.info("✅ Image handler upload with context test PASSED")
        return True
        
    except Exception as e:
        logger.error(f"❌ Image handler upload with context test FAILED: {e}", exc_info=True)
        return False


def test_process_api_response_with_base64():
    """Test that process_api_response handles base64 images."""
    logger.info("Testing process_api_response with base64 images...")
    
    try:
        from services.openai_client import OpenAIClient
        
        # Create mock response
        mock_response = Mock()
        mock_response.output_text = create_test_json_with_base64_images()
        mock_response.output = []
        mock_response.tool_calls = []  # Empty list, not Mock
        mock_response.usage = Mock()
        mock_response.usage.input_tokens = 100
        mock_response.usage.output_tokens = 200
        mock_response.usage.total_tokens = 300
        
        # Create mock image handler
        mock_image_handler = Mock()
        mock_image_handler.upload_base64_image_to_s3 = Mock(return_value="https://example.com/image.png")
        
        client = OpenAIClient()
        
        # Process response
        content, usage_info, request_details, response_details = client.process_api_response(
            response=mock_response,
            model="gpt-5",
            instructions="Test",
            input_text="Test",
            previous_context="",
            context="Test",
            tools=[],
            tool_choice="auto",
            params={},
            image_handler=mock_image_handler,
            tenant_id="test_tenant",
            job_id="test_job"
        )
        
        # Verify base64 images were converted
        assert len(response_details["image_urls"]) == 2, "Should have 2 image URLs"
        assert mock_image_handler.upload_base64_image_to_s3.call_count == 2, "Should upload 2 images"
        
        # Verify content was updated
        updated_data = json.loads(content)
        assert updated_data["assets"][0]["encoding"] == "url", "Encoding should be updated to 'url'"
        
        logger.info("✅ process_api_response with base64 test PASSED")
        return True
        
    except Exception as e:
        logger.error(f"❌ process_api_response with base64 test FAILED: {e}", exc_info=True)
        return False


def main():
    """Run all tests."""
    logger.info("=" * 80)
    logger.info("Testing Base64 Image Conversion")
    logger.info("=" * 80)
    
    tests = [
        ("Base64 Image Detection", test_base64_image_detection),
        ("Non-JSON Content Handling", test_non_json_content),
        ("JSON Without Assets", test_json_without_assets),
        ("Image Handler Upload with Context", test_image_handler_upload_with_context),
        ("Process API Response with Base64", test_process_api_response_with_base64),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        logger.info(f"\n{'=' * 80}")
        logger.info(f"Running: {test_name}")
        logger.info(f"{'=' * 80}")
        
        try:
            if test_func():
                passed += 1
                logger.info(f"✅ {test_name} PASSED")
            else:
                failed += 1
                logger.error(f"❌ {test_name} FAILED")
        except Exception as e:
            failed += 1
            logger.error(f"❌ {test_name} FAILED with exception: {e}", exc_info=True)
    
    logger.info(f"\n{'=' * 80}")
    logger.info(f"Test Results: {passed} passed, {failed} failed")
    logger.info(f"{'=' * 80}")
    
    if failed == 0:
        logger.info("🎉 All tests PASSED!")
        return 0
    else:
        logger.error(f"❌ {failed} test(s) FAILED")
        return 1


if __name__ == "__main__":
    sys.exit(main())

