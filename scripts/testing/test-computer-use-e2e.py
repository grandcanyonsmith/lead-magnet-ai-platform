#!/usr/bin/env python3
"""
E2E Test: Test computer_use_preview screenshot extraction in a real workflow
This test creates a workflow with computer_use_preview tool and verifies screenshots are extracted
"""

import sys
import os
import boto3
import json
import time
import requests
from decimal import Decimal

# Add backend/worker to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'worker'))

API_URL = "https://czp5b77azd.execute-api.us-east-1.amazonaws.com"
REGION = "us-east-1"

def convert_decimals(obj):
    """Convert Decimal to float/int for JSON serialization."""
    if isinstance(obj, Decimal):
        return float(obj) if obj % 1 != 0 else int(obj)
    elif isinstance(obj, dict):
        return {k: convert_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimals(item) for item in obj]
    return obj

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

def check_for_image_urls_in_execution_steps(job):
    """Check if image URLs are present in execution steps."""
    execution_steps = job.get("execution_steps", [])
    image_urls_found = []
    
    for step in execution_steps:
        step_name = step.get("step_name", "Unknown")
        image_urls = step.get("image_urls", [])
        
        if image_urls:
            print(f"  ✓ Found {len(image_urls)} image URL(s) in step: {step_name}")
            for url in image_urls:
                print(f"    - {url}")
                image_urls_found.append(url)
        else:
            step_type = step.get("step_type", "unknown")
            tools = step.get("request_details", {}).get("tools", [])
            has_computer_use = any(
                (isinstance(t, dict) and t.get("type") == "computer_use_preview") or 
                t == "computer_use_preview" 
                for t in tools
            )
            
            if has_computer_use and step_type == "ai_generation":
                print(f"  ⚠️  Step '{step_name}' uses computer_use_preview but no image URLs found")
    
    return image_urls_found

