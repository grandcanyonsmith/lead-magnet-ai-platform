#!/usr/bin/env python3
"""
E2E Test: Test container parameter fix with actual tool validation flow
Simulates what happens when a workflow step uses code_interpreter or computer_use_preview
"""

import sys
import os
import logging
import json

# Add backend/worker to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'worker'))

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)

try:
    from services.tool_validator import ToolValidator
except ImportError as e:
    print(f"❌ Failed to import ToolValidator: {e}")
    sys.exit(1)


def simulate_workflow_step_processing():
    """Simulate how workflow steps are processed in processor.py"""
    print("\n🧪 Simulating Workflow Step Processing")
    print("=" * 60)
    
    # Simulate step configurations as they come from the database
    test_steps = [
        {
            "step_name": "Research Step",
            "step_order": 0,
            "model": "gpt-5",
            "tools": ["web_search"],  # String format
            "tool_choice": "auto",
        },
        {
            "step_name": "Code Analysis Step",
            "step_order": 1,
            "model": "gpt-4.1",
            "tools": [{"type": "code_interpreter"}],  # Dict format without container
            "tool_choice": "auto",
        },
        {
            "step_name": "Computer Use Step",
            "step_order": 2,
            "model": "gpt-5",
            "tools": [{
                "type": "computer_use_preview",
                "display_width": 1920,
                "display_height": 1080,
                "environment": "browser"
            }],  # Dict format with config but no container
            "tool_choice": "auto",
        },
    ]
    
    print("\n📋 Processing workflow steps...")
    print("-" * 60)
    
    all_passed = True
    
    for step in test_steps:
        step_name = step["step_name"]
        step_tools_raw = step.get("tools", [])
        step_tool_choice = step.get("tool_choice", "auto")
        
        print(f"\n📝 Step: {step_name}")
        print(f"   Original tools: {step_tools_raw}")
        
        # Convert tool strings to tool dicts (as done in processor.py line 218)
        step_tools = [
            {"type": tool} if isinstance(tool, str) else tool 
            for tool in step_tools_raw
        ]
        
        print(f"   Converted tools: {step_tools}")
        
        # Validate and filter tools (this is where container should be added)
        validated_tools, normalized_tool_choice = ToolValidator.validate_and_filter_tools(
            tools=step_tools,
            tool_choice=step_tool_choice
        )
        
        print(f"   Validated tools: {json.dumps(validated_tools, indent=6)}")
        print(f"   Normalized tool_choice: {normalized_tool_choice}")
        
        # Check if container tools have container parameter
        container_tools = [
            tool for tool in validated_tools
            if tool.get("type") in ["code_interpreter", "computer_use_preview"]
        ]
        
        for tool in container_tools:
            tool_type = tool.get("type")
            if "container" not in tool:
                print(f"   ❌ FAILED: {tool_type} tool missing container parameter!")
                print(f"      Tool: {tool}")
                all_passed = False
            else:
                container = tool.get("container")
                if not isinstance(container, dict) or "type" not in container:
                    print(f"   ❌ FAILED: {tool_type} container is invalid!")
                    print(f"      Container: {container}")
                    all_passed = False
                else:
                    print(f"   ✅ {tool_type} has container: {container}")
        
        # Verify tools that don't need containers don't have them
        non_container_tools = [
            tool for tool in validated_tools
            if tool.get("type") not in ["code_interpreter", "computer_use_preview"]
        ]
        
        for tool in non_container_tools:
            if "container" in tool:
                print(f"   ⚠️  WARNING: {tool.get('type')} has container but shouldn't")
                print(f"      Tool: {tool}")
        
        # Simulate what would be sent to OpenAI API
        api_params = {
            "model": step.get("model", "gpt-5"),
            "tools": validated_tools,
            "tool_choice": normalized_tool_choice,
        }
        
        # Check if this would cause the OpenAI API error
        for i, tool in enumerate(api_params.get("tools", [])):
            if tool.get("type") in ["code_interpreter", "computer_use_preview"]:
                if "container" not in tool:
                    print(f"   ❌ CRITICAL: tools[{i}].container would be missing in API call!")
                    print(f"      This would cause: Missing required parameter: 'tools[{i}].container'")
                    all_passed = False
                else:
                    print(f"   ✅ tools[{i}] has container parameter - API call would succeed")
    
    return all_passed


def main():
    print("🚀 E2E Test: Container Parameter Fix")
    print("=" * 60)
    print("\nThis test simulates the actual workflow processing flow")
    print("to verify that container parameters are added before API calls.")
    print()
    
    result = simulate_workflow_step_processing()
    
    print("\n" + "=" * 60)
    print("🎯 E2E Test Results")
    print("=" * 60)
    
    if result:
        print("✅ E2E Test PASSED")
        print("\n✨ Verification:")
        print("   • Workflow steps with code_interpreter get container parameter")
        print("   • Workflow steps with computer_use_preview get container parameter")
        print("   • Container parameters are added before API calls")
        print("   • This prevents the OpenAI API error:")
        print("     'Missing required parameter: tools[0].container'")
        return 0
    else:
        print("❌ E2E Test FAILED")
        print("\n⚠️  Some issues were found. Please review the output above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())

