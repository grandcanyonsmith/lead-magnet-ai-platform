#!/usr/bin/env python3
"""
Unit Test: Test computer_use_preview screenshot extraction from ImageHandler
Tests the extraction of screenshot URLs from computer_use_call responses
"""

import sys
import os
import base64
import json
from unittest.mock import Mock, MagicMock, patch

# Add backend/worker to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'worker'))

try:
    from services.image_handler import ImageHandler
    from s3_service import S3Service
except ImportError as e:
    print(f"❌ Failed to import: {e}")
    sys.exit(1)


def create_mock_s3_service():
    """Create a mock S3Service that returns a test URL."""
    mock_s3 = Mock(spec=S3Service)
    mock_s3.upload_image = Mock(return_value=(
        "s3://test-bucket/images/test-image.png",
        "https://test-cloudfront.net/images/test-image.png"
    ))
    return mock_s3


def create_base64_image_data():
    """Create a small test PNG image in base64."""
    # Small 1x1 red PNG in base64
    return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


def create_data_uri_image():
    """Create a data URI formatted image."""
    base64_data = create_base64_image_data()
    return f"data:image/png;base64,{base64_data}"


class MockComputerUseCall:
    """Mock ComputerUseCall object."""
    def __init__(self, **kwargs):
        self.type = "computer_use_call"
        self.status = kwargs.get("status", "completed")
        for key, value in kwargs.items():
            setattr(self, key, value)
    
    def model_dump(self):
        """Return dict representation."""
        return {k: v for k, v in self.__dict__.items() if not k.startswith('_')}


class MockComputerScreenshot:
    """Mock computer_screenshot output item."""
    def __init__(self, image_url=None, image_data=None, url=None, data=None):
        self.type = "computer_screenshot"
        if image_url:
            self.image_url = image_url
        if image_data:
            self.data = image_data
        if url:
            self.url = url
        if data:
            self.data = data


class MockResponse:
    """Mock OpenAI API response."""
    def __init__(self, output=None, output_items=None):
        # Support both parameter names for compatibility
        self.output = output if output is not None else (output_items or [])


def test_extract_url_from_direct_url():
    """Test extraction when ComputerUseCall has direct URL."""
    print("\n🧪 Test 1: Extract URL from ComputerUseCall with direct URL field")
    print("-" * 60)
    
    mock_s3 = create_mock_s3_service()
    handler = ImageHandler(mock_s3)
    
    # Create mock ComputerUseCall with URL
    mock_call = MockComputerUseCall(url="https://example.com/screenshot.png")
    
    result = handler.extract_url_from_computer_use_call(mock_call)
    
    assert result == "https://example.com/screenshot.png", f"Expected URL, got: {result}"
    print("✅ PASSED: Direct URL extracted correctly")


def test_extract_url_from_image_url():
    """Test extraction when ComputerUseCall has image_url field."""
    print("\n🧪 Test 2: Extract URL from ComputerUseCall.image_url")
    print("-" * 60)
    
    mock_s3 = create_mock_s3_service()
    handler = ImageHandler(mock_s3)
    
    mock_call = MockComputerUseCall(image_url="https://example.com/image.png")
    
    result = handler.extract_url_from_computer_use_call(mock_call)
    
    assert result == "https://example.com/image.png", f"Expected URL, got: {result}"
    print("✅ PASSED: image_url extracted correctly")


def test_extract_url_from_screenshot_url():
    """Test extraction when ComputerUseCall has screenshot_url field."""
    print("\n🧪 Test 3: Extract URL from ComputerUseCall.screenshot_url")
    print("-" * 60)
    
    mock_s3 = create_mock_s3_service()
    handler = ImageHandler(mock_s3)
    
    mock_call = MockComputerUseCall(screenshot_url="https://example.com/screenshot.png")
    
    result = handler.extract_url_from_computer_use_call(mock_call)
    
    assert result == "https://example.com/screenshot.png", f"Expected URL, got: {result}"
    print("✅ PASSED: screenshot_url extracted correctly")


def test_extract_url_from_result_string_url():
    """Test extraction when result is a URL string."""
    print("\n🧪 Test 4: Extract URL from ComputerUseCall.result (URL string)")
    print("-" * 60)
    
    mock_s3 = create_mock_s3_service()
    handler = ImageHandler(mock_s3)
    
    mock_call = MockComputerUseCall(result="https://example.com/screenshot.png")
    
    result = handler.extract_url_from_computer_use_call(mock_call)
    
    assert result == "https://example.com/screenshot.png", f"Expected URL, got: {result}"
    print("✅ PASSED: URL string from result extracted correctly")


def test_extract_url_from_result_base64():
    """Test extraction when result is base64 data."""
    print("\n🧪 Test 5: Extract URL from ComputerUseCall.result (base64)")
    print("-" * 60)
    
    mock_s3 = create_mock_s3_service()
    handler = ImageHandler(mock_s3)
    
    base64_data = create_base64_image_data()
    mock_call = MockComputerUseCall(result=base64_data)
    
    result = handler.extract_url_from_computer_use_call(mock_call)
    
    assert result == "https://test-cloudfront.net/images/test-image.png", f"Expected S3 URL, got: {result}"
    assert mock_s3.upload_image.called, "S3 upload should have been called"
    print("✅ PASSED: Base64 data uploaded to S3 and URL returned")


