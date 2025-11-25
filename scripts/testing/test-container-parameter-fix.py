#!/usr/bin/env python3
"""
Test script to verify container parameter fix in tool_validator.py
Tests that code_interpreter and computer_use_preview tools get container parameter added automatically
"""

import sys
import os
import logging
from typing import List, Dict

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
    print("Make sure you're running from the project root directory")
    sys.exit(1)


def test_requires_container():
    """Test requires_container method"""
    print("\n🧪 Testing requires_container() method")
    print("=" * 60)
    
    test_cases = [
        {"tool_type": "code_interpreter", "expected": True},
        {"tool_type": "computer_use_preview", "expected": True},
        {"tool_type": "web_search", "expected": False},
        {"tool_type": "image_generation", "expected": False},
        {"tool_type": "file_search", "expected": False},
        {"tool_type": "web_search", "expected": False},
    ]
    
    passed = 0
    failed = 0
    
    for test_case in test_cases:
        tool_type = test_case["tool_type"]
        expected = test_case["expected"]
        
        try:
            result = ToolValidator.requires_container(tool_type)
            
            if result == expected:
                print(f"   ✅ {tool_type}: {result} (expected {expected})")
                passed += 1
            else:
                print(f"   ❌ {tool_type}: {result} (expected {expected})")
                failed += 1
        except Exception as e:
            print(f"   ❌ {tool_type}: ERROR - {e}")
            failed += 1
    
    print(f"\n📊 Results: {passed} passed, {failed} failed")
    return failed == 0


def test_ensure_container_parameter():
    """Test ensure_container_parameter method"""
    print("\n🧪 Testing ensure_container_parameter() method")
    print("=" * 60)
    
    test_cases = [
        {
            "name": "code_interpreter without container",
            "input": {"type": "code_interpreter"},
            "expected_has_container": True,
            "expected_container_type": "auto",
        },
        {
            "name": "code_interpreter with existing container",
            "input": {"type": "code_interpreter", "container": {"type": "custom"}},
            "expected_has_container": True,
            "expected_container_type": "custom",  # Should preserve existing
        },
        {
            "name": "computer_use_preview without container",
            "input": {"type": "computer_use_preview"},
            "expected_has_container": True,
            "expected_container_type": "auto",
        },
        {
            "name": "computer_use_preview with display config",
            "input": {
                "type": "computer_use_preview",
                "display_width": 1920,
                "display_height": 1080,
                "environment": "browser"
            },
            "expected_has_container": True,
            "expected_container_type": "auto",
            "expected_preserves_config": True,
        },
        {
            "name": "web_search (no container needed)",
            "input": {"type": "web_search"},
            "expected_has_container": False,
        },
        {
            "name": "image_generation (no container needed)",
            "input": {"type": "image_generation"},
            "expected_has_container": False,
        },
    ]
    
    passed = 0
    failed = 0
    
    for test_case in test_cases:
        print(f"\n📝 Test: {test_case['name']}")
        print("-" * 60)
        
        try:
            input_tool = test_case["input"].copy()
            result = ToolValidator.ensure_container_parameter(input_tool)
            
            has_container = "container" in result
            expected_has_container = test_case.get("expected_has_container", False)
            
            print(f"   Input: {test_case['input']}")
            print(f"   Output: {result}")
            
            # Check if container is present/absent as expected
            if has_container != expected_has_container:
                raise AssertionError(
                    f"Expected has_container={expected_has_container}, got {has_container}"
                )
            
            # If container should exist, check its type
            if expected_has_container:
                container = result.get("container")
                if not isinstance(container, dict):
                    raise AssertionError(f"Container should be a dict, got {type(container)}")
                
                expected_type = test_case.get("expected_container_type")
                if expected_type:
                    actual_type = container.get("type")
                    if actual_type != expected_type:
                        raise AssertionError(
                            f"Expected container type={expected_type}, got {actual_type}"
                        )
                
                # Check if config is preserved for computer_use_preview
                if test_case.get("expected_preserves_config"):
                    original_input = test_case["input"]
                    if "display_width" in original_input:
                        if "display_width" not in result:
                            raise AssertionError("display_width should be preserved at tool level")
                    if "display_height" in original_input:
                        if "display_height" not in result:
                            raise AssertionError("display_height should be preserved at tool level")
                    if "environment" in original_input:
                        if "environment" not in result:
                            raise AssertionError("environment should be preserved at tool level")
            
            print("   ✅ PASSED")
            passed += 1
            
        except AssertionError as e:
            print(f"   ❌ FAILED: {e}")
            failed += 1
        except Exception as e:
            print(f"   ❌ ERROR: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    
    print("\n" + "=" * 60)
    print("📊 Test Summary")
    print("=" * 60)
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"📈 Total: {len(test_cases)}")
    
    return failed == 0


