#!/usr/bin/env python3
"""
Test script to verify that previous image URLs are passed to image generation steps.

This script tests:
1. collect_previous_image_urls function
2. build_api_params with previous_image_urls
3. Integration with step processing
"""

import sys
import os
from typing import Dict, Any, List

# Add backend/worker to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'worker'))

from services.context_builder import ContextBuilder
from services.openai_client import OpenAIClient


def test_collect_previous_image_urls():
    """Test the collect_previous_image_urls function."""
    print("=" * 80)
    print("Test 1: collect_previous_image_urls")
    print("=" * 80)
    
    # Create mock execution steps
    execution_steps = [
        {
            'step_type': 'ai_generation',
            'step_order': 1,
            'step_name': 'Step 1',
            'output': 'Some text output',
            'image_urls': ['https://example.com/image1.png', 'https://example.com/image2.png']
        },
        {
            'step_type': 'ai_generation',
            'step_order': 2,
            'step_name': 'Step 2',
            'output': 'Text with image: https://example.com/image3.png',
            'image_urls': []
        },
        {
            'step_type': 'webhook',
            'step_order': 3,
            'step_name': 'Webhook Step',
            'output': 'Webhook output'
        },
        {
            'step_type': 'ai_generation',
            'step_order': 4,
            'step_name': 'Step 4',
            'output': 'Another step',
            'image_urls': ['https://example.com/image4.png']
        }
    ]
    
    # Test collecting URLs for step 3 (should get URLs from steps 1 and 2)
    current_step_order = 3
    result = ContextBuilder.collect_previous_image_urls(
        execution_steps=execution_steps,
        current_step_order=current_step_order
    )
    
    print(f"\nCurrent step order: {current_step_order}")
    print(f"Collected image URLs: {result}")
    print(f"Number of URLs: {len(result)}")
    
    # Expected: image1.png, image2.png, image3.png (from step 1 and 2)
    expected_urls = [
        'https://example.com/image1.png',
        'https://example.com/image2.png',
        'https://example.com/image3.png'
    ]
    
    assert len(result) == len(expected_urls), f"Expected {len(expected_urls)} URLs, got {len(result)}"
    assert all(url in result for url in expected_urls), "Missing expected URLs"
    assert 'https://example.com/image4.png' not in result, "Should not include URLs from future steps"
    
    print("✅ Test 1 passed: collect_previous_image_urls works correctly")
    print()
    
    # Test with no previous steps
    result_empty = ContextBuilder.collect_previous_image_urls(
        execution_steps=[],
        current_step_order=1
    )
    assert result_empty == [], "Should return empty list when no previous steps"
    print("✅ Test 1b passed: Returns empty list for first step")
    print()


def test_build_api_params_with_images():
    """Test build_api_params with previous image URLs."""
    print("=" * 80)
    print("Test 2: build_api_params with previous_image_urls")
    print("=" * 80)
    
    client = OpenAIClient()
    
    # Test with image_generation tool and previous URLs
    previous_urls = [
        'https://example.com/image1.png',
        'https://example.com/image2.png'
    ]
    
    params = client.build_api_params(
        model='gpt-5',
        instructions='Test instructions',
        input_text='Test input text',
        tools=[{'type': 'image_generation'}],
        tool_choice='required',
        previous_image_urls=previous_urls
    )
    
    print(f"\nInput type: {type(params['input'])}")
    print(f"Input content: {params['input']}")
    
    # Should be a list with role and content
    assert isinstance(params['input'], list), "Input should be a list when image URLs are provided"
    assert len(params['input']) == 1, "Input should have one message"
    assert params['input'][0]['role'] == 'user', "Role should be 'user'"
    
    content = params['input'][0]['content']
    assert isinstance(content, list), "Content should be a list"
    assert len(content) == 3, "Should have text + 2 images = 3 items"
    
    # First item should be text
    assert content[0]['type'] == 'input_text', "First item should be input_text"
    assert content[0]['text'] == 'Test input text', "Text should match"
    
    # Next items should be images
    assert content[1]['type'] == 'input_image', "Second item should be input_image"
    assert content[1]['image_url'] == previous_urls[0], "First image URL should match"
    assert content[2]['type'] == 'input_image', "Third item should be input_image"
    assert content[2]['image_url'] == previous_urls[1], "Second image URL should match"
    
    print("✅ Test 2a passed: API params built correctly with image URLs")
    print()
    
    # Test without image_generation tool (should use string format)
    params_no_tool = client.build_api_params(
        model='gpt-5',
        instructions='Test instructions',
        input_text='Test input text',
        tools=[{'type': 'web_search_preview'}],
        tool_choice='auto',
        previous_image_urls=previous_urls
    )
    
    assert isinstance(params_no_tool['input'], str), "Input should be string when no image_generation tool"
    assert params_no_tool['input'] == 'Test input text', "Input text should match"
    
    print("✅ Test 2b passed: Uses string format when no image_generation tool")
    print()
    
    # Test with image_generation but no previous URLs (should use string format)
    params_no_urls = client.build_api_params(
        model='gpt-5',
        instructions='Test instructions',
        input_text='Test input text',
        tools=[{'type': 'image_generation'}],
        tool_choice='required',
        previous_image_urls=[]
    )
    
    assert isinstance(params_no_urls['input'], str), "Input should be string when no previous URLs"
    
    print("✅ Test 2c passed: Uses string format when no previous URLs")
    print()


