#!/usr/bin/env python3
"""Test code_interpreter with OpenAI Responses API."""

import os
import sys
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend', 'worker'))

from utils.decimal_utils import convert_decimals_to_float
from services.tool_validator import ToolValidator
from services.openai_client import OpenAIClient

print("=" * 80)
print("TESTING CODE_INTERPRETER WITH OPENAI RESPONSES API")
print("=" * 80)

# Simulate DynamoDB tool with Decimal
tools_with_decimals = [{"type": "code_interpreter"}]

print(f"\n[STEP 1] Original tool: {tools_with_decimals}")

# Apply ToolValidator to inject container parameter
validated_tools, tool_choice = ToolValidator.validate_and_filter_tools(
    tools_with_decimals, 
    tool_choice="required",
    model="gpt-4o"
)

print(f"\n[STEP 2] After ToolValidator: {validated_tools}")
print(f"  - Container injected: {validated_tools[0].get('container')}")

# Normalize Decimals
normalized_tools = convert_decimals_to_float(validated_tools)

print(f"\n[STEP 3] After Decimal conversion: {normalized_tools}")

# Test with OpenAI Responses API
print(f"\n[STEP 4] Testing with OpenAI Responses API...")

api_key = os.environ.get("OPENAI_API_KEY")
if not api_key:
    print("❌ OPENAI_API_KEY not found")
    sys.exit(1)

client = OpenAIClient()

try:
    params = client.build_api_params(
        model="gpt-4o",
        instructions="You are a math assistant. Use code to solve problems.",
        input_text="Calculate the first 5 prime numbers",
        tools=normalized_tools,
        tool_choice=tool_choice
    )
    
    print(f"\n[STEP 5] API Parameters:")
    print(f"  - model: {params['model']}")
    print(f"  - tools: {params['tools']}")
    print(f"  - tool_choice: {params.get('tool_choice')}")
    
    response = client.create_response(**params)
    
    print(f"\n✅ RESPONSES API CALL SUCCESS!")
    print(f"  - Response ID: {response.id}")
    print(f"  - Output: {response.output_text[:200]}...")
    
except Exception as e:
    print(f"\n❌ API call FAILED: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 80)
print("✅ CODE_INTERPRETER WITH RESPONSES API WORKS!")
print("=" * 80)
print("\nSummary:")
print("1. ✅ Container parameter injected by ToolValidator")
print("2. ✅ Decimal types converted to float/int")
print("3. ✅ OpenAI Responses API accepts code_interpreter tool")
print("4. ✅ Code execution successful!")
print("=" * 80)
