#!/usr/bin/env python3
"""
Execute OpenAI Responses API shell commands in the cloud via your API's shell executor.
This intercepts shell calls from Responses API and executes them in ECS Fargate.
"""
import json
import subprocess
import sys
import os

# Try to get API URL from environment or use localhost
API_URL = os.getenv('API_URL', 'http://localhost:3001')

def execute_shell_commands_via_api(commands: list[str], workspace_id: str = None) -> dict:
    """
    Execute shell commands via your API's shell executor (runs in ECS Fargate).
    The API endpoint handles the Responses API loop internally.
    """
    # Convert commands to natural language input for the API
    # The API will execute these via ECS Fargate
    input_text = f"Execute these shell commands: {' && '.join(commands)}"
    
    payload = {
        "input": input_text,
        "model": "gpt-5.2",
        "instructions": "Execute the requested shell commands exactly as specified.",
        "max_steps": 5,
    }
    
    if workspace_id:
        payload["workspace_id"] = workspace_id
        payload["reset_workspace"] = False
    
    print(f"🌐 Calling API: {API_URL}/v1/tools/shell")
    print(f"   Commands: {commands}")
    
    result = subprocess.run([
        'curl', '-s', '-X', 'POST', f'{API_URL}/v1/tools/shell',
        '-H', 'Content-Type: application/json',
        '-d', json.dumps(payload)
    ], capture_output=True, text=True)
    
    if result.returncode != 0:
        raise Exception(f"API call failed: {result.stderr}")
    
    response = json.loads(result.stdout)
    
    if 'error' in response:
        raise Exception(f"API error: {response.get('message', response.get('error'))}")
    
    return response

def handle_responses_api_shell_calls(response_id: str, shell_calls: list[dict]) -> list[dict]:
    """
    Handle shell calls from Responses API by executing them in the cloud.
    Returns tool outputs in the format expected by Responses API.
    """
    tool_outputs = []
    
    for call in shell_calls:
        call_id = call.get('call_id')
        commands = call.get('action', {}).get('commands', [])
        
        if not commands:
            tool_outputs.append({
                "type": "shell_call_output",
                "call_id": call_id,
                "output": [{
                    "stdout": "",
                    "stderr": "No commands provided",
                    "outcome": {"type": "exit", "exit_code": 1}
                }]
            })
            continue
        
        print(f"\n{'='*60}")
        print(f"Executing in cloud: {commands}")
        print(f"{'='*60}")
        
        try:
            # Execute via API (runs in ECS Fargate)
            result = execute_shell_commands_via_api(commands)
            
            # Parse the output_text to extract command outputs
            # The API returns natural language, so we need to extract the actual outputs
            output_text = result.get('output_text', '')
            
            # For now, create a simple output structure
            # In a real implementation, you'd parse the output_text more carefully
            outputs = []
            for cmd in commands:
                outputs.append({
                    "stdout": output_text,  # API returns combined output
                    "stderr": "",
                    "outcome": {"type": "exit", "exit_code": 0}
                })
            
            tool_outputs.append({
                "type": "shell_call_output",
                "call_id": call_id,
                "output": outputs
            })
            
        except Exception as e:
            print(f"❌ Error executing in cloud: {e}")
            tool_outputs.append({
                "type": "shell_call_output",
                "call_id": call_id,
                "output": [{
                    "stdout": "",
                    "stderr": str(e),
                    "outcome": {"type": "exit", "exit_code": 1}
                }]
            })
    
    return tool_outputs

if __name__ == '__main__':
    # Example usage
    print("Testing cloud execution via API...")
    
    test_commands = ['pwd', 'ls -la']
    result = execute_shell_commands_via_api(test_commands)
    
    print("\n✅ Result:")
    print(json.dumps(result, indent=2))