def test_deduplication():
    """Test that image URLs are deduplicated."""
    print("=" * 80)
    print("Test 3: Image URL deduplication")
    print("=" * 80)
    
    execution_steps = [
        {
            'step_type': 'ai_generation',
            'step_order': 1,
            'step_name': 'Step 1',
            'output': 'Text with image: https://example.com/duplicate.png',
            'image_urls': ['https://example.com/duplicate.png', 'https://example.com/image1.png']
        },
        {
            'step_type': 'ai_generation',
            'step_order': 2,
            'step_name': 'Step 2',
            'output': 'More text',
            'image_urls': ['https://example.com/duplicate.png']  # Duplicate
        }
    ]
    
    result = ContextBuilder.collect_previous_image_urls(
        execution_steps=execution_steps,
        current_step_order=3
    )
    
    print(f"\nCollected URLs: {result}")
    print(f"Number of URLs: {len(result)}")
    
    # Should only have 2 unique URLs (duplicate.png and image1.png)
    assert len(result) == 2, f"Expected 2 unique URLs, got {len(result)}"
    assert result.count('https://example.com/duplicate.png') == 1, "Duplicate URL should appear only once"
    
    print("✅ Test 3 passed: Deduplication works correctly")
    print()


def test_extraction_from_text():
    """Test that image URLs are extracted from output text."""
    print("=" * 80)
    print("Test 4: Image URL extraction from text")
    print("=" * 80)
    
    execution_steps = [
        {
            'step_type': 'ai_generation',
            'step_order': 1,
            'step_name': 'Step 1',
            'output': 'Here is an image: https://example.com/image-from-text.png and another https://example.com/image2.png',
            'image_urls': []  # No URLs in array, but URLs in text
        }
    ]
    
    result = ContextBuilder.collect_previous_image_urls(
        execution_steps=execution_steps,
        current_step_order=2
    )
    
    print(f"\nCollected URLs: {result}")
    
    # Should extract URLs from text
    assert 'https://example.com/image-from-text.png' in result, "Should extract URL from text"
    assert 'https://example.com/image2.png' in result, "Should extract second URL from text"
    
    print("✅ Test 4 passed: URLs extracted from text correctly")
    print()


def main():
    """Run all tests."""
    print("\n" + "=" * 80)
    print("Testing Image URL Passing to Image Generation")
    print("=" * 80)
    print()
    
    try:
        test_collect_previous_image_urls()
        test_build_api_params_with_images()
        test_deduplication()
        test_extraction_from_text()
        
        print("=" * 80)
        print("✅ ALL TESTS PASSED")
        print("=" * 80)
        print("\nSummary:")
        print("- collect_previous_image_urls correctly collects URLs from previous steps")
        print("- build_api_params correctly formats input with image URLs when image_generation tool is present")
        print("- Deduplication works correctly")
        print("- URLs are extracted from both image_urls arrays and output text")
        print("\nThe implementation is working correctly!")
        
        return 0
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return 1
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())