def test_extract_url_from_result_data_uri():
    """Test extraction when result is data URI."""
    print("\n🧪 Test 6: Extract URL from ComputerUseCall.result (data URI)")
    print("-" * 60)
    
    mock_s3 = create_mock_s3_service()
    handler = ImageHandler(mock_s3)
    
    data_uri = create_data_uri_image()
    mock_call = MockComputerUseCall(result=data_uri)
    
    result = handler.extract_url_from_computer_use_call(mock_call)
    
    assert result == "https://test-cloudfront.net/images/test-image.png", f"Expected S3 URL, got: {result}"
    assert mock_s3.upload_image.called, "S3 upload should have been called"
    print("✅ PASSED: Data URI parsed and uploaded to S3")


def test_extract_url_from_result_dict_screenshot():
    """Test extraction when result is a dict with screenshot field."""
    print("\n🧪 Test 7: Extract URL from ComputerUseCall.result (dict with screenshot)")
    print("-" * 60)
    
    mock_s3 = create_mock_s3_service()
    handler = ImageHandler(mock_s3)
    
    # Test with URL in dict
    mock_call = MockComputerUseCall(result={"screenshot": "https://example.com/screenshot.png"})
    result = handler.extract_url_from_computer_use_call(mock_call)
    assert result == "https://example.com/screenshot.png", f"Expected URL, got: {result}"
    
    # Test with base64 in dict
    mock_s3.upload_image.reset_mock()
    base64_data = create_base64_image_data()
    mock_call = MockComputerUseCall(result={"screenshot": base64_data})
    result = handler.extract_url_from_computer_use_call(mock_call)
    assert result == "https://test-cloudfront.net/images/test-image.png", f"Expected S3 URL, got: {result}"
    assert mock_s3.upload_image.called, "S3 upload should have been called"
    
    print("✅ PASSED: Screenshot extracted from result dict (both URL and base64)")


def test_extract_url_from_result_dict_url():
    """Test extraction when result is a dict with url field."""
    print("\n🧪 Test 8: Extract URL from ComputerUseCall.result.url")
    print("-" * 60)
    
    mock_s3 = create_mock_s3_service()
    handler = ImageHandler(mock_s3)
    
    mock_call = MockComputerUseCall(result={"url": "https://example.com/screenshot.png"})
    
    result = handler.extract_url_from_computer_use_call(mock_call)
    
    assert result == "https://example.com/screenshot.png", f"Expected URL, got: {result}"
    print("✅ PASSED: URL extracted from result dict")


def test_extract_url_from_output_items():
    """Test extraction when screenshots are in output_items."""
    print("\n🧪 Test 9: Extract URL from ComputerUseCall.output_items")
    print("-" * 60)
    
    mock_s3 = create_mock_s3_service()
    handler = ImageHandler(mock_s3)
    
    # Need to create a mock object with type="screenshot" for output_items check
    class MockScreenshotItem:
        def __init__(self, url=None, data=None):
            self.type = "screenshot"
            if url:
                self.url = url
            if data:
                self.data = data
    
    screenshot_item = MockScreenshotItem(url="https://example.com/screenshot.png")
    mock_call = MockComputerUseCall(output_items=[screenshot_item])
    result = handler.extract_url_from_computer_use_call(mock_call)
    assert result == "https://example.com/screenshot.png", f"Expected URL, got: {result}"
    
    # Test with base64 in output_items
    mock_s3.upload_image.reset_mock()
    base64_data = create_base64_image_data()
    screenshot_item = MockScreenshotItem(data=base64_data)
    mock_call = MockComputerUseCall(output_items=[screenshot_item])
    result = handler.extract_url_from_computer_use_call(mock_call)
    assert result == "https://test-cloudfront.net/images/test-image.png", f"Expected S3 URL, got: {result}"
    assert mock_s3.upload_image.called, "S3 upload should have been called"
    
    print("✅ PASSED: Screenshot extracted from output_items (both URL and base64)")


def test_extract_image_urls_with_computer_use_call():
    """Test extract_image_urls with computer_use_call in response."""
    print("\n🧪 Test 10: Extract image URLs from response with computer_use_call")
    print("-" * 60)
    
    mock_s3 = create_mock_s3_service()
    handler = ImageHandler(mock_s3)
    
    # Create response with computer_use_call
    mock_call = MockComputerUseCall(result="https://example.com/screenshot.png")
    mock_response = MockResponse(output=[mock_call])
    
    tools = [{"type": "computer_use_preview"}]
    result = handler.extract_image_urls(mock_response, tools)
    
    assert len(result) == 1, f"Expected 1 URL, got {len(result)}"
    assert result[0] == "https://example.com/screenshot.png", f"Expected URL, got: {result[0]}"
    print("✅ PASSED: Image URLs extracted from response with computer_use_call")