def create_test_workflow_with_computer_use():
    """Create a test workflow with computer_use_preview tool."""
    # This would typically be done via the API, but for testing we'll document what's needed
    workflow_config = {
        "workflow_name": "E2E Test - Computer Use Screenshot",
        "workflow_description": "Test workflow for computer_use_preview screenshot extraction",
        "steps": [
            {
                "step_name": "Take Screenshot",
                "step_order": 0,
                "model": "computer-use-preview",
                "instructions": "Take a screenshot of a simple webpage. Navigate to example.com and capture a screenshot.",
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
        ]
    }
    
    return workflow_config

def main():
    print("=" * 80)
    print("E2E Test: Computer Use Preview Screenshot Extraction")
    print("=" * 80)
    print()
    print("This test verifies that screenshots from computer_use_preview tool")
    print("are properly extracted and stored as image URLs in execution steps.")
    print()
    print("⚠️  Note: This test requires:")
    print("   1. A workflow with computer_use_preview tool configured")
    print("   2. A form associated with that workflow")
    print("   3. OpenAI API access with computer-use-preview model")
    print()
    
    # Check if workflow/form slug is provided
    if len(sys.argv) > 1:
        form_slug = sys.argv[1]
    else:
        print("Usage: python test-computer-use-e2e.py <form_slug>")
        print()
        print("Example:")
        print("  python test-computer-use-e2e.py test-form")
        print()
        print("Or provide a form slug that uses computer_use_preview:")
        form_slug = input("Enter form slug (or press Enter to skip): ").strip()
        if not form_slug:
            print("\n⚠️  Skipping E2E test. Run unit tests instead:")
            print("   python scripts/test-computer-use-screenshot-extraction.py")
            return 0
    
    print(f"\n📋 Testing with form: {form_slug}")
    print("-" * 80)
    
    # Step 1: Get form schema
    print("\nStep 1: Getting form schema...")
    try:
        form_response = requests.get(f"{API_URL}/v1/forms/{form_slug}")
        form_response.raise_for_status()
        form_data = form_response.json()
        print(f"✓ Form found: {form_data.get('form_name')}")
        print(f"  Form ID: {form_data.get('form_id')}")
        print(f"  Workflow ID: {form_data.get('workflow_id')}")
        
        # Check if workflow uses computer_use_preview
        workflow_id = form_data.get('workflow_id')
        if not workflow_id:
            print("⚠️  Form has no workflow_id")
            return 1
        
    except Exception as e:
        print(f"✗ Failed to get form: {e}")
        return 1
    
    # Step 2: Check workflow configuration
    print("\nStep 2: Checking workflow configuration...")
    try:
        dynamodb = boto3.resource("dynamodb", region_name=REGION)
        workflows_table = dynamodb.Table("leadmagnet-workflows")
        workflow_item = workflows_table.get_item(Key={"workflow_id": workflow_id})
        
        if "Item" not in workflow_item:
            print(f"✗ Workflow {workflow_id} not found")
            return 1
        
        workflow = convert_decimals(workflow_item["Item"])
        steps = workflow.get("steps", [])
        
        has_computer_use = False
        for step in steps:
            tools = step.get("tools", [])
            for tool in tools:
                tool_type = tool.get("type") if isinstance(tool, dict) else tool
                if tool_type == "computer_use_preview":
                    has_computer_use = True
                    print(f"✓ Found computer_use_preview in step: {step.get('step_name')}")
                    break
        
        if not has_computer_use:
            print("⚠️  Workflow does not use computer_use_preview tool")
            print("   This test requires a workflow with computer_use_preview configured")
            return 1
        
    except Exception as e:
        print(f"✗ Failed to check workflow: {e}")
        return 1
    
    # Step 3: Submit form
    print("\nStep 3: Submitting form...")
    submission_data = {
        "name": "E2E Test User",
        "email": f"e2e-test-{int(time.time())}@test.com",
    }
    
    # Add form-specific fields
    fields = form_data.get("form_fields_schema", {}).get("fields", [])
    for field in fields:
        field_id = field.get("field_id")
        if field_id and field_id not in submission_data:
            if field.get("field_type") == "textarea":
                submission_data[field_id] = "Test submission for screenshot extraction E2E test"
            elif field.get("field_type") == "text":
                submission_data[field_id] = "Test Value"
    
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
    print("\nStep 4: Monitoring job processing...")
    print("  (This may take several minutes)")
    
    max_wait_time = 600  # 10 minutes
    check_interval = 5  # Check every 5 seconds
    start_time = time.time()
    last_status = None
    
    while time.time() - start_time < max_wait_time:
        job = get_job_status(job_id)
        
        if not job:
            print("✗ Job not found in database")
            return 1
        
        status = job.get("status")
        
        if status != last_status:
            print(f"\n  Status: {status}")
            last_status = status
            
            if status == "completed":
                print("\n✓ Job completed successfully!")
                
                # Check for image URLs in execution steps
                print("\nStep 5: Checking for screenshot URLs in execution steps...")
                image_urls = check_for_image_urls_in_execution_steps(job)
                
                if image_urls:
                    print(f"\n✅ SUCCESS: Found {len(image_urls)} screenshot URL(s)")
                    print("\n" + "=" * 80)
                    print("✓ E2E Test PASSED")
                    print("=" * 80)
                    print("\nScreenshot URLs were successfully extracted and stored:")
                    for url in image_urls:
                        print(f"  - {url}")
                    return 0
                else:
                    print("\n⚠️  Job completed but no screenshot URLs found")
                    print("   This could mean:")
                    print("   - The computer_use_preview tool didn't capture screenshots")
                    print("   - Screenshots were captured but not extracted properly")
                    print("   - Check CloudWatch logs for more details")
                    return 1
                
            elif status == "failed":
                print("\n✗ Job failed!")
                error_message = job.get("error_message")
                error_type = job.get("error_type")
                print(f"  Error Type: {error_type}")
                print(f"  Error Message: {error_message}")
                return 1
        
        time.sleep(check_interval)
        print(".", end="", flush=True)
    
    print("\n\n⚠️  Test timed out - job did not complete within 10 minutes")
    job = get_job_status(job_id)
    if job:
        print(f"  Final Status: {job.get('status')}")
        # Still check for image URLs even if not completed
        image_urls = check_for_image_urls_in_execution_steps(job)
        if image_urls:
            print(f"\n✅ Found {len(image_urls)} screenshot URL(s) before timeout")
            return 0
    
    return 1

if __name__ == "__main__":
    sys.exit(main())

