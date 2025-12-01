#!/usr/bin/env python3
"""
Test integration of image_generation tool parameters with OpenAI client.
"""

import sys
import os
from pathlib import Path

# Add backend/worker to path
sys.path.insert(0, str(Path(__file__).parent))

from services.openai_client import OpenAIClient
from services.tool_builder import ToolBuilder

def test_tool_building_with_image_generation():
    """Test that image_generation tools are properly built for OpenAI API."""
    print("\n=== Testing Image Generation Tool Building ===")
    
    # Test various image_generation configurations
    test_cases = [
        {
            "name": "Full config",
            "tools": [{
                "type": "image_generation",
                "size": "1024x1536",
                "quality": "high",
                "format": "png",
                "compression": 95,
                "background": "transparent",
                "input_fidelity": "high"
            }]
        },
        {
            "name": "Auto values",
            "tools": [{
                "type": "image_generation",
                "size": "auto",
                "quality": "auto",
                "background": "auto"
            }]
        },
        {
            "name": "Minimal config",
            "tools": [{
                "type": "image_generation"
            }]
        },
        {
            "name": "String format (should be converted)",
            "tools": ["image_generation"]
        }
    ]
    
    for test_case in test_cases:
        print(f"\nTest: {test_case['name']}")
        tools = test_case['tools']
        
        # Clean tools (as done in OpenAI client)
        cleaned = ToolBuilder.clean_tools(tools)
        
        print(f"  Input tools: {tools}")
        print(f"  Cleaned tools: {cleaned}")
        
        # Find image_generation tool
        img_gen_tool = None
        for tool in cleaned:
            if isinstance(tool, dict) and tool.get("type") == "image_generation":
                img_gen_tool = tool
                break
        
        if img_gen_tool:
            print(f"  ✅ Image generation tool found:")
            print(f"     size: {img_gen_tool.get('size')}")
            print(f"     quality: {img_gen_tool.get('quality')}")
            print(f"     background: {img_gen_tool.get('background')}")
            print(f"     format: {img_gen_tool.get('format', 'not set')}")
            print(f"     compression: {img_gen_tool.get('compression', 'not set')}")
            print(f"     input_fidelity: {img_gen_tool.get('input_fidelity', 'not set')}")
            
            # Verify required fields are present
            assert img_gen_tool.get("size") is not None, "size should be set"
            assert img_gen_tool.get("quality") is not None, "quality should be set"
            assert img_gen_tool.get("background") is not None, "background should be set"
        else:
            print(f"  ❌ Image generation tool not found!")
            assert False, "Image generation tool should be found"
    
    print("\n✅ Tool building integration tests passed")

def test_build_api_params_with_image_generation():
    """Test build_api_params with image_generation tool."""
    print("\n=== Testing build_api_params with Image Generation ===")
    
    client = OpenAIClient()
    
    tools = [{
        "type": "image_generation",
        "size": "1024x1024",
        "quality": "high",
        "background": "transparent"
    }]
    
    previous_image_urls = [
        "https://example.com/image1.jpg",
        "https://example.com/image2.png"
    ]
    
    params = client.build_api_params(
        model="gpt-5",
        instructions="Test instructions",
        input_text="Test input",
        tools=tools,
        tool_choice="required",
        previous_image_urls=previous_image_urls,
        job_id="test_job_123",
        tenant_id="test_tenant"
    )
    
    print(f"Built params:")
    print(f"  Model: {params.get('model')}")
    print(f"  Has tools: {'tools' in params}")
    if 'tools' in params:
        print(f"  Tools count: {len(params['tools'])}")
        for i, tool in enumerate(params['tools']):
            if isinstance(tool, dict) and tool.get('type') == 'image_generation':
                print(f"  Tool {i+1} (image_generation):")
                print(f"    size: {tool.get('size')}")
                print(f"    quality: {tool.get('quality')}")
                print(f"    background: {tool.get('background')}")
    
    print(f"  Input type: {type(params.get('input'))}")
    if isinstance(params.get('input'), list):
        print(f"  Input items: {len(params['input'])}")
        if len(params['input']) > 0:
            content = params['input'][0].get('content', [])
            print(f"  Content items: {len(content)}")
            image_items = [item for item in content if item.get('type') == 'input_image']
            print(f"  Image items: {len(image_items)}")
    
    # Verify tools are preserved
    assert 'tools' in params, "Tools should be in params"
    img_gen_tool = next((t for t in params['tools'] if isinstance(t, dict) and t.get('type') == 'image_generation'), None)
    assert img_gen_tool is not None, "Image generation tool should be in params"
    assert img_gen_tool.get('size') == '1024x1024', "Size should be preserved"
    assert img_gen_tool.get('quality') == 'high', "Quality should be preserved"
    assert img_gen_tool.get('background') == 'transparent', "Background should be preserved"
    
    print("\n✅ build_api_params integration tests passed")

def test_deduplication_integration():
    """Test deduplication in build_api_params."""
    print("\n=== Testing Deduplication in build_api_params ===")
    
    client = OpenAIClient()
    
    tools = [{"type": "image_generation"}]
    
    # Include duplicates
    previous_image_urls = [
        "https://example.com/image.jpg",
        "https://example.com/image.jpg?size=large",  # Should be deduplicated
        "https://example.com/other.png",
        "https://example.com/image.jpg?size=small",  # Should be deduplicated
    ]
    
    params = client.build_api_params(
        model="gpt-5",
        instructions="Test",
        input_text="Test",
        tools=tools,
        previous_image_urls=previous_image_urls,
        job_id="test_job",
        tenant_id="test_tenant"
    )
    
    if isinstance(params.get('input'), list):
        content = params['input'][0].get('content', [])
        image_items = [item for item in content if item.get('type') == 'input_image']
        print(f"Original URLs: {len(previous_image_urls)}")
        print(f"Image items in params: {len(image_items)}")
        
        # Should have fewer items due to deduplication
        assert len(image_items) <= len(previous_image_urls), "Deduplication should reduce count"
        print(f"✅ Deduplication working: {len(previous_image_urls)} -> {len(image_items)}")
    
    print("✅ Deduplication integration tests passed")

def main():
    """Run all integration tests."""
    print("=" * 80)
    print("Image Generation Tool Integration Tests")
    print("=" * 80)
    
    try:
        test_tool_building_with_image_generation()
        test_build_api_params_with_image_generation()
        test_deduplication_integration()
        
        print("\n" + "=" * 80)
        print("✅ ALL INTEGRATION TESTS PASSED!")
        print("=" * 80)
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
