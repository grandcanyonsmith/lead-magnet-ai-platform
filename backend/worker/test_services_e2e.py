#!/usr/bin/env python3
"""
End-to-end test for refactored services.
Tests that all services work together correctly using the Responses API.
"""

import sys
import os
import logging
from pathlib import Path

# Add the worker directory to Python path
worker_dir = Path(__file__).parent
sys.path.insert(0, str(worker_dir))

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def test_imports():
    """Test that all services can be imported."""
    logger.info("Testing imports...")
    
    try:
        from services.openai_client import OpenAIClient
        from services.api_key_manager import APIKeyManager
        from services.openai_error_classifier import OpenAIErrorClassifier
        from services.retry_handler import RetryHandler
        from services.tools import ToolValidator
        from services.image_handler import ImageHandler
        from services.html_generator import HTMLGenerator
        from services.context_builder import ContextBuilder
        from services.execution_step_manager import ExecutionStepManager
        from services.cua_loop_service import CUALoopService
        from services.browser_service import BrowserService
        logger.info("✅ All service imports successful")
        return True
    except Exception as e:
        logger.error(f"❌ Import failed: {e}", exc_info=True)
        return False


def test_service_initialization():
    """Test that services can be initialized."""
    logger.info("Testing service initialization...")
    
    try:
        from services.openai_client import OpenAIClient
        from services.html_generator import HTMLGenerator
        
        # Test OpenAI client (requires API key from Secrets Manager)
        try:
            openai_client = OpenAIClient()
            logger.info("✅ OpenAIClient initialized")
        except Exception as e:
            logger.warning(f"⚠️  OpenAIClient initialization skipped (requires AWS credentials): {e}")
            # Create a mock for testing
            openai_client = None
        
        # Test HTML generator
        if openai_client:
            html_generator = HTMLGenerator(openai_client)
            logger.info("✅ HTMLGenerator initialized")
        
        # Test services that require AWS environment variables
        try:
            from s3_service import S3Service
            from services.image_handler import ImageHandler
            from services.cua_loop_service import CUALoopService
            from ai_service import AIService
            
            # Check if required env vars are set
            required_vars = ['ARTIFACTS_BUCKET']
            missing_vars = [var for var in required_vars if not os.environ.get(var)]
            
            if missing_vars:
                logger.warning(f"⚠️  Skipping S3-dependent services (missing env vars: {missing_vars})")
                logger.info("✅ Core services initialized (S3-dependent services skipped)")
                return True
            
            s3_service = S3Service()
            logger.info("✅ S3Service initialized")
            
            image_handler = ImageHandler(s3_service)
            logger.info("✅ ImageHandler initialized")
            
            cua_loop_service = CUALoopService(image_handler)
            logger.info("✅ CUALoopService initialized")
            
            # Test AIService (which uses all the above)
            ai_service = AIService()
            logger.info("✅ AIService initialized")
        except KeyError as e:
            if 'ARTIFACTS_BUCKET' in str(e):
                logger.warning(f"⚠️  Skipping S3-dependent services (missing ARTIFACTS_BUCKET env var)")
                logger.info("✅ Core services initialized (S3-dependent services skipped)")
                return True
            raise
        
        return True
    except Exception as e:
        logger.error(f"❌ Service initialization failed: {e}", exc_info=True)
        return False


def test_openai_client_methods():
    """Test OpenAI client methods."""
    logger.info("Testing OpenAI client methods...")
    
    try:
        from services.openai_client import OpenAIClient
        
        client = OpenAIClient()
        
        # Test build_input_text
        input_text = OpenAIClient.build_input_text("Current context", "Previous context")
        assert "Previous context" in input_text
        assert "Current context" in input_text
        logger.info("✅ build_input_text works")
        
        # Test build_api_params
        params = client.build_api_params(
            model="gpt-5",
            instructions="Test instructions",
            input_text="Test input",
            tools=[{"type": "web_search"}],
            tool_choice="auto"
        )
        assert params["model"] == "gpt-5"
        assert params["instructions"] == "Test instructions"
        assert params["input"] == "Test input"
        assert "tools" in params
        assert params["tool_choice"] == "auto"
        logger.info("✅ build_api_params works")
        
        # Test without tools
        params_no_tools = client.build_api_params(
            model="gpt-5",
            instructions="Test",
            input_text="Test"
        )
        assert "tools" not in params_no_tools
        logger.info("✅ build_api_params without tools works")
        
        return True
    except Exception as e:
        logger.error(f"❌ OpenAI client methods test failed: {e}", exc_info=True)
        return False


