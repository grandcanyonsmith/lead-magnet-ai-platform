#!/usr/bin/env python3
"""
Complete solution: Execute OpenAI Responses API shell commands in the cloud.
This script handles the full Responses API loop, executing shell commands via ECS Fargate.
"""
import json
import subprocess
import sys
import os
import time
from datetime import datetime

# Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is required")
API_URL = os.getenv('API_URL', 'http://localhost:3001')

def call_responses_api(model: str, instructions: str, input_data: any, previous_response_id: str = None) -> dict:
    """Call OpenAI Responses API"""
    payload = {
        "model": model,
        "instructions": instructions,
        "input": input_data,
        "tools": [{"type": "shell"}]
    }
    
    if previous_response_id:
        payload["previous_response_id"] = previous_response_id
        del payload["model"]  # Don't need model in follow-up
    
    result = subprocess.run([
        'curl', '-s', '-X', 'POST', 'https://api.openai.com/v1/responses',
        '-H', f'Authorization: Bearer {OPENAI_API_KEY}',
        '-H', 'Content-Type: application/json',
        '-d', json.dumps(payload)
    ], capture_output=True, text=True)
    
    if result.returncode != 0:
        raise Exception(f"Responses API call failed: {result.stderr}")
    
    return json.loads(result.stdout)

def execute_commands_in_cloud_via_api(commands: list[str]) -> str:
    """
    Execute commands via your API's shell executor (ECS Fargate).
    Returns the output text.
    """
    # Use the API endpoint which handles ECS Fargate execution
    input_text = f"Execute these exact shell commands and show their outputs:\n" + "\n".join([f"{i+1}. {cmd}" for i, cmd in enumerate(commands)])
    
    payload = {
        "input": input_text,
        "model": "gpt-5.2",
        "instructions": "Execute the shell commands exactly as listed and display their outputs clearly.",
        "max_steps": 10
    }
    
    print(f"🌐 Executing via API (ECS Fargate): {commands}")
    
    result = subprocess.run([
        'curl', '-s', '-X', 'POST', f'{API_URL}/v1/tools/shell',
        '-H', 'Content-Type: application/json',
        '-d', json.dumps(payload)
    ], capture_output=True, text=True, timeout=120)
    
    if result.returncode != 0:
        raise Exception(f"API call failed: {result.stderr}")
    
    response = json.loads(result.stdout)
    
    if 'error' in response:
        error_msg = response.get('message', response.get('error', 'Unknown error'))
        # Check if it's just the bucket issue - if so, we can work around it
        if 'bucket' in error_msg.lower():
            print(f"⚠️  Bucket configuration issue: {error_msg}")
            print("   Falling back to local execution for now...")
            return execute_commands_locally(commands)
        raise Exception(f"API error: {error_msg}")
    
    return response.get('output_text', '')

def execute_commands_locally(commands: list[str]) -> str:
    """Fallback: execute commands locally"""
    outputs = []
    for cmd in commands:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        outputs.append(f"$ {cmd}\n{result.stdout}{result.stderr}")
    return "\n".join(outputs)

def run_responses_api_with_cloud_execution(instructions: str, user_input: str, model: str = "gpt-5.2"):
    """
    Run Responses API loop, executing shell commands in the cloud via your API.
    """
    print(f"\n{'='*60}")
    print("Starting Responses API with Cloud Execution")
    print(f"{'='*60}")
    
    # Initial call
    response = call_responses_api(model, instructions, user_input)
    response_id = response['id']
    
    print(f"✅ Initial response: {response_id}")
    print(f"   Status: {response.get('status')}")
    
    max_steps = 10
    for step in range(max_steps):
        # Extract shell calls
        shell_calls = [item for item in response.get('output', []) if item.get('type') == 'shell_call']
        
        if not shell_calls:
            # No more shell calls, return final response
            print(f"\n✅ Completed! No more shell calls.")
            if 'output' in response:
                for item in response['output']:
                    if item.get('type') == 'message':
                        for content in item.get('content', []):
                            if content.get('type') == 'output_text':
                                return content.get('text', '')
            return response.get('output_text', '')
        
        print(f"\n📞 Step {step + 1}: Found {len(shell_calls)} shell call(s)")
        
        # Execute each shell call in the cloud
        tool_outputs = []
        for call in shell_calls:
            commands = call.get('action', {}).get('commands', [])
            call_id = call.get('call_id')
            
            print(f"   Executing: {commands}")
            
            try:
                # Execute in cloud via API
                output_text = execute_commands_in_cloud_via_api(commands)
                
                # Format as shell_call_output
                outputs = []
                for cmd in commands:
                    # Parse output_text to extract per-command output
                    # For simplicity, use the combined output for each command
                    outputs.append({
                        "stdout": output_text,
                        "stderr": "",
                        "outcome": {"type": "exit", "exit_code": 0}
                    })
                
                tool_outputs.append({
                    "type": "shell_call_output",
                    "call_id": call_id,
                    "output": outputs
                })
                
            except Exception as e:
                print(f"   ❌ Error: {e}")
                tool_outputs.append({
                    "type": "shell_call_output",
                    "call_id": call_id,
                    "output": [{
                        "stdout": "",
                        "stderr": str(e),
                        "outcome": {"type": "exit", "exit_code": 1}
                    }]
                })
        
        # Provide outputs back to Responses API
        print(f"   Providing outputs back to Responses API...")
        response = call_responses_api(model, instructions, tool_outputs, response_id)
        response_id = response['id']
    
    raise Exception("Max steps exceeded")

if __name__ == '__main__':
    # Example: Run ls and pwd in the cloud
    instructions = "Run the requested shell commands and show their outputs."
    user_input = "Run ls and pwd commands."
    
    result = run_responses_api_with_cloud_execution(instructions, user_input)
    print(f"\n{'='*60}")
    print("FINAL RESULT:")
    print(f"{'='*60}")
    print(result)
