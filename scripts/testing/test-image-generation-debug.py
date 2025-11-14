#!/usr/bin/env python3
"""
Debug Test: Image Generation URL Extraction
This test creates a workflow with image_generation tool and prints outputs at each stage
to debug image URL extraction issues.
"""

import sys
import os
import boto3
import json
import time
import re
import requests
from decimal import Decimal
from datetime import datetime

# Add backend/worker to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'worker'))

API_URL = os.environ.get('API_URL', 'http://localhost:3001')  # Backend API runs on port 3001
REGION = os.environ.get('AWS_REGION', 'us-east-1')

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
    table_name = os.environ.get('JOBS_TABLE', 'leadmagnet-jobs')
    table = dynamodb.Table(table_name)
    
    try:
        response = table.get_item(Key={"job_id": job_id})
        if "Item" in response:
            job = convert_decimals(response["Item"])
            
            # If execution_steps are stored in S3, fetch them
            execution_steps_s3_key = job.get('execution_steps_s3_key')
            if execution_steps_s3_key and not job.get('execution_steps'):
                try:
                    s3_client = boto3.client('s3', region_name=REGION)
                    bucket_name = os.environ.get('ARTIFACTS_BUCKET', 'leadmagnet-artifacts-471112574622')
                    
                    s3_response = s3_client.get_object(Bucket=bucket_name, Key=execution_steps_s3_key)
                    execution_steps_json = s3_response['Body'].read().decode('utf-8')
                    job['execution_steps'] = json.loads(execution_steps_json)
                    print(f"✓ Loaded {len(job['execution_steps'])} execution steps from S3")
                except Exception as e:
                    print(f"⚠️  Warning: Failed to load execution_steps from S3: {e}")
                    # Try using API endpoint as fallback
                    try:
                        tenant_id = os.environ.get('TENANT_ID', '84c8e438-0061-70f2-2ce0-7cb44989a329')
                        headers = {
                            'Content-Type': 'application/json',
                            'X-Tenant-ID': tenant_id
                        }
                        api_response = requests.get(
                            f"{API_URL}/admin/jobs/{job_id}/execution-steps",
                            headers=headers
                        )
                        if api_response.status_code == 200:
                            job['execution_steps'] = api_response.json()
                            print(f"✓ Loaded {len(job['execution_steps'])} execution steps via API")
                    except Exception as api_error:
                        print(f"⚠️  Warning: Failed to load execution_steps via API: {api_error}")
                        job['execution_steps'] = []
            
            return job
        return None
    except Exception as e:
        print(f"Error getting job status: {e}")
        return None

def print_section(title):
    """Print a formatted section header."""
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)

def print_stage_output(stage_name, data):
    """Print output from a specific stage."""
    print_section(f"Stage: {stage_name}")
    print(json.dumps(data, indent=2, default=str))

def analyze_execution_steps(job):
    """Analyze execution steps and print image URL extraction details."""
    execution_steps = job.get("execution_steps", [])
    
    print_section("Execution Steps Analysis")
    
    if not execution_steps:
        print("⚠️  No execution steps found!")
        return
    
    for idx, step in enumerate(execution_steps):
        step_name = step.get("step_name", f"Step {idx + 1}")
        step_type = step.get("step_type", "unknown")
        step_order = step.get("step_order", idx + 1)
        
        print(f"\n--- Step {step_order}: {step_name} ({step_type}) ---")
        
        # Check input (request_details) - execution steps store request_details as 'input'
        input_data = step.get("input", {})
        tools = input_data.get("tools", [])
        has_image_gen = any(
            (isinstance(t, dict) and t.get("type") == "image_generation") or 
            t == "image_generation" or
            (isinstance(t, str) and "image_generation" in t)
            for t in tools
        )
        
        print(f"  Has image_generation tool: {has_image_gen}")
        if tools:
            print(f"  Tools in input: {json.dumps(tools, indent=4, default=str)}")
        else:
            print("  ⚠️  No tools found in input")
        
        # Check tool_choice
        tool_choice = input_data.get("tool_choice", "auto")
        print(f"  Tool choice: {tool_choice}")
        
        # Check step-level image_urls (this is where they're stored)
        step_image_urls = step.get("image_urls", [])
        print(f"\n  Image URLs at step level: {len(step_image_urls)}")
        if step_image_urls:
            print("  Image URLs:")
            for url_idx, url in enumerate(step_image_urls):
                print(f"    {url_idx + 1}. {url}")
        else:
            print("  ⚠️  No image URLs found at step level")
        
        # Check output text
        output_text = step.get("output", "")
        print(f"\n  Output text length: {len(output_text)}")
        if output_text:
            print(f"  Output preview: {output_text[:200]}...")
            if "image" in output_text.lower() or "url" in output_text.lower():
                print("  ⚠️  Output text contains 'image' or 'url' - model may have described image instead of generating")
        
        # Check response_details if available
        response_details = step.get("response_details", {})
        if response_details:
            print(f"\n  Response details (debug info):")
            print(json.dumps(response_details, indent=4, default=str))
        
        # Print full step structure for debugging
        print(f"\n  Full step structure (keys): {list(step.keys())}")
        print(f"  Step summary:")
        print(json.dumps({
            "step_name": step_name,
            "step_type": step_type,
            "step_order": step_order,
            "model": step.get("model"),
            "has_image_urls": len(step_image_urls) > 0,
            "image_urls_count": len(step_image_urls),
            "input_tools": tools,
            "tool_choice": tool_choice,
            "output_length": len(output_text),
            "response_details_keys": list(response_details.keys()) if response_details else [],
            "usage_info": step.get("usage_info", {})
        }, indent=2, default=str))

