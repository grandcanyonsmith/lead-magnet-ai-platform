#!/usr/bin/env python3
"""Test code_interpreter tool with Decimal conversion."""

import os
import sys
from decimal import Decimal
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend', 'worker'))

from utils.decimal_utils import convert_decimals_to_float
from services.tool_validator import ToolValidator

print("=" * 80)
print("TESTING CODE_INTERPRETER WITH DECIMAL CONVERSION & CONTAINER INJECTION")
print("=" * 80)

# Simulate DynamoDB tool with Decimal (like from your database)
tools_with_decimals = [
    {
        "type": "code_interpreter",
        # Note: container parameter is MISSING
    }
]

print(f"\n[STEP 1] Original tool: {tools_with_decimals}")
print(f"  - Has 'container' parameter: {'container' in tools_with_decimals[0]}")

# Apply ToolValidator
validated_tools, tool_choice = ToolValidator.validate_and_filter_tools(
    tools_with_decimals, 
    tool_choice="required",
    model="gpt-4o"
)

print(f"\n[STEP 2] After ToolValidator: {validated_tools}")
print(f"  - Has 'container' parameter: {'container' in validated_tools[0]}")
if 'container' in validated_tools[0]:
    print(f"  - Container value: {validated_tools[0]['container']}")

# Normalize Decimals
normalized_tools = convert_decimals_to_float(validated_tools)

print(f"\n[STEP 3] After Decimal conversion: {normalized_tools}")

# Test JSON serialization
try:
    json_str = json.dumps(normalized_tools)
    print(f"\n✅ JSON serialization SUCCESS")
except TypeError as e:
    print(f"\n❌ JSON serialization FAILED: {e}")
    sys.exit(1)

# Test with real OpenAI API
print(f"\n[STEP 4] Testing with OpenAI API...")
try:
    import openai
    
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("⚠️  OPENAI_API_KEY not found")
        sys.exit(1)
    
    client = openai.OpenAI(api_key=api_key)
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Calculate 123 * 456"}],
        tools=normalized_tools,
        tool_choice=tool_choice
    )
    
    print(f"✅ OpenAI API call SUCCESS!")
    print(f"  Response ID: {response.id}")
    print(f"  Finish reason: {response.choices[0].finish_reason}")
    
    if response.choices[0].message.tool_calls:
        print(f"  Tool calls: {len(response.choices[0].message.tool_calls)}")
        
except Exception as e:
    print(f"❌ OpenAI API call FAILED: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 80)
print("✅ CODE_INTERPRETER TEST PASSED!")
print("=" * 80)
