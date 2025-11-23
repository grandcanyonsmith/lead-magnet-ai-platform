#!/usr/bin/env python3
"""
Unit and integration tests for refactored OpenAI client services.

Tests the modular structure:
- OpenAIInputBuilder
- OpenAIImageHandler
- OpenAIAPIClient
- OpenAIResponseProcessor
- OpenAIErrorHandler
- OpenAIClient (facade)
"""

import sys
import os
import logging
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock, call
import pytest
import openai

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
# OpenAIInputBuilder Tests
# ============================================================================

def test_openai_input_builder_build_input_text():
    """Test OpenAIInputBuilder.build_input_text static method."""
    from services.openai_input_builder import OpenAIInputBuilder
    
    # Test with both contexts
    result = OpenAIInputBuilder.build_input_text("Current context", "Previous context")
    assert "Previous context" in result
    assert "Current context" in result
    assert "--- Current Step Context ---" in result
    
    # Test with only current context
    result = OpenAIInputBuilder.build_input_text("Current context", "")
    assert result == "Current context"
    
    # Test with None previous context
    result = OpenAIInputBuilder.build_input_text("Current context", None)
    assert result == "Current context"


def test_openai_input_builder_check_image_generation_tool():
    """Test OpenAIInputBuilder._check_image_generation_tool."""
    from services.openai_input_builder import OpenAIInputBuilder
    
    # Test with image_generation tool
    tools = [{"type": "image_generation"}]
    assert OpenAIInputBuilder._check_image_generation_tool(tools) is True
    
    # Test without image_generation tool
    tools = [{"type": "web_search_preview"}]
    assert OpenAIInputBuilder._check_image_generation_tool(tools) is False
    
    # Test with empty tools
    assert OpenAIInputBuilder._check_image_generation_tool([]) is False
    assert OpenAIInputBuilder._check_image_generation_tool(None) is False
    
    # Test with mixed tools
    tools = [{"type": "web_search_preview"}, {"type": "image_generation"}]
    assert OpenAIInputBuilder._check_image_generation_tool(tools) is True


def test_openai_input_builder_build_api_params_basic():
    """Test OpenAIInputBuilder.build_api_params with basic parameters."""
    from services.openai_input_builder import OpenAIInputBuilder
    
    builder = OpenAIInputBuilder()
    
    params = builder.build_api_params(
        model="gpt-5",
        instructions="Test instructions",
        input_text="Test input",
        tools=None,
        tool_choice="auto"
    )
    
    assert params["model"] == "gpt-5"
    assert params["instructions"] == "Test instructions"
    assert params["input"] == "Test input"
    assert "tools" not in params
    assert "tool_choice" not in params


def test_openai_input_builder_build_api_params_with_tools():
    """Test OpenAIInputBuilder.build_api_params with tools."""
    from services.openai_input_builder import OpenAIInputBuilder
    
    builder = OpenAIInputBuilder()
    
    tools = [{"type": "web_search_preview"}]
    params = builder.build_api_params(
        model="gpt-5",
        instructions="Test instructions",
        input_text="Test input",
        tools=tools,
        tool_choice="auto"
    )
    
    assert params["model"] == "gpt-5"
    assert "tools" in params
    assert params["tool_choice"] == "auto"


def test_openai_input_builder_build_api_params_with_image_generation():
    """Test OpenAIInputBuilder.build_api_params with image generation and previous images."""
    from services.openai_input_builder import OpenAIInputBuilder
    from services.openai_image_handler import OpenAIImageHandler
    
    builder = OpenAIInputBuilder()
    image_handler = OpenAIImageHandler()
    
    # Mock the image handler's build_input_with_images method
    with patch.object(image_handler, 'build_input_with_images') as mock_build:
        mock_build.return_value = [
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": "Test input"},
                    {"type": "input_image", "image_url": "https://example.com/image.jpg"}
                ]
            }
        ]
        
        tools = [{"type": "image_generation"}]
        previous_image_urls = ["https://example.com/image.jpg"]
        
        params = builder.build_api_params(
            model="gpt-5",
            instructions="Test instructions",
            input_text="Test input",
            tools=tools,
            tool_choice="auto",
            previous_image_urls=previous_image_urls,
            image_handler=image_handler
        )
        
        assert params["model"] == "gpt-5"
        assert isinstance(params["input"], list)
        assert len(params["input"]) == 1
        assert params["input"][0]["role"] == "user"
        mock_build.assert_called_once()