def test_tool_validator():
    """Test tool validator."""
    logger.info("Testing tool validator...")
    
    try:
        from services.tools import ToolValidator
        
        # Test validation
        tools, choice = ToolValidator.validate_and_filter_tools(
            [{"type": "web_search"}],
            "auto",
            model="gpt-5"
        )
        assert len(tools) == 1
        assert tools[0]["type"] == "web_search"
        assert choice == "auto"
        logger.info("✅ Tool validation works")
        
        # Test has_image_generation
        assert ToolValidator.has_image_generation([{"type": "image_generation"}])
        assert not ToolValidator.has_image_generation([{"type": "web_search"}])
        logger.info("✅ has_image_generation works")
        
        # Test has_computer_use
        assert ToolValidator.has_computer_use([{"type": "computer_use_preview"}])
        assert not ToolValidator.has_computer_use([{"type": "web_search"}])
        logger.info("✅ has_computer_use works")
        
        return True
    except Exception as e:
        logger.error(f"❌ Tool validator test failed: {e}", exc_info=True)
        return False


def test_context_builder():
    """Test context builder."""
    logger.info("Testing context builder...")
    
    try:
        from services.context_builder import ContextBuilder
        
        # Test format_submission_data_with_labels
        data = {"name": "John", "email": "john@example.com"}
        labels = {"name": "Full Name", "email": "Email Address"}
        formatted = ContextBuilder.format_submission_data_with_labels(data, labels)
        assert "Full Name" in formatted
        assert "Email Address" in formatted
        assert "John" in formatted
        logger.info("✅ format_submission_data_with_labels works")
        
        # Test get_current_step_context
        context = ContextBuilder.get_current_step_context(0, "Initial context")
        assert context == "Initial context"
        
        context_empty = ContextBuilder.get_current_step_context(1, "Initial context")
        assert context_empty == ""
        logger.info("✅ get_current_step_context works")
        
        return True
    except Exception as e:
        logger.error(f"❌ Context builder test failed: {e}", exc_info=True)
        return False


def test_execution_step_manager():
    """Test execution step manager."""
    logger.info("Testing execution step manager...")
    
    try:
        from services.execution_step_manager import ExecutionStepManager
        from datetime import datetime
        
        # Test create_form_submission_step
        step = ExecutionStepManager.create_form_submission_step({"name": "Test"})
        assert step["step_type"] == "form_submission"
        assert step["step_order"] == 0
        logger.info("✅ create_form_submission_step works")
        
        # Test create_ai_generation_step
        usage_info = {
            "model": "gpt-5",
            "input_tokens": 100,
            "output_tokens": 50,
            "total_tokens": 150,
            "cost_usd": 0.001
        }
        step = ExecutionStepManager.create_ai_generation_step(
            step_name="Test Step",
            step_order=1,
            step_model="gpt-5",
            request_details={"model": "gpt-5"},
            response_details={"output_text": "Test output"},
            usage_info=usage_info,
            step_start_time=datetime.utcnow(),
            step_duration=1.5,
            artifact_id="test-artifact"
        )
        assert step["step_type"] == "ai_generation"
        assert step["step_order"] == 1
        assert step["model"] == "gpt-5"
        logger.info("✅ create_ai_generation_step works")
        
        return True
    except Exception as e:
        logger.error(f"❌ Execution step manager test failed: {e}", exc_info=True)
        return False