def test_validate_and_filter_tools_with_container():
    """Test validate_and_filter_tools adds container parameter"""
    print("\n🧪 Testing validate_and_filter_tools() with container tools")
    print("=" * 60)
    
    test_cases = [
        {
            "name": "code_interpreter as string",
            "tools": ["code_interpreter"],
            "tool_choice": "auto",
            "expected_container": True,
        },
        {
            "name": "code_interpreter as dict",
            "tools": [{"type": "code_interpreter"}],
            "tool_choice": "auto",
            "expected_container": True,
        },
        {
            "name": "computer_use_preview as string",
            "tools": ["computer_use_preview"],
            "tool_choice": "auto",
            "expected_container": True,
        },
        {
            "name": "computer_use_preview with config",
            "tools": [{
                "type": "computer_use_preview",
                "display_width": 1920,
                "display_height": 1080
            }],
            "tool_choice": "auto",
            "expected_container": True,
            "expected_preserves_config": True,
        },
        {
            "name": "mixed tools (one needs container)",
            "tools": [
                {"type": "web_search"},
                {"type": "code_interpreter"}
            ],
            "tool_choice": "auto",
            "expected_container": True,
            "expected_code_interpreter_has_container": True,
        },
        {
            "name": "web_search (no container needed)",
            "tools": [{"type": "web_search"}],
            "tool_choice": "auto",
            "expected_container": False,
        },
    ]
    
    passed = 0
    failed = 0
    
    for test_case in test_cases:
        print(f"\n📝 Test: {test_case['name']}")
        print("-" * 60)
        
        try:
            validated_tools, normalized_tool_choice = ToolValidator.validate_and_filter_tools(
                tools=test_case["tools"],
                tool_choice=test_case["tool_choice"]
            )
            
            print(f"   Input tools: {test_case['tools']}")
            print(f"   Validated tools: {validated_tools}")
            
            # Check if any tool has container (if expected)
            has_container = any("container" in tool for tool in validated_tools)
            expected_container = test_case.get("expected_container", False)
            
            if has_container != expected_container:
                raise AssertionError(
                    f"Expected has_container={expected_container}, got {has_container}"
                )
            
            # If container is expected, verify code_interpreter or computer_use_preview has it
            if expected_container:
                container_tools = [
                    tool for tool in validated_tools
                    if tool.get("type") in ["code_interpreter", "computer_use_preview"]
                ]
                
                if not container_tools:
                    raise AssertionError("Expected container tool but none found")
                
                for tool in container_tools:
                    if "container" not in tool:
                        raise AssertionError(
                            f"Tool {tool.get('type')} should have container parameter"
                        )
                    
                    container = tool.get("container")
                    if not isinstance(container, dict) or "type" not in container:
                        raise AssertionError(
                            f"Container should be a dict with 'type' key, got {container}"
                        )
                    
                    if container.get("type") != "auto":
                        # Allow custom types if they were in input
                        if tool.get("type") == "code_interpreter":
                            original = next(
                                (t for t in test_case["tools"] 
                                 if (isinstance(t, dict) and t.get("type") == "code_interpreter") 
                                 or t == "code_interpreter"),
                                None
                            )
                            if isinstance(original, dict) and original.get("container"):
                                # Custom container was provided, that's ok
                                pass
                            else:
                                raise AssertionError(
                                    f"Container type should be 'auto' for code_interpreter, got {container.get('type')}"
                                )
                
                # Check if config is preserved
                if test_case.get("expected_preserves_config"):
                    computer_use_tool = next(
                        (t for t in validated_tools if t.get("type") == "computer_use_preview"),
                        None
                    )
                    if computer_use_tool:
                        if "display_width" not in computer_use_tool:
                            raise AssertionError("display_width should be preserved")
                        if "display_height" not in computer_use_tool:
                            raise AssertionError("display_height should be preserved")
            
            print("   ✅ PASSED")
            passed += 1
            
        except AssertionError as e:
            print(f"   ❌ FAILED: {e}")
            failed += 1
        except Exception as e:
            print(f"   ❌ ERROR: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    
    print("\n" + "=" * 60)
    print("📊 Test Summary")
    print("=" * 60)
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"📈 Total: {len(test_cases)}")
    
    return failed == 0


def main():
    print("🚀 Testing Container Parameter Fix in tool_validator.py")
    print("=" * 60)
    
    results = []
    
    # Test 1: requires_container
    results.append(test_requires_container())
    
    # Test 2: ensure_container_parameter
    results.append(test_ensure_container_parameter())
    
    # Test 3: validate_and_filter_tools with container tools
    results.append(test_validate_and_filter_tools_with_container())
    
    # Final summary
    print("\n" + "=" * 60)
    print("🎯 Overall Results")
    print("=" * 60)
    
    if all(results):
        print("✅ All tests passed! Container parameter fix is working correctly.")
        print("\n✨ Key fixes verified:")
        print("   • code_interpreter gets container parameter automatically")
        print("   • computer_use_preview gets container parameter automatically")
        print("   • Existing container configs are preserved")
        print("   • Tools that don't need containers are unchanged")
        print("   • Tool-level config (display_width, etc.) is preserved")
        return 0
    else:
        print("❌ Some tests failed. Please review the errors above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())