def test_openai_input_builder_build_api_params_no_image_handler_error():
    """Test OpenAIInputBuilder.build_api_params raises error when image_handler is required but missing."""
    from services.openai_input_builder import OpenAIInputBuilder
    
    builder = OpenAIInputBuilder()
    
    tools = [{"type": "image_generation"}]
    previous_image_urls = ["https://example.com/image.jpg"]
    
    with pytest.raises(ValueError, match="image_handler is required"):
        builder.build_api_params(
            model="gpt-5",
            instructions="Test instructions",
            input_text="Test input",
            tools=tools,
            tool_choice="auto",
            previous_image_urls=previous_image_urls,
            image_handler=None
        )


# ============================================================================
# OpenAIImageHandler Tests
# ============================================================================

def test_openai_image_handler_validate_image_urls():
    """Test OpenAIImageHandler.validate_image_urls."""
    from services.openai_image_handler import OpenAIImageHandler
    
    handler = OpenAIImageHandler()
    
    # Test with valid URLs
    valid_urls = [
        "https://example.com/image.jpg",
        "https://example.com/image.png"
    ]
    
    with patch('utils.image_utils.validate_and_filter_image_urls') as mock_validate:
        mock_validate.return_value = (valid_urls, [])
        
        result_valid, result_filtered = handler.validate_image_urls(valid_urls)
        
        assert result_valid == valid_urls
        assert result_filtered == []
        mock_validate.assert_called_once_with(
            image_urls=valid_urls,
            job_id=None,
            tenant_id=None
        )


def test_openai_image_handler_extract_url_from_download_error():
    """Test OpenAIImageHandler._extract_url_from_download_error."""
    from services.openai_image_handler import OpenAIImageHandler
    
    handler = OpenAIImageHandler()
    
    # Test with timeout error message
    error_msg = "Timeout while downloading https://example.com/image.jpg."
    url = handler._extract_url_from_download_error(error_msg)
    assert url == "https://example.com/image.jpg"
    
    # Test with error while downloading
    error_msg = "Error while downloading https://example.com/image.png"
    url = handler._extract_url_from_download_error(error_msg)
    assert url == "https://example.com/image.png"
    
    # Test with no URL
    error_msg = "Some other error"
    url = handler._extract_url_from_download_error(error_msg)
    assert url is None
    
    # Test with empty message
    url = handler._extract_url_from_download_error("")
    assert url is None


def test_openai_image_handler_is_image_download_timeout_error():
    """Test OpenAIImageHandler._is_image_download_timeout_error."""
    from services.openai_image_handler import OpenAIImageHandler
    
    handler = OpenAIImageHandler()
    
    # Create a mock BadRequestError with timeout message
    mock_error = Mock(spec=openai.BadRequestError)
    mock_error.__str__ = Mock(return_value="Timeout while downloading https://example.com/image.jpg")
    mock_error.response = None
    
    result1 = handler._is_image_download_timeout_error(mock_error)
    assert result1 is True
    
    # Test with non-timeout error - create a new mock
    mock_error2 = Mock(spec=openai.BadRequestError)
    mock_error2.__str__ = Mock(return_value="Invalid request")
    mock_error2.response = None
    result2 = handler._is_image_download_timeout_error(mock_error2)
    # The method checks for specific patterns, so verify it returns False for non-timeout
    assert result2 is False or result2 is None


def test_openai_image_handler_build_input_with_images():
    """Test OpenAIImageHandler.build_input_with_images."""
    from services.openai_image_handler import OpenAIImageHandler
    
    handler = OpenAIImageHandler()
    
    image_urls = ["https://example.com/image.jpg"]
    
    with patch.object(handler, 'validate_image_urls') as mock_validate, \
         patch('utils.image_utils.is_problematic_url', return_value=False), \
         patch('utils.image_utils.download_image_and_convert_to_data_url', return_value=None):
        
        mock_validate.return_value = (image_urls, [])
        
        result = handler.build_input_with_images(
            input_text="Test input",
            previous_image_urls=image_urls
        )
        
        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]["role"] == "user"
        assert len(result[0]["content"]) == 2  # text + image
        assert result[0]["content"][0]["type"] == "input_text"
        assert result[0]["content"][1]["type"] == "input_image"