def test_error_handler():
    """Test error handler."""
    logger.info("Testing error handler...")
    
    try:
        from services.openai_error_classifier import OpenAIErrorClassifier
        
        # Test error classification
        assert OpenAIErrorClassifier.classify_error("API key invalid") == "authentication"
        assert OpenAIErrorClassifier.classify_error("rate limit exceeded") == "rate_limit"
        assert OpenAIErrorClassifier.classify_error("model not found") == "model_not_found"
        assert OpenAIErrorClassifier.classify_error("timeout occurred") == "timeout"
        logger.info("✅ Error classification works")
        
        # Test error exception creation
        exc = OpenAIErrorClassifier.create_error_exception(
            "authentication",
            "AuthenticationError",
            "Invalid API key",
            "gpt-5",
            [],
            "auto"
        )
        assert isinstance(exc, Exception)
        assert "authentication" in str(exc).lower()
        logger.info("✅ Error exception creation works")
        
        return True
    except Exception as e:
        logger.error(f"❌ Error handler test failed: {e}", exc_info=True)
        return False


def test_responses_api_integration():
    """Test that the Responses API is being used correctly."""
    logger.info("Testing Responses API integration...")
    
    try:
        from services.openai_client import OpenAIClient
        
        client = OpenAIClient()
        
        # Verify client has responses attribute
        assert hasattr(client.client, 'responses')
        logger.info("✅ OpenAI client has responses attribute")
        
        # Verify create_response method exists
        assert hasattr(client, 'create_response')
        assert hasattr(client, 'make_api_call')
        logger.info("✅ OpenAI client has Responses API methods")
        
        # Test parameter building for Responses API
        params = client.build_api_params(
            model="gpt-5",
            instructions="Test",
            input_text="Test input",
            tools=[{"type": "web_search"}],
            tool_choice="auto"
        )
        
        # Verify Responses API format (not Chat Completions format)
        assert "input" in params  # Responses API uses "input" not "messages"
        assert "instructions" in params  # Responses API uses "instructions"
        assert "model" in params
        assert "tools" in params
        assert "tool_choice" in params
        
        # Verify it does NOT have Chat Completions format
        assert "messages" not in params
        logger.info("✅ Parameters are in Responses API format")
        
        return True
    except Exception as e:
        logger.error(f"❌ Responses API integration test failed: {e}", exc_info=True)
        return False