def create_test_workflow_with_image_generation():
    """Create a test workflow with image_generation tool."""
    workflow_config = {
        "workflow_name": f"Debug Test - Image Generation {int(time.time())}",
        "workflow_description": "Test workflow for debugging image URL extraction",
        "steps": [
            {
                "step_name": "Generate Image",
                "step_order": 0,
                "step_description": "Generate an image using image_generation tool",
                "model": "gpt-5",
                "instructions": "Generate a simple logo image for a tech startup. Create a modern, minimalist design with blue and white colors.",
                "tools": [
                    {
                        "type": "image_generation"
                    }
                ],
                "tool_choice": "required"
            }
        ],
        "research_enabled": False,
        "html_enabled": False
    }
    
    return workflow_config

def create_workflow_via_api(workflow_config):
    """Create workflow via API."""
    print_section("Creating Workflow via API")
    
    try:
        # Get tenant_id from environment or use default
        tenant_id = os.environ.get('TENANT_ID', '84c8e438-0061-70f2-2ce0-7cb44989a329')
        
        headers = {
            'Content-Type': 'application/json',
            'X-Tenant-ID': tenant_id
        }
        
        response = requests.post(
            f"{API_URL}/admin/workflows",
            json=workflow_config,
            headers=headers
        )
        response.raise_for_status()
        
        workflow_data = response.json()
        workflow_id = workflow_data.get('workflow_id')
        form = workflow_data.get('form')
        
        print(f"✓ Created workflow: {workflow_id}")
        print(f"  Workflow name: {workflow_data.get('workflow_name')}")
        
        if form:
            form_slug = form.get('public_slug')
            form_id = form.get('form_id')
            print(f"✓ Form automatically created: {form_id}")
            print(f"  Form slug: {form_slug}")
            return workflow_id, form_slug, form_id
        else:
            print("⚠️  Warning: No form was created with workflow")
            return workflow_id, None, None
    except Exception as e:
        print(f"✗ Failed to create workflow: {e}")
        if hasattr(e, 'response'):
            print(f"  Response: {e.response.text}")
        return None, None, None

# Form is automatically created with workflow, so this function is no longer needed
# Keeping it commented out for reference

def submit_form(form_slug, submission_data):
    """Submit form to trigger job."""
    print_section("Submitting Form")
    
    try:
        # Form submission uses public route (/v1/forms/:slug/submit)
        response = requests.post(
            f"{API_URL}/v1/forms/{form_slug}/submit",
            json=submission_data
        )
        response.raise_for_status()
        
        result = response.json()
        job_id = result.get('job_id')
        
        print(f"✓ Form submitted")
        print(f"  Job ID: {job_id}")
        
        return job_id
    except Exception as e:
        print(f"✗ Failed to submit form: {e}")
        if hasattr(e, 'response'):
            print(f"  Response: {e.response.text}")
        return None

