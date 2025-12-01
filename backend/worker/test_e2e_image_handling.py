#!/usr/bin/env python3
"""
End-to-end test for image handling improvements.
Simulates a real workflow step with image_generation tool.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from utils.image_utils import (
    clean_image_url,
    deduplicate_image_urls,
    get_image_cache,
    get_url_hash
)
from services.tool_builder import ToolBuilder
from services.openai_client import OpenAIClient

def test_e2e_workflow_step():
    """Test a complete workflow step with image_generation tool."""
    print("\n=== End-to-End Workflow Step Test ===")
    
    # Simulate a workflow step configuration from frontend
    step_config = {
        "step_name": "Logo Recreation",
        "step_type": "ai_generation",
        "model": "gpt-5",
        "instructions": "Recreate the logo with a transparent background.",
        "tools": [
            {
                "type": "image_generation",
                "size": "1024x1024",
                "quality": "high",
                "background": "transparent",
                "format": "png"
            }
        ],
        "tool_choice": "required"
    }
    
    # Simulate previous step outputs with image URLs (some with trailing punctuation)
    previous_image_urls = [
        "https://example.com/logo1.png",
        "https://example.com/logo2.jpg?size=large))",  # Has trailing punctuation
        "https://example.com/logo1.png?version=2",  # Duplicate base URL
        "https://example.com/brand-image.png.",
    ]
    
    print("Step Configuration:")
    print(f"  Name: {step_config['step_name']}")
    print(f"  Model: {step_config['model']}")
    print(f"  Tools: {step_config['tools']}")
    
    print(f"\nPrevious Image URLs ({len(previous_image_urls)}):")
    for url in previous_image_urls:
        print(f"  - {url}")
    
    # Step 1: Clean URLs
    print("\n1. Cleaning URLs...")
    cleaned_urls = [clean_image_url(url) for url in previous_image_urls]
    print(f"   Cleaned URLs:")
    for url in cleaned_urls:
        print(f"     - {url}")
    
    # Step 2: Deduplicate
    print("\n2. Deduplicating URLs...")
    deduplicated = deduplicate_image_urls(cleaned_urls)
    print(f"   Deduplicated: {len(deduplicated)} URLs")
    for url in deduplicated:
        print(f"     - {url}")
    
    # Step 3: Clean tools
    print("\n3. Cleaning tools...")
    cleaned_tools = ToolBuilder.clean_tools(step_config['tools'])
    img_gen_tool = next((t for t in cleaned_tools if isinstance(t, dict) and t.get('type') == 'image_generation'), None)
    if img_gen_tool:
        print(f"   Image generation tool config:")
        print(f"     size: {img_gen_tool.get('size')}")
        print(f"     quality: {img_gen_tool.get('quality')}")
        print(f"     background: {img_gen_tool.get('background')}")
        print(f"     format: {img_gen_tool.get('format', 'not set')}")
    
    # Step 4: Build API params
    print("\n4. Building API params...")
    client = OpenAIClient()
    params = client.build_api_params(
        model=step_config['model'],
        instructions=step_config['instructions'],
        input_text="Generate logo",
        tools=cleaned_tools,
        tool_choice=step_config['tool_choice'],
        previous_image_urls=deduplicated,
        job_id="test_e2e_job",
        tenant_id="test_tenant"
    )
    
    print(f"   Built params:")
    print(f"     model: {params.get('model')}")
    print(f"     has_tools: {'tools' in params}")
    if 'tools' in params:
        print(f"     tools_count: {len(params['tools'])}")
    if isinstance(params.get('input'), list):
        content = params['input'][0].get('content', [])
        image_count = len([item for item in content if item.get('type') == 'input_image'])
        print(f"     image_items_in_input: {image_count}")
    
    # Verify everything is correct
    assert params.get('model') == step_config['model'], "Model should match"
    assert 'tools' in params, "Tools should be in params"
    assert len(params['tools']) > 0, "Should have tools"
    
    img_gen_in_params = next((t for t in params['tools'] if isinstance(t, dict) and t.get('type') == 'image_generation'), None)
    assert img_gen_in_params is not None, "Image generation tool should be in params"
    assert img_gen_in_params.get('size') == '1024x1024', "Size should be preserved"
    assert img_gen_in_params.get('quality') == 'high', "Quality should be preserved"
    assert img_gen_in_params.get('background') == 'transparent', "Background should be preserved"
    
    print("\n✅ End-to-end test passed!")
    return True

def main():
    """Run end-to-end test."""
    print("=" * 80)
    print("End-to-End Image Handling Test")
    print("=" * 80)
    
    try:
        test_e2e_workflow_step()
        print("\n" + "=" * 80)
        print("✅ ALL END-TO-END TESTS PASSED!")
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