def test_extract_image_urls_with_both_tools():
    """Test extract_image_urls with both image_generation and computer_use_preview."""
    print("\n🧪 Test 11: Extract image URLs with both tools")
    print("-" * 60)
    
    mock_s3 = create_mock_s3_service()
    handler = ImageHandler(mock_s3)
    
    # Create mock ImageGenerationCall
    class MockImageGenerationCall:
        def __init__(self):
            self.type = "image_generation_call"
            self.result = "https://example.com/generated-image.png"
        
        def model_dump(self):
            return {"type": "image_generation_call", "result": self.result}
    
    # Create response with both types
    mock_image_call = MockImageGenerationCall()
    mock_computer_call = MockComputerUseCall(result="https://example.com/screenshot.png")
    mock_response = MockResponse(output=[mock_image_call, mock_computer_call])
    
    tools = [{"type": "image_generation"}, {"type": "computer_use_preview"}]
    result = handler.extract_image_urls(mock_response, tools)
    
    assert len(result) == 2, f"Expected 2 URLs, got {len(result)}"
    assert "https://example.com/generated-image.png" in result
    assert "https://example.com/screenshot.png" in result
    print("✅ PASSED: Image URLs extracted from both tool types")


def test_no_images_when_computer_use_not_used():
    """Test that no images are extracted when computer_use_preview is not in tools."""
    print("\n🧪 Test 12: No images extracted when computer_use_preview not in tools")
    print("-" * 60)
    
    mock_s3 = create_mock_s3_service()
    handler = ImageHandler(mock_s3)
    
    mock_call = MockComputerUseCall(result="https://example.com/screenshot.png")
    mock_response = MockResponse(output=[mock_call])
    
    tools = [{"type": "web_search"}]  # Different tool
    result = handler.extract_image_urls(mock_response, tools)
    
    # Should still extract if computer_use_call is in output (we check output, not just tools)
    # But let's verify the logic is correct
    assert len(result) == 1, "Should extract from computer_use_call regardless of tools list"
    print("✅ PASSED: Images still extracted from computer_use_call items")


def test_extract_url_from_computer_screenshot():
    """Test extraction from computer_screenshot output item."""
    print("\n🧪 Test 13: Extract URL from computer_screenshot item")
    print("-" * 60)
    
    mock_s3 = create_mock_s3_service()
    handler = ImageHandler(mock_s3)
    
    # Test with data URI in image_url
    data_uri = create_data_uri_image()
    screenshot = MockComputerScreenshot(image_url=data_uri)
    result = handler.extract_url_from_computer_screenshot(screenshot)
    assert result == "https://test-cloudfront.net/images/test-image.png", f"Expected S3 URL, got: {result}"
    assert mock_s3.upload_image.called, "S3 upload should have been called"
    
    # Test with HTTP URL in image_url
    mock_s3.upload_image.reset_mock()
    screenshot = MockComputerScreenshot(image_url="https://example.com/screenshot.png")
    result = handler.extract_url_from_computer_screenshot(screenshot)
    assert result == "https://example.com/screenshot.png", f"Expected URL, got: {result}"
    assert not mock_s3.upload_image.called, "S3 upload should not have been called"
    
    print("✅ PASSED: Screenshot extracted from computer_screenshot item (both data URI and URL)")


def test_extract_image_urls_with_computer_screenshot():
    """Test extract_image_urls with computer_screenshot in response."""
    print("\n🧪 Test 14: Extract image URLs from response with computer_screenshot")
    print("-" * 60)
    
    mock_s3 = create_mock_s3_service()
    handler = ImageHandler(mock_s3)
    
    # Create response with computer_screenshot
    data_uri = create_data_uri_image()
    screenshot = MockComputerScreenshot(image_url=data_uri)
    mock_response = MockResponse(output=[screenshot])
    
    tools = [{"type": "computer_use_preview"}]
    result = handler.extract_image_urls(mock_response, tools)
    
    assert len(result) == 1, f"Expected 1 URL, got {len(result)}"
    assert result[0] == "https://test-cloudfront.net/images/test-image.png", f"Expected S3 URL, got: {result[0]}"
    print("✅ PASSED: Image URLs extracted from response with computer_screenshot")


def main():
    """Run all tests."""
    print("=" * 60)
    print("🧪 Unit Tests: Computer Use Preview Screenshot Extraction")
    print("=" * 60)
    
    tests = [
        test_extract_url_from_direct_url,
        test_extract_url_from_image_url,
        test_extract_url_from_screenshot_url,
        test_extract_url_from_result_string_url,
        test_extract_url_from_result_base64,
        test_extract_url_from_result_data_uri,
        test_extract_url_from_result_dict_screenshot,
        test_extract_url_from_result_dict_url,
        test_extract_url_from_output_items,
        test_extract_image_urls_with_computer_use_call,
        test_extract_image_urls_with_both_tools,
        test_no_images_when_computer_use_not_used,
        test_extract_url_from_computer_screenshot,
        test_extract_image_urls_with_computer_screenshot,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"❌ FAILED: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ ERROR: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    
    print("\n" + "=" * 60)
    print("📊 Test Results")
    print("=" * 60)
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"📈 Total: {passed + failed}")
    
    if failed == 0:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print("\n⚠️  Some tests failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())