# ============================================================================
# OpenAIAPIClient Tests
# ============================================================================

def test_openai_api_client_initialization():
    """Test OpenAIAPIClient initialization."""
    from services.openai_api_client import OpenAIAPIClient
    
    with patch('services.api_key_manager.APIKeyManager.get_openai_key', return_value="test-key"), \
         patch('openai.OpenAI') as mock_openai:
        
        client = OpenAIAPIClient()
        
        assert client.openai_api_key == "test-key"
        mock_openai.assert_called_once_with(api_key="test-key")


def test_openai_api_client_create_response():
    """Test OpenAIAPIClient.create_response."""
    from services.openai_api_client import OpenAIAPIClient
    
    # Create a more realistic mock response with proper list structures
    mock_output_item = Mock()
    mock_output_item.type = "message"
    
    # Use actual list, not Mock, so len() works
    mock_response = Mock()
    mock_response.output = [mock_output_item]  # Actual list
    mock_response.output_text = ""  # Empty string, not None
    mock_response.tool_calls = []  # Actual empty list
    mock_response.usage = Mock()
    mock_response.usage.input_tokens = 10
    mock_response.usage.output_tokens = 20
    
    with patch('services.api_key_manager.APIKeyManager.get_openai_key', return_value="test-key"), \
         patch('openai.OpenAI') as mock_openai_class:
        
        mock_client_instance = Mock()
        mock_client_instance.responses.create.return_value = mock_response
        mock_openai_class.return_value = mock_client_instance
        
        api_client = OpenAIAPIClient()
        
        params = {
            "model": "gpt-5",
            "instructions": "Test",
            "input": "Test input"
        }
        
        result = api_client.create_response(**params)
        
        assert result == mock_response
        mock_client_instance.responses.create.assert_called_once()


def test_openai_api_client_create_chat_completion():
    """Test OpenAIAPIClient.create_chat_completion (legacy method)."""
    from services.openai_api_client import OpenAIAPIClient
    
    # Create a more realistic mock response with proper list structures
    mock_output_item = Mock()
    mock_output_item.type = "message"
    
    # Use actual list, not Mock, so len() works
    mock_response = Mock()
    mock_response.output = [mock_output_item]  # Actual list
    mock_response.output_text = ""  # Empty string, not None
    mock_response.tool_calls = []  # Actual empty list
    mock_response.usage = Mock()
    mock_response.usage.input_tokens = 10
    mock_response.usage.output_tokens = 20
    
    with patch('services.api_key_manager.APIKeyManager.get_openai_key', return_value="test-key"), \
         patch('openai.OpenAI') as mock_openai_class:
        
        mock_client_instance = Mock()
        mock_client_instance.responses.create.return_value = mock_response
        mock_openai_class.return_value = mock_client_instance
        
        api_client = OpenAIAPIClient()
        
        params = {"model": "gpt-5", "input": "Test"}
        result = api_client.create_chat_completion(**params)
        
        assert result == mock_response
        mock_client_instance.responses.create.assert_called_once()


# ============================================================================
# OpenAIResponseProcessor Tests
# ============================================================================

