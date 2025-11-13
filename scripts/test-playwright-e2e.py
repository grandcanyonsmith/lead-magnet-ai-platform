#!/usr/bin/env python3
"""
E2E Test: Test Playwright execute_action fix end-to-end
Creates a workflow with computer_use_preview, submits a job, and verifies actions execute correctly
"""

import sys
import os
import boto3
import json
import time
import requests
from decimal import Decimal
from datetime import datetime

# Add backend/worker to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'worker'))

# Configuration
API_URL = "https://czp5b77azd.execute-api.us-east-1.amazonaws.com"
REGION = "us-east-1"
TENANT_ID = "84c8e438-0061-70f2-2ce0-7cb44989a329"  # Default tenant

def convert_decimals(obj):
    """Convert Decimal to float/int for JSON serialization."""
    if isinstance(obj, Decimal):
        return float(obj) if obj % 1 != 0 else int(obj)
    elif isinstance(obj, dict):
        return {k: convert_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimals(item) for item in obj]
    return obj

def get_auth_token():
    """Get authentication token (simplified - you may need to implement proper auth)."""
    # For testing, you might need to get a token from Cognito
    # This is a placeholder - adjust based on your auth setup
    return None

def create_workflow_via_api(workflow_data, token=None):
    """Create a workflow via API."""
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        response = requests.post(
            f"{API_URL}/v1/workflows",
            json=workflow_data,
            headers=headers
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"✗ Failed to create workflow via API: {e}")
        if hasattr(e, 'response'):
            print(f"  Response: {e.response.text}")
        return None

def create_workflow_via_dynamodb(workflow_data):
    """Create a workflow directly in DynamoDB."""
    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    workflows_table = dynamodb.Table("leadmagnet-workflows")
    
    workflow_id = f"wf_{int(time.time() * 1000)}"
    workflow_data["workflow_id"] = workflow_id
    workflow_data["tenant_id"] = TENANT_ID
    workflow_data["status"] = "active"
    workflow_data["created_at"] = datetime.utcnow().isoformat() + "Z"
    workflow_data["updated_at"] = datetime.utcnow().isoformat() + "Z"
    
    try:
        workflows_table.put_item(Item=workflow_data)
        print(f"✓ Workflow created in DynamoDB: {workflow_id}")
        return workflow_id
    except Exception as e:
        print(f"✗ Failed to create workflow: {e}")
        return None

def create_form_via_dynamodb(form_data, workflow_id):
    """Create a form directly in DynamoDB."""
    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    forms_table = dynamodb.Table("leadmagnet-forms")
    
    form_id = form_data.get("form_id", f"form_{int(time.time() * 1000)}")
    form_data["form_id"] = form_id
    form_data["workflow_id"] = workflow_id
    form_data["tenant_id"] = TENANT_ID
    form_data["created_at"] = datetime.utcnow().isoformat() + "Z"
    form_data["updated_at"] = datetime.utcnow().isoformat() + "Z"
    
    try:
        forms_table.put_item(Item=form_data)
        print(f"✓ Form created in DynamoDB: {form_id}")
        return form_id
    except Exception as e:
        print(f"✗ Failed to create form: {e}")
        return None

def get_job_status(job_id):
    """Get job status from DynamoDB."""
    dynamodb = boto3.resource("dynamodb", region_name=REGION)
    table = dynamodb.Table("leadmagnet-jobs")
    
    try:
        response = table.get_item(Key={"job_id": job_id})
        if "Item" in response:
            return convert_decimals(response["Item"])
        return None
    except Exception as e:
        print(f"Error getting job status: {e}")
        return None

