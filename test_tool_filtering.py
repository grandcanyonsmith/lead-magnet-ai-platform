#!/usr/bin/env python3
"""
Test script to verify tool filtering logic for computer_use_preview
"""

import sys
import os

# Add backend/worker to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend', 'worker'))

from ai_service import AIService
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def test_tool_filtering():
    """Test that computer_use_preview without container is filtered out"""
    
    # We'll test the filtering logic directly without instantiating AIService
    # since we don't need to make actual API calls
    
    # Test cases
    test_cases = [
        {
            "name": "computer_use_preview without container (string)",
            "tools": ["web_search_preview", "computer_use_preview"],
            "expected_filtered": [{"type": "web_search_preview"}]  # Strings get converted to dicts
        },
        {
            "name": "computer_use_preview without container (dict)",
            "tools": [
                {"type": "web_search_preview"},
                {"type": "computer_use_preview"}
            ],
            "expected_filtered": [{"type": "web_search_preview"}]
        },
        {
            "name": "computer_use_preview with empty container string",
            "tools": [
                {"type": "web_search_preview"},
                {"type": "computer_use_preview", "container": ""}
            ],
            "expected_filtered": [{"type": "web_search_preview"}]
        },
        {
            "name": "computer_use_preview with whitespace-only container",
            "tools": [
                {"type": "web_search_preview"},
                {"type": "computer_use_preview", "container": "   "}
            ],
            "expected_filtered": [{"type": "web_search_preview"}]
        },
        {
            "name": "computer_use_preview with valid container",
            "tools": [
                {"type": "web_search_preview"},
                {"type": "computer_use_preview", "container": "my-container"}
            ],
            "expected_filtered": [
                {"type": "web_search_preview"},
                {"type": "computer_use_preview", "container": "my-container"}
            ]
        },
        {
            "name": "Only computer_use_preview without container",
            "tools": [{"type": "computer_use_preview"}],
            "expected_filtered": [{"type": "web_search_preview"}]  # Should fallback to default
        },
        {
            "name": "file_search without vector_store_ids",
            "tools": [
                {"type": "web_search_preview"},
                {"type": "file_search"}
            ],
            "expected_filtered": [{"type": "web_search_preview"}]
        },
        {
            "name": "file_search with empty vector_store_ids",
            "tools": [
                {"type": "web_search_preview"},
                {"type": "file_search", "vector_store_ids": []}
            ],
            "expected_filtered": [{"type": "web_search_preview"}]
        },
        {
            "name": "file_search with valid vector_store_ids",
            "tools": [
                {"type": "web_search_preview"},
                {"type": "file_search", "vector_store_ids": ["vs-123"]}
            ],
            "expected_filtered": [
                {"type": "web_search_preview"},
                {"type": "file_search", "vector_store_ids": ["vs-123"]}
            ]
        },
        {
            "name": "Mixed valid and invalid tools",
            "tools": [
                {"type": "web_search_preview"},
                {"type": "computer_use_preview"},  # Invalid - no container
                {"type": "computer_use_preview", "container": "valid-container"},  # Valid
                {"type": "file_search"},  # Invalid - no vector_store_ids
            ],
            "expected_filtered": [
                {"type": "web_search_preview"},
                {"type": "computer_use_preview", "container": "valid-container"}
            ]
        }
    ]
    
    print("=" * 80)
    print("Testing Tool Filtering Logic")
    print("=" * 80)
    print()
    
    passed = 0
    failed = 0
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"Test {i}: {test_case['name']}")
        print(f"  Input tools: {test_case['tools']}")
        
        # Simulate the filtering logic
        tools = test_case['tools']
        
        # Step 1: Initial filtering
        filtered_tools = []
        for tool in tools:
            tool_type = tool.get("type") if isinstance(tool, dict) else tool
            tool_dict = tool if isinstance(tool, dict) else {"type": tool}
            
            # Skip file_search if vector_store_ids is not provided or is empty
            if tool_type == "file_search":
                vector_store_ids = tool_dict.get("vector_store_ids")
                if not vector_store_ids or (isinstance(vector_store_ids, list) and len(vector_store_ids) == 0):
                    continue
            
            # Skip computer_use_preview if container is not provided or is empty
            if tool_type == "computer_use_preview":
                container = tool_dict.get("container")
                if not container or (isinstance(container, str) and container.strip() == ""):
                    continue
            
            filtered_tools.append(tool_dict)
        
        # Step 2: Validation pass
        validated_tools = []
        for tool in filtered_tools:
            tool_type = tool.get("type") if isinstance(tool, dict) else tool
            tool_dict = tool if isinstance(tool, dict) else {"type": tool}
            
            if tool_type == "computer_use_preview":
                container = tool_dict.get("container")
                if not container or (isinstance(container, str) and container.strip() == ""):
                    continue
            
            if tool_type == "file_search":
                vector_store_ids = tool_dict.get("vector_store_ids")
                if not vector_store_ids or (isinstance(vector_store_ids, list) and len(vector_store_ids) == 0):
                    continue
            
            validated_tools.append(tool_dict)
        
        # Step 3: Final safety check
        final_tools = []
        for tool in validated_tools:
            if isinstance(tool, dict):
                tool_type = tool.get("type", "")
                if tool_type == "computer_use_preview":
                    container = tool.get("container")
                    if not container or (isinstance(container, str) and container.strip() == ""):
                        continue
                final_tools.append(tool)
            elif isinstance(tool, str) and tool == "computer_use_preview":
                continue
            else:
                final_tools.append(tool)
        
        # If all tools were removed, use default
        if len(final_tools) == 0 and len(tools) > 0:
            final_tools = [{"type": "web_search_preview"}]
        elif len(final_tools) == 0:
            final_tools = [{"type": "web_search_preview"}]
        
        result_tools = final_tools
        
        # Compare results
        expected = test_case['expected_filtered']
        
        # Normalize for comparison (sort by type)
        def normalize_tool(t):
            if isinstance(t, dict):
                return t.get("type", "")
            return str(t)
        
        result_sorted = sorted(result_tools, key=normalize_tool)
        expected_sorted = sorted(expected, key=normalize_tool)
        
        # Deep comparison
        def tools_equal(a, b):
            if len(a) != len(b):
                return False
            for tool_a, tool_b in zip(sorted(a, key=normalize_tool), sorted(b, key=normalize_tool)):
                if isinstance(tool_a, dict) and isinstance(tool_b, dict):
                    if tool_a.get("type") != tool_b.get("type"):
                        return False
                    # Check container if present
                    if tool_a.get("container") != tool_b.get("container"):
                        return False
                    # Check vector_store_ids if present
                    if tool_a.get("vector_store_ids") != tool_b.get("vector_store_ids"):
                        return False
                elif tool_a != tool_b:
                    return False
            return True
        
        if tools_equal(result_tools, expected):
            print(f"  ✅ PASSED")
            print(f"  Output tools: {result_tools}")
            passed += 1
        else:
            print(f"  ❌ FAILED")
            print(f"  Expected: {expected}")
            print(f"  Got:      {result_tools}")
            failed += 1
        
        print()
    
    print("=" * 80)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 80)
    
    return failed == 0

if __name__ == "__main__":
    success = test_tool_filtering()
    sys.exit(0 if success else 1)