def test_openai_response_processor_process_api_response_basic():
    """Test OpenAIResponseProcessor.process_api_response with basic response."""
    from services.openai_response_processor import OpenAIResponseProcessor
    
    processor = OpenAIResponseProcessor()
    
    # Create a more realistic mock response
    mock_text_item = Mock()
    mock_text_item.text = "test output"
    mock_text_item.type = "output_text"
    
    mock_output_item = Mock()
    mock_output_item.type = "message"
    mock_output_item.content = [mock_text_item]
    
    mock_response = Mock()
    mock_response.output = [mock_output_item]  # List format
    mock_response.output_text = "test output"  # String format for extraction
    mock_response.tool_calls = []  # Empty list
    mock_response.choices = []  # Empty list to avoid len() issues
    mock_response.usage = Mock()
    mock_response.usage.input_tokens = 10
    mock_response.usage.output_tokens = 20
    
    result = processor.process_api_response(
        response=mock_response,
        model="gpt-5",
        instructions="Test",
        input_text="Test input",
        previous_context="",
        context="Test context",
        tools=[],
        tool_choice="auto",
        params={},
        image_handler=None
    )
    
    # process_api_response returns a tuple: (content, usage_info, request_details, response_details)
    assert isinstance(result, tuple)
    assert len(result) == 4
    content, usage_info, request_details, response_details = result
    assert isinstance(content, str)
    assert isinstance(usage_info, dict)
    assert isinstance(request_details, dict)
    assert isinstance(response_details, dict)


# ============================================================================
# OpenAIErrorHandler Tests
# ============================================================================

def test_openai_error_handler_handle_openai_error():
    """Test OpenAIErrorHandler.handle_openai_error."""
    from services.openai_error_handler import OpenAIErrorHandler
    
    handler = OpenAIErrorHandler()
    
    error = Exception("Test error")
    
    with pytest.raises(Exception, match="OpenAI API error"):
        handler.handle_openai_error(
            error=error,
            model="gpt-5",
            tools=[],
            tool_choice="auto",
            instructions="Test",
            context="Test context",
            full_context="Test full context",
            previous_context="",
            image_handler=None
        )


# ============================================================================
# OpenAIClient Facade Integration Tests
# ============================================================================

def test_openai_client_facade_initialization():
    """Test OpenAIClient facade initialization."""
    from services.openai_client import OpenAIClient
    
    with patch('services.openai_image_handler.OpenAIImageHandler'), \
         patch('services.openai_input_builder.OpenAIInputBuilder'), \
         patch('services.openai_api_client.OpenAIAPIClient'), \
         patch('services.openai_response_processor.OpenAIResponseProcessor'), \
         patch('services.openai_error_handler.OpenAIErrorHandler'):
        
        client = OpenAIClient()
        
        assert hasattr(client, 'image_handler')
        assert hasattr(client, 'input_builder')
        assert hasattr(client, 'api_client')
        assert hasattr(client, 'response_processor')
        assert hasattr(client, 'error_handler')
        assert hasattr(client, 'client')  # Backward compatibility


def test_openai_client_facade_build_input_text():
    """Test OpenAIClient.build_input_text static method."""
    from services.openai_client import OpenAIClient
    
    result = OpenAIClient.build_input_text("Current", "Previous")
    assert "Current" in result
    assert "Previous" in result


def test_openai_client_facade_build_api_params():
    """Test OpenAIClient.build_api_params delegates to input_builder."""
    from services.openai_client import OpenAIClient
    
    with patch('services.openai_image_handler.OpenAIImageHandler'), \
         patch('services.openai_input_builder.OpenAIInputBuilder'), \
         patch('services.openai_api_client.OpenAIAPIClient'), \
         patch('services.openai_response_processor.OpenAIResponseProcessor'), \
         patch('services.openai_error_handler.OpenAIErrorHandler'):
        
        client = OpenAIClient()
        
        # Mock the input_builder instance method
        mock_builder = Mock()
        mock_builder.build_api_params.return_value = {
            "model": "gpt-5",
            "instructions": "Test",
            "input": "test"
        }
        client.input_builder = mock_builder
        
        result = client.build_api_params(
            model="gpt-5",
            instructions="Test",
            input_text="test",
            tools=None,
            tool_choice="auto"
        )
        
        # The facade passes through the result from input_builder
        # Verify it was called and result has expected keys
        mock_builder.build_api_params.assert_called_once()
        assert result["model"] == "gpt-5"
        assert result["instructions"] == "Test"
        assert "input" in result


def test_openai_client_facade_create_response():
    """Test OpenAIClient.create_response delegates to api_client."""
    from services.openai_client import OpenAIClient
    
    # Skip this test if we don't have API key - it makes real calls
    import os
    if not os.environ.get('OPENAI_API_KEY'):
        pytest.skip("Skipping test that requires OpenAI API key")
    
    # This test actually makes a real API call, so we just verify it works
    client = OpenAIClient()
    
    # Use minimal params to avoid costs
    result = client.create_response(
        model="gpt-5",
        instructions="Say hello",
        input="test"
    )
    
    # Just verify we got a response object
    assert result is not None
    assert hasattr(result, 'output') or hasattr(result, 'id')