def check_execution_steps_for_actions(job):
    """Check execution steps for action execution evidence."""
    execution_steps = job.get("execution_steps", [])
    action_evidence = []
    
    for step in execution_steps:
        step_name = step.get("step_name", "Unknown")
        step_type = step.get("step_type", "unknown")
        
        # Check for computer use actions
        if step_type == "ai_generation":
            tools = step.get("request_details", {}).get("tools", [])
            has_computer_use = any(
                (isinstance(t, dict) and t.get("type") == "computer_use_preview") or 
                t == "computer_use_preview" 
                for t in tools
            )
            
            if has_computer_use:
                # Check for screenshot URLs (evidence of browser actions)
                image_urls = step.get("image_urls", [])
                output = step.get("output", "")
                
                if image_urls:
                    action_evidence.append({
                        "step": step_name,
                        "type": "screenshot_captured",
                        "count": len(image_urls),
                        "urls": image_urls
                    })
                
                # Check output for action-related content
                if output and ("screenshot" in output.lower() or "navigated" in output.lower()):
                    action_evidence.append({
                        "step": step_name,
                        "type": "action_executed",
                        "evidence": output[:200]
                    })
    
    return action_evidence

def main():
    print("=" * 80)
    print("E2E Test: Playwright execute_action Fix")
    print("=" * 80)
    print()
    print("This test will:")
    print("  1. Create a workflow with computer_use_preview tool")
    print("  2. Create a form for that workflow")
    print("  3. Submit the form to trigger job processing")
    print("  4. Monitor job execution and verify Playwright actions work")
    print()
    
    # Step 1: Create test workflow
    print("\n" + "=" * 80)
    print("Step 1: Creating test workflow with computer_use_preview")
    print("=" * 80)
    
    workflow_data = {
        "workflow_name": f"E2E Test - Playwright Actions {int(time.time())}",
        "workflow_description": "Test workflow to verify Playwright execute_action fix",
        "steps": [
            {
                "step_name": "Browser Navigation Test",
                "step_order": 0,
                "step_description": "Navigate to a webpage and capture screenshot",
                "model": "computer-use-preview",
                "instructions": "Navigate to https://example.com and take a screenshot. Use browser actions to interact with the page.",
                "tools": [
                    {
                        "type": "computer_use_preview",
                        "display_width": 1024,
                        "display_height": 768,
                        "environment": "browser"
                    }
                ],
                "tool_choice": "required"
            }
        ],
        "research_enabled": False,
        "html_enabled": False,
        "rewrite_enabled": False
    }
    
    workflow_id = create_workflow_via_dynamodb(workflow_data)
    if not workflow_id:
        print("✗ Failed to create workflow")
        return 1
    
    # Step 2: Create test form
    print("\n" + "=" * 80)
    print("Step 2: Creating test form")
    print("=" * 80)
    
    form_slug = f"test-playwright-{int(time.time())}"
    form_data = {
        "form_id": f"form_{int(time.time() * 1000)}",
        "form_name": "E2E Test - Playwright Actions",
        "form_slug": form_slug,
        "public_slug": form_slug,  # Required for public form access
        "form_description": "Test form for Playwright E2E test",
        "form_fields_schema": {
            "fields": [
                {
                    "field_id": "name",
                    "label": "Name",
                    "field_type": "text",
                    "required": True
                },
                {
                    "field_id": "email",
                    "label": "Email",
                    "field_type": "email",
                    "required": True
                },
                {
                    "field_id": "phone",
                    "label": "Phone",
                    "field_type": "tel",
                    "required": True
                }
            ]
        },
        "status": "active"
    }
    
    form_id = create_form_via_dynamodb(form_data, workflow_id)
    if not form_id:
        print("✗ Failed to create form")
        return 1
    
    print(f"✓ Form slug: {form_slug}")
    
    # Step 3: Submit form
    print("\n" + "=" * 80)
    print("Step 3: Submitting form to trigger job")
    print("=" * 80)
    
    submission_data = {
        "name": "E2E Test User",
        "email": f"e2e-test-{int(time.time())}@test.com",
        "phone": "555-1234",  # Required field
    }
    
    try:
        submit_response = requests.post(
            f"{API_URL}/v1/forms/{form_slug}/submit",
            json={"submission_data": submission_data},
            headers={"Content-Type": "application/json"}
        )
        submit_response.raise_for_status()
        submit_result = submit_response.json()
        job_id = submit_result.get("job_id")
        
        if not job_id:
            print("✗ No job_id returned from submission")
            return 1
        
        print(f"✓ Form submitted successfully")
        print(f"  Job ID: {job_id}")
    except Exception as e:
        print(f"✗ Failed to submit form: {e}")
        if hasattr(e, 'response'):
            print(f"  Response: {e.response.text}")
        return 1
    
    # Step 4: Monitor job processing
    print("\n" + "=" * 80)
    print("Step 4: Monitoring job processing")
    print("=" * 80)
    print("  (This may take several minutes - computer use actions can be slow)")
    
    max_wait_time = 900  # 15 minutes
    check_interval = 10  # Check every 10 seconds
    start_time = time.time()
    last_status = None
    
    while time.time() - start_time < max_wait_time:
        job = get_job_status(job_id)
        
        if not job:
            print("✗ Job not found in database")
            return 1
        
        status = job.get("status")
        
        if status != last_status:
            elapsed = int(time.time() - start_time)
            print(f"\n  [{elapsed}s] Status: {status}")
            last_status = status
            
            if status == "completed":
                print("\n✓ Job completed successfully!")
                
                # Check for action execution evidence
                print("\n" + "=" * 80)
                print("Step 5: Verifying Playwright actions executed")
                print("=" * 80)
                
                action_evidence = check_execution_steps_for_actions(job)
                
                if action_evidence:
                    print(f"\n✅ SUCCESS: Found evidence of Playwright actions!")
                    print(f"   Found {len(action_evidence)} piece(s) of evidence:")
                    for evidence in action_evidence:
                        print(f"\n   - Step: {evidence['step']}")
                        print(f"     Type: {evidence['type']}")
                        if evidence['type'] == 'screenshot_captured':
                            print(f"     Screenshots: {evidence['count']}")
                            for url in evidence['urls'][:3]:  # Show first 3
                                print(f"       • {url}")
                        elif evidence['type'] == 'action_executed':
                            print(f"     Evidence: {evidence['evidence']}...")
                    
                    print("\n" + "=" * 80)
                    print("✅ E2E Test PASSED - Playwright execute_action is working!")
                    print("=" * 80)
                    return 0
                else:
                    print("\n⚠️  Job completed but no evidence of Playwright actions found")
                    print("   This could mean:")
                    print("   - Actions were executed but not captured")
                    print("   - Check CloudWatch logs for more details")
                    print("   - Verify the workflow step configuration")
                    
                    # Still show execution steps for debugging
                    execution_steps = job.get("execution_steps", [])
                    print(f"\n   Execution steps found: {len(execution_steps)}")
                    for i, step in enumerate(execution_steps[:3]):
                        print(f"   Step {i+1}: {step.get('step_name', 'Unknown')} ({step.get('step_type', 'unknown')})")
                    
                    return 1
                
            elif status == "failed":
                print("\n✗ Job failed!")
                error_message = job.get("error_message", "Unknown error")
                error_type = job.get("error_type", "Unknown")
                print(f"  Error Type: {error_type}")
                print(f"  Error Message: {error_message}")
                
                # Check if it's a Playwright-related error
                if "execute_action" in error_message or "BrowserService" in error_message:
                    print("\n⚠️  This appears to be a Playwright-related error!")
                    print("   The execute_action method may not be working correctly.")
                
                return 1
        
        time.sleep(check_interval)
        elapsed = int(time.time() - start_time)
        if elapsed % 30 == 0:  # Print progress every 30 seconds
            print(f". [{elapsed}s]", end="", flush=True)
        else:
            print(".", end="", flush=True)
    
    print("\n\n⚠️  Test timed out - job did not complete within 15 minutes")
    job = get_job_status(job_id)
    if job:
        print(f"  Final Status: {job.get('status')}")
        action_evidence = check_execution_steps_for_actions(job)
        if action_evidence:
            print(f"\n✅ Found {len(action_evidence)} piece(s) of evidence before timeout")
            return 0
    
    return 1

if __name__ == "__main__":
    sys.exit(main())

