#!/usr/bin/env python3
"""
E2E Test: Submit a form and monitor job processing to completion
"""

import boto3
import json
import time
import requests
from decimal import Decimal
from datetime import datetime

API_URL = "https://czp5b77azd.execute-api.us-east-1.amazonaws.com"
FORM_SLUG = "brand-style-guide-request"  # From the workflow we imported
REGION = "us-east-1"

def convert_decimals(obj):
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

def check_step_functions_execution(job_id):
    """Check Step Functions execution status."""
    sfn_client = boto3.client("stepfunctions", region_name=REGION)
    
    try:
        # List recent executions
        response = sfn_client.list_executions(
            stateMachineArn="arn:aws:states:us-east-1:471112574622:stateMachine:leadmagnet-job-processor",
            maxResults=5
        )
        
        executions = response.get("executions", [])
        for exec in executions:
            # Check if execution name contains job_id (Step Functions uses execution name)
            exec_detail = sfn_client.describe_execution(executionArn=exec["executionArn"])
            input_data = json.loads(exec_detail.get("input", "{}"))
            
            if input_data.get("job_id") == job_id:
                return {
                    "status": exec["status"],
                    "startDate": exec["startDate"].isoformat() if exec.get("startDate") else None,
                    "stopDate": exec["stopDate"].isoformat() if exec.get("stopDate") else None,
                    "error": exec_detail.get("error"),
                    "cause": exec_detail.get("cause"),
                }
        return None
    except Exception as e:
        print(f"Error checking Step Functions: {e}")
        return None

def main():
    print("=" * 80)
    print("E2E Test: Form Submission and Job Processing")
    print("=" * 80)
    print(f"Form Slug: {FORM_SLUG}")
    print(f"API URL: {API_URL}")
    print()
    
    # Step 1: Get form schema
    print("Step 1: Getting form schema...")
    try:
        form_response = requests.get(f"{API_URL}/v1/forms/{FORM_SLUG}")
        form_response.raise_for_status()
        form_data = form_response.json()
        print(f"✓ Form found: {form_data.get('form_name')}")
        print(f"  Form ID: {form_data.get('form_id')}")
        print(f"  Workflow ID: {form_data.get('workflow_id')}")
    except Exception as e:
        print(f"✗ Failed to get form: {e}")
        return
    
    # Step 2: Submit form
    print("\nStep 2: Submitting form...")
    submission_data = {
        "name": "E2E Test User",
        "email": f"e2e-test-{int(time.time())}@test.com",
        "phone": "+14155559999",
    }
    
    # Add form-specific fields if needed
    fields = form_data.get("form_fields_schema", {}).get("fields", [])
    for field in fields:
        field_id = field.get("field_id")
        if field_id and field_id not in submission_data:
            if field.get("field_type") == "textarea":
                submission_data[field_id] = "Test submission for E2E testing"
            elif field.get("field_type") == "text":
                submission_data[field_id] = "Test Value"
            elif field.get("field_type") == "select" and field.get("options"):
                submission_data[field_id] = field["options"][0]
    
    try:
        submit_response = requests.post(
            f"{API_URL}/v1/forms/{FORM_SLUG}/submit",
            json={"submission_data": submission_data},
            headers={"Content-Type": "application/json"}
        )
        submit_response.raise_for_status()
        submit_result = submit_response.json()
        job_id = submit_result.get("job_id")
        
        if not job_id:
            print("✗ No job_id returned from submission")
            return
        
        print(f"✓ Form submitted successfully")
        print(f"  Job ID: {job_id}")
    except Exception as e:
        print(f"✗ Failed to submit form: {e}")
        if hasattr(e, 'response'):
            print(f"  Response: {e.response.text}")
        return
    
    # Step 3: Monitor job processing
    print("\nStep 3: Monitoring job processing...")
    print("  (This may take a few minutes)")
    
    max_wait_time = 600  # 10 minutes
    check_interval = 5  # Check every 5 seconds
    start_time = time.time()
    last_status = None
    
    while time.time() - start_time < max_wait_time:
        job = get_job_status(job_id)
        
        if not job:
            print("✗ Job not found in database")
            return
        
        status = job.get("status")
        
        if status != last_status:
            print(f"\n  Status changed: {last_status} → {status}")
            last_status = status
            
            if status == "completed":
                print("\n✓ Job completed successfully!")
                
                # Check for output URL
                output_url = job.get("output_url")
                if output_url:
                    print(f"  Output URL: {output_url}")
                else:
                    print("  ⚠️  No output URL found")
                
                # Check artifacts
                artifacts = job.get("artifacts", [])
                if artifacts:
                    print(f"  Artifacts: {len(artifacts)}")
                    for artifact_id in artifacts:
                        print(f"    - {artifact_id}")
                
                # Check execution steps
                execution_steps = job.get("execution_steps", [])
                if execution_steps:
                    print(f"  Execution Steps: {len(execution_steps)}")
                    for i, step in enumerate(execution_steps, 1):
                        step_type = step.get("step_type", "unknown")
                        step_name = step.get("step_name", f"Step {i}")
                        print(f"    {i}. {step_name} ({step_type})")
                
                # Check Step Functions execution
                sfn_status = check_step_functions_execution(job_id)
                if sfn_status:
                    print(f"\n  Step Functions Status: {sfn_status['status']}")
                    if sfn_status.get("error"):
                        print(f"    Error: {sfn_status['error']}")
                
                print("\n" + "=" * 80)
                print("✓ E2E Test PASSED")
                print("=" * 80)
                return
                
            elif status == "failed":
                print("\n✗ Job failed!")
                error_message = job.get("error_message")
                error_type = job.get("error_type")
                print(f"  Error Type: {error_type}")
                print(f"  Error Message: {error_message}")
                
                # Check Step Functions execution
                sfn_status = check_step_functions_execution(job_id)
                if sfn_status:
                    print(f"\n  Step Functions Status: {sfn_status['status']}")
                    if sfn_status.get("error"):
                        print(f"    Error: {sfn_status['error']}")
                    if sfn_status.get("cause"):
                        print(f"    Cause: {sfn_status['cause'][:500]}")
                
                print("\n" + "=" * 80)
                print("✗ E2E Test FAILED")
                print("=" * 80)
                return
        
        time.sleep(check_interval)
        print(".", end="", flush=True)
    
    print("\n\n⚠️  Test timed out - job did not complete within 10 minutes")
    job = get_job_status(job_id)
    if job:
        print(f"  Final Status: {job.get('status')}")
        print(f"  Error: {job.get('error_message')}")

if __name__ == "__main__":
    main()