def test_image_url_extraction():
    """Test image URL extraction from Responses API responses."""
    logger.info("Testing image URL extraction...")
    
    try:
        from services.openai_client import OpenAIClient
        
        client = OpenAIClient()
        
        # Create a mock response object with image items in output
        class MockUsage:
            def __init__(self):
                self.input_tokens = 100
                self.output_tokens = 50
                self.total_tokens = 150
        
        class MockImageItem:
            def __init__(self, url):
                self.type = 'image'
                self.image_url = url
        
        class MockResponse1:
            def __init__(self):
                self.output_text = "Here is the logo"
                self.output = [
                    MockImageItem("https://example.com/image1.png"),
                    MockImageItem("https://example.com/image2.png")
                ]
                self.usage = MockUsage()
        
        # Test extraction from response.output with image items
        response1 = MockResponse1()
        content, usage_info, request_details, response_details = client.process_api_response(
            response=response1,
            model="gpt-4o",
            instructions="Generate a logo",
            input_text="Create a logo",
            previous_context="",
            context="",
            tools=[{"type": "image_generation"}],
            tool_choice="auto",
            params={},
            image_handler=None
        )
        
        assert len(response_details['image_urls']) == 2
        assert "https://example.com/image1.png" in response_details['image_urls']
        assert "https://example.com/image2.png" in response_details['image_urls']
        logger.info("✅ Image URL extraction from response.output works")
        
        # Test with tool_call items
        class MockToolCallItem:
            def __init__(self):
                self.type = 'tool_call'
                self.name = 'image_generation'
                self.result = [
                    {"url": "https://example.com/image3.png"},
                    {"url": "https://example.com/image4.png"}
                ]
        
        class MockResponse2:
            def __init__(self):
                self.output_text = "Generated images"
                self.output = [MockToolCallItem()]
                self.usage = MockUsage()
        
        response2 = MockResponse2()
        content, usage_info, request_details, response_details = client.process_api_response(
            response=response2,
            model="gpt-4o",
            instructions="Generate images",
            input_text="Create images",
            previous_context="",
            context="",
            tools=[{"type": "image_generation"}],
            tool_choice="auto",
            params={},
            image_handler=None
        )
        
        assert len(response_details['image_urls']) == 2
        assert "https://example.com/image3.png" in response_details['image_urls']
        assert "https://example.com/image4.png" in response_details['image_urls']
        logger.info("✅ Image URL extraction from tool_call items works")
        
        # Test with single image result
        class MockToolCallItemSingle:
            def __init__(self):
                self.type = 'tool_call'
                self.name = 'image_generation'
                self.result = {"url": "https://example.com/image5.png"}
        
        class MockResponse3:
            def __init__(self):
                self.output_text = "Generated image"
                self.output = [MockToolCallItemSingle()]
                self.usage = MockUsage()
        
        response3 = MockResponse3()
        content, usage_info, request_details, response_details = client.process_api_response(
            response=response3,
            model="gpt-4o",
            instructions="Generate image",
            input_text="Create image",
            previous_context="",
            context="",
            tools=[{"type": "image_generation"}],
            tool_choice="auto",
            params={},
            image_handler=None
        )
        
        assert len(response_details['image_urls']) == 1
        assert "https://example.com/image5.png" in response_details['image_urls']
        logger.info("✅ Image URL extraction from single image result works")
        
        # Test with no images (should return empty list)
        class MockResponse4:
            def __init__(self):
                self.output_text = "No images here"
                self.output = []
                self.usage = MockUsage()
        
        response4 = MockResponse4()
        content, usage_info, request_details, response_details = client.process_api_response(
            response=response4,
            model="gpt-4o",
            instructions="Generate text",
            input_text="Create text",
            previous_context="",
            context="",
            tools=[],
            tool_choice="none",
            params={},
            image_handler=None
        )
        
        assert response_details['image_urls'] == []
        logger.info("✅ No images case returns empty list")
        
        return True
    except Exception as e:
        logger.error(f"❌ Image URL extraction test failed: {e}", exc_info=True)
        return False


def main():
    """Run all end-to-end tests."""
    logger.info("=" * 80)
    logger.info("END-TO-END SERVICE TESTS")
    logger.info("=" * 80)
    
    tests = [
        ("Imports", test_imports),
        ("Service Initialization", test_service_initialization),
        ("OpenAI Client Methods", test_openai_client_methods),
        ("Tool Validator", test_tool_validator),
        ("Context Builder", test_context_builder),
        ("Execution Step Manager", test_execution_step_manager),
        ("Error Handler", test_error_handler),
        ("Responses API Integration", test_responses_api_integration),
        ("Image URL Extraction", test_image_url_extraction),
    ]
    
    results = []
    for test_name, test_func in tests:
        logger.info(f"\n{'=' * 80}")
        logger.info(f"Running: {test_name}")
        logger.info("=" * 80)
        try:
            result = test_func()
            results.append((test_name, result))
            if result:
                logger.info(f"✅ {test_name} PASSED")
            else:
                logger.error(f"❌ {test_name} FAILED")
        except Exception as e:
            logger.error(f"❌ {test_name} FAILED with exception: {e}", exc_info=True)
            results.append((test_name, False))
    
    # Summary
    logger.info("\n" + "=" * 80)
    logger.info("TEST SUMMARY")
    logger.info("=" * 80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        logger.info(f"{status}: {test_name}")
    
    logger.info("=" * 80)
    logger.info(f"Total: {passed}/{total} tests passed")
    logger.info("=" * 80)
    
    if passed == total:
        logger.info("🎉 All tests passed!")
        return 0
    else:
        logger.error(f"❌ {total - passed} test(s) failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())

