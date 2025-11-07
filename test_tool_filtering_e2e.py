#!/usr/bin/env python3
"""
End-to-end test for tool filtering with mocked OpenAI API
"""

import sys
import os
from unittest.mock import Mock, MagicMock, patch

# Add backend/worker to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend', 'worker'))

def test_generate_report_with_tool_filtering():
    """Test generate_report method with tool filtering"""
    
    # Mock OpenAI client
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.output_text = "Test report"
    mock_response.usage = MagicMock()
    mock_response.usage.input_tokens = 100
    mock_response.usage.output_tokens = 50
    mock_response.usage.total_tokens = 150
    mock_response.output = []
    mock_client.responses.create.return_value = mock_response
    
    # Mock S3Service
    mock_s3 = MagicMock()
    
    # Import after setting up mocks
    from ai_service import AIService
    
    # Create service instance with mocked dependencies
    with patch('ai_service.S3Service', return_value=mock_s3):
        with patch('ai_service.OpenAI', return_value=mock_client):
            # We need to patch the _get_openai_key method too
            with patch.object(AIService, '_get_openai_key', return_value='test-key'):
                ai_service = AIService()
                ai_service.client = mock_client
    
    print("=" * 80)
    print("Testing generate_report with Tool Filtering")
    print("=" * 80)
    print()
    
    test_cases = [
        {
            "name": "computer_use_preview without container should be filtered",
            "tools": [
                {"type": "web_search_preview"},
                {"type": "computer_use_preview"}  # Missing container
            ],
            "should_call_api": True,
            "expected_tools_in_api_call": [{"type": "web_search_preview"}]
        },
        {
            "name": "computer_use_preview with container should pass through",
            "tools": [
                {"type": "web_search_preview"},
                {"type": "computer_use_preview", "container": "my-container"}
            ],
            "should_call_api": True,
            "expected_tools_in_api_call": [
                {"type": "web_search_preview"},
                {"type": "computer_use_preview", "container": "my-container"}
            ]
        },
        {
            "name": "Only invalid computer_use_preview should fallback to default",
            "tools": [{"type": "computer_use_preview"}],
            "should_call_api": True,
            "expected_tools_in_api_call": [{"type": "web_search_preview"}]
        }
    ]
    
    passed = 0
    failed = 0
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"Test {i}: {test_case['name']}")
        print(f"  Input tools: {test_case['tools']}")
        
        # Reset mock
        mock_client.responses.create.reset_mock()
        
        try:
            # Call generate_report
            result = ai_service.generate_report(
                model="gpt-4",
                instructions="Test instructions",
                context="Test context",
                tools=test_case['tools']
            )
            
            # Check if API was called
            if test_case['should_call_api']:
                if mock_client.responses.create.called:
                    # Get the tools that were actually passed to the API
                    call_args = mock_client.responses.create.call_args
                    actual_tools = call_args.kwargs.get('tools', [])
                    
                    print(f"  Tools sent to API: {actual_tools}")
                    print(f"  Expected tools: {test_case['expected_tools_in_api_call']}")
                    
                    # Compare tools
                    def tools_equal(a, b):
                        if len(a) != len(b):
                            return False
                        for tool_a, tool_b in zip(a, b):
                            if isinstance(tool_a, dict) and isinstance(tool_b, dict):
                                if tool_a.get("type") != tool_b.get("type"):
                                    return False
                                if tool_a.get("container") != tool_b.get("container"):
                                    return False
                            else:
                                return False
                        return True
                    
                    if tools_equal(actual_tools, test_case['expected_tools_in_api_call']):
                        print(f"  ✅ PASSED")
                        passed += 1
                    else:
                        print(f"  ❌ FAILED - Tools don't match")
                        failed += 1
                else:
                    print(f"  ❌ FAILED - API was not called")
                    failed += 1
            else:
                if not mock_client.responses.create.called:
                    print(f"  ✅ PASSED - API correctly not called")
                    passed += 1
                else:
                    print(f"  ❌ FAILED - API was called when it shouldn't be")
                    failed += 1
                    
        except Exception as e:
            print(f"  ❌ FAILED - Exception: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
        
        print()
    
    print("=" * 80)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 80)
    
    return failed == 0

if __name__ == "__main__":
    success = test_generate_report_with_tool_filtering()
    sys.exit(0 if success else 1)