def monitor_job(job_id, max_wait_time=300):
    """Monitor job and print outputs at each stage."""
    print_section(f"Monitoring Job: {job_id}")
    
    start_time = time.time()
    last_status = None
    
    while time.time() - start_time < max_wait_time:
        job = get_job_status(job_id)
        
        if not job:
            print("⚠️  Job not found")
            time.sleep(2)
            continue
        
        status = job.get('status', 'unknown')
        
        if status != last_status:
            print(f"\n📊 Job status changed: {last_status} → {status}")
            last_status = status
        
        if status == 'completed':
            print("\n✅ Job completed!")
            print_stage_output("Final Job State", job)
            analyze_execution_steps(job)
            return job
        elif status == 'failed':
            print("\n❌ Job failed!")
            error_message = job.get('error_message', 'Unknown error')
            print(f"  Error: {error_message}")
            print_stage_output("Failed Job State", job)
            analyze_execution_steps(job)
            return job
        elif status == 'processing':
            print(".", end="", flush=True)
        else:
            print(".", end="", flush=True)
        
        time.sleep(2)
    
    print("\n⚠️  Job monitoring timed out")
    job = get_job_status(job_id)
    if job:
        print_stage_output("Timeout Job State", job)
        analyze_execution_steps(job)
    return job

def main():
    print("=" * 80)
    print("Debug Test: Image Generation URL Extraction")
    print("=" * 80)
    print()
    print("⚠️  Prerequisites:")
    print(f"  - Backend API server must be running on {API_URL}")
    print("  - AWS credentials configured for DynamoDB access")
    print("  - DynamoDB tables must exist")
    print()
    print("This test will:")
    print("  1. Create a workflow with image_generation tool")
    print("  2. Create a form for that workflow")
    print("  3. Submit the form to trigger job processing")
    print("  4. Monitor job execution and print outputs at each stage")
    print("  5. Analyze execution steps for image URL extraction")
    print()
    
    # Note: API connectivity will be checked when making the first request
    
    # Step 1: Create workflow
    workflow_config = create_test_workflow_with_image_generation()
    print_stage_output("Workflow Configuration", workflow_config)
    
    workflow_id, form_slug, form_id = create_workflow_via_api(workflow_config)
    if not workflow_id:
        print("✗ Failed to create workflow")
        return 1
    
    # Step 2: Get form (automatically created with workflow)
    if not form_slug:
        print("⚠️  No form found with workflow, attempting to fetch form...")
        # Try to get the workflow to fetch the form
        try:
            tenant_id = os.environ.get('TENANT_ID', '84c8e438-0061-70f2-2ce0-7cb44989a329')
            headers = {
                'Content-Type': 'application/json',
                'X-Tenant-ID': tenant_id
            }
            response = requests.get(
                f"{API_URL}/admin/workflows/{workflow_id}",
                headers=headers
            )
            response.raise_for_status()
            workflow_data = response.json()
            form = workflow_data.get('form')
            if form:
                form_slug = form.get('public_slug')
                form_id = form.get('form_id')
                print(f"✓ Retrieved form: {form_id}")
                print(f"  Form slug: {form_slug}")
            else:
                print("✗ Failed to get form for workflow")
                return 1
        except Exception as e:
            print(f"✗ Failed to get form: {e}")
            return 1
    
    # Step 3: Submit form
    # Forms automatically include name, email, and phone fields
    submission_data = {
        "submission_data": {
            "name": "Test User",
            "email": "test@example.com",
            "phone": "+1234567890",
            "company_name": "Test Company"
        }
    }
    
    job_id = submit_form(form_slug, submission_data)
    if not job_id:
        print("✗ Failed to submit form")
        return 1
    
    # Step 4: Monitor job
    final_job = monitor_job(job_id)
    
    # Step 5: Summary
    print_section("Summary")
    
    if final_job:
        status = final_job.get('status', 'unknown')
        execution_steps = final_job.get('execution_steps', [])
        
        print(f"Job Status: {status}")
        print(f"Execution Steps: {len(execution_steps)}")
        
        total_image_urls = 0
        for step in execution_steps:
            # Image URLs are stored at step level, not in response_details
            image_urls = step.get('image_urls', [])
            total_image_urls += len(image_urls)
        
        print(f"Total Image URLs Extracted: {total_image_urls}")
        
        if total_image_urls == 0:
            print("\n⚠️  WARNING: No image URLs were extracted!")
            print("   Check the logs above to see what happened at each stage.")
            print("\n   To see detailed backend logs:")
            print("   1. Check the backend API server console output")
            print("   2. Look for logs starting with '[OpenAI Client]'")
            print("   3. Look for logs starting with '[StepProcessor]'")
            print("   4. Look for logs starting with '[ImageArtifactService]'")
            print("   These logs will show:")
            print("     - Raw API response structure")
            print("     - Image URL extraction attempts")
            print("     - Why extraction might have failed")
        else:
            print(f"\n✅ Successfully extracted {total_image_urls} image URL(s)")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())