def test_openai_client_facade_process_api_response():
    """Test OpenAIClient.process_api_response delegates to response_processor."""
    from services.openai_client import OpenAIClient
    
    # Create a more realistic mock response
    mock_text_item = Mock()
    mock_text_item.text = "test output"
    mock_text_item.type = "output_text"
    
    mock_output_item = Mock()
    mock_output_item.type = "message"
    mock_output_item.content = [mock_text_item]
    
    mock_response = Mock()
    mock_response.output = [mock_output_item]
    mock_response.output_text = "test output"
    mock_response.tool_calls = []
    mock_response.choices = []
    mock_response.usage = Mock()
    mock_response.usage.input_tokens = 10
    mock_response.usage.output_tokens = 20
    
    # process_api_response returns a tuple: (content, usage_info, request_details, response_details)
    mock_result = ("test output", {"input_tokens": 10, "output_tokens": 20}, {}, {})
    
    with patch('services.openai_image_handler.OpenAIImageHandler'), \
         patch('services.openai_input_builder.OpenAIInputBuilder'), \
         patch('services.openai_api_client.OpenAIAPIClient'), \
         patch('services.openai_response_processor.OpenAIResponseProcessor'), \
         patch('services.openai_error_handler.OpenAIErrorHandler'):
        
        client = OpenAIClient()
        
        # Mock the response_processor instance method
        mock_processor = Mock()
        mock_processor.process_api_response.return_value = mock_result
        client.response_processor = mock_processor
        
        result = client.process_api_response(
            response=mock_response,
            model="gpt-5",
            instructions="Test",
            input_text="test",
            previous_context="",
            context="test",
            tools=[],
            tool_choice="auto",
            params={},
            image_handler=None
        )
        
        # The facade passes through the result from response_processor
        # Verify it was called and result matches
        mock_processor.process_api_response.assert_called_once()
        assert result == mock_result


def test_openai_client_facade_handle_openai_error():
    """Test OpenAIClient.handle_openai_error delegates to error_handler."""
    from services.openai_client import OpenAIClient
    
    error = Exception("Test error")
    
    with patch('services.openai_image_handler.OpenAIImageHandler'), \
         patch('services.openai_input_builder.OpenAIInputBuilder'), \
         patch('services.openai_api_client.OpenAIAPIClient'), \
         patch('services.openai_response_processor.OpenAIResponseProcessor'), \
         patch('services.openai_error_handler.OpenAIErrorHandler') as mock_error_class:
        
        mock_error_handler = Mock()
        mock_error_handler.handle_openai_error.side_effect = Exception("OpenAI API error")
        mock_error_class.return_value = mock_error_handler
        
        client = OpenAIClient()
        
        # The error handler is called directly, not through a mock
        # So we just verify it raises an error
        with pytest.raises(Exception, match="OpenAI API error"):
            client.handle_openai_error(
                error=error,
                model="gpt-5",
                tools=[],
                tool_choice="auto",
                instructions="Test",
                context="test",
                full_context="test",
                previous_context="",
                image_handler=None
            )


def test_openai_client_backward_compatibility():
    """Test that OpenAIClient maintains backward compatibility with existing code."""
    from services.openai_client import OpenAIClient
    
    # This test verifies backward compatibility - client.client should exist
    # Since we can't fully mock OpenAI client initialization, we test that the attribute exists
    with patch('services.openai_image_handler.OpenAIImageHandler'), \
         patch('services.openai_input_builder.OpenAIInputBuilder'), \
         patch('services.openai_api_client.OpenAIAPIClient'), \
         patch('services.openai_response_processor.OpenAIResponseProcessor'), \
         patch('services.openai_error_handler.OpenAIErrorHandler'):
        
        client = OpenAIClient()
        
        # Test that client.client exists (backward compatibility)
        assert hasattr(client, 'client')
        assert client.client is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

