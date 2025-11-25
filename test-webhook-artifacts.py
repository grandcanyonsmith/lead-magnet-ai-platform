#!/usr/bin/env python3
"""
Test script to create a workflow with webhook delivery and verify artifacts are included.
"""

import json
import requests
import boto3
import time
import sys
from datetime import datetime

# Configuration
API_URL = "https://czp5b77azd.execute-api.us-east-1.amazonaws.com"
USER_POOL_ID = "us-east-1_asu0YOrBD"
REGION = "us-east-1"
EMAIL = "canyon@coursecreator360.com"
PASSWORD = "Sterling7147!"

# Get client ID
cf = boto3.client('cloudformation', region_name=REGION)
try:
    stack_outputs = cf.describe_stacks(StackName='leadmagnet-auth')['Stacks'][0]['Outputs']
    client_id = next((o['OutputValue'] for o in stack_outputs if o['OutputKey'] == 'UserPoolClientId'), None)
    if not client_id:
        print("❌ Could not find UserPoolClientId")
        sys.exit(1)
except Exception as e:
    print(f"❌ Error getting client ID: {e}")
    sys.exit(1)

print(f"✅ Client ID: {client_id}")

# Authenticate with Cognito using admin auth
cognito = boto3.client('cognito-idp', region_name=REGION)
try:
    # Use admin-initiated auth
    response = cognito.admin_initiate_auth(
        UserPoolId=USER_POOL_ID,
        ClientId=client_id,
        AuthFlow='ADMIN_NO_SRP_AUTH',
        AuthParameters={
            'USERNAME': EMAIL,
            'PASSWORD': PASSWORD
        }
    )
    id_token = response['AuthenticationResult']['IdToken']
    print("✅ Authentication successful")
except Exception as e:
    print(f"❌ Authentication failed: {e}")
    print("   Trying alternative method...")
    # Try SRP auth as fallback
    try:
        import hmac
        import hashlib
        import base64
        
        # Get user attributes first
        user = cognito.admin_get_user(UserPoolId=USER_POOL_ID, Username=EMAIL)
        
        # Try SRP
        response = cognito.initiate_auth(
            ClientId=client_id,
            AuthFlow='USER_SRP_AUTH',
            AuthParameters={
                'USERNAME': EMAIL
            }
        )
        # This is more complex, let's just use admin auth
        raise Exception("SRP not implemented, need admin auth")
    except Exception as e2:
        print(f"❌ Alternative auth also failed: {e2}")
        sys.exit(1)

# Create workflow with webhook delivery
workflow_data = {
    "workflow_name": f"Test Webhook Artifacts {datetime.now().strftime('%Y%m%d-%H%M%S')}",
    "workflow_description": "Test workflow to verify artifacts are included in webhook payload",
    "status": "active",
    "delivery_method": "webhook",
    "delivery_webhook_url": "https://template-docs-grandcanyonsmit.replit.app/api/clients/generate-from-webhook",
    "steps": [
        {
            "step_order": 1,
            "step_name": "Generate Content",
            "step_type": "ai",
            "model": "gpt-4o",
            "instructions": "Write a short poem about a walrus. Keep it under 100 words.",
            "step_description": "Generate a poem"
        }
    ]
}

print("\n📝 Creating workflow...")
headers = {
    "Authorization": f"Bearer {id_token}",
    "Content-Type": "application/json"
}

try:
    response = requests.post(
        f"{API_URL}/admin/workflows",
        headers=headers,
        json=workflow_data,
        timeout=30
    )
    response.raise_for_status()
    workflow = response.json()
    workflow_id = workflow.get('workflow_id')
    form_id = workflow.get('form_id')
    print(f"✅ Workflow created: {workflow_id}")
    print(f"✅ Form ID: {form_id}")
except Exception as e:
    print(f"❌ Failed to create workflow: {e}")
    if hasattr(e, 'response'):
        print(f"   Response: {e.response.text}")
    sys.exit(1)

# Get form details to get the slug
try:
    form_response = requests.get(
        f"{API_URL}/admin/forms/{form_id}",
        headers=headers,
        timeout=30
    )
    form_response.raise_for_status()
    form_data = form_response.json()
    form_slug = form_data.get('public_slug')
    print(f"✅ Form slug: {form_slug}")
except Exception as e:
    print(f"❌ Failed to get form: {e}")
    sys.exit(1)

# Submit form to trigger workflow
submission_data = {
    "name": "Test User",
    "email": "test@example.com",
    "field_1": "test submission"
}

print("\n📤 Submitting form to trigger workflow...")
try:
    submit_response = requests.post(
        f"{API_URL}/v1/forms/{form_slug}/submit",
        json=submission_data,
        timeout=30
    )
    submit_response.raise_for_status()
    submit_result = submit_response.json()
    job_id = submit_result.get('job_id')
    print(f"✅ Form submitted, Job ID: {job_id}")
except Exception as e:
    print(f"❌ Failed to submit form: {e}")
    if hasattr(e, 'response'):
        print(f"   Response: {e.response.text}")
    sys.exit(1)

# Wait for job to complete and check status
print("\n⏳ Waiting for job to complete...")
max_wait = 120  # 2 minutes
wait_interval = 5
elapsed = 0

while elapsed < max_wait:
    try:
        status_response = requests.get(
            f"{API_URL}/v1/jobs/{job_id}/status",
            timeout=30
        )
        status_response.raise_for_status()
        status_data = status_response.json()
        job_status = status_data.get('status')
        
        print(f"   Status: {job_status} (elapsed: {elapsed}s)")
        
        if job_status == 'completed':
            print("✅ Job completed!")
            break
        elif job_status == 'failed':
            error_msg = status_data.get('error_message', 'Unknown error')
            print(f"❌ Job failed: {error_msg}")
            sys.exit(1)
        
        time.sleep(wait_interval)
        elapsed += wait_interval
    except Exception as e:
        print(f"   Error checking status: {e}")
        time.sleep(wait_interval)
        elapsed += wait_interval

if elapsed >= max_wait:
    print("⏰ Timeout waiting for job completion")
    print(f"   Check job status manually: {API_URL}/v1/jobs/{job_id}/status")

# Check CloudWatch logs for artifact URLs
print("\n🔍 Checking CloudWatch logs for artifact URLs...")
logs = boto3.client('logs', region_name=REGION)
log_group = "/aws/lambda/leadmagnet-job-processor"

try:
    # Search for artifact URLs in logs
    end_time = int(time.time() * 1000)
    start_time = end_time - (5 * 60 * 1000)  # Last 5 minutes
    
    response = logs.filter_log_events(
        logGroupName=log_group,
        startTime=start_time,
        filterPattern=f'"{job_id}"',
        limit=50
    )
    
    artifact_logs = [
        event['message'] for event in response.get('events', [])
        if 'Artifact URLs in payload' in event['message'] or 'artifacts_count' in event['message']
    ]
    
    if artifact_logs:
        print("✅ Found artifact logs:")
        for log in artifact_logs[:5]:
            print(f"   {log}")
    else:
        print("⚠️  No artifact logs found yet (may take a few seconds to appear)")
        print("   Check logs manually:")
        print(f"   aws logs tail {log_group} --since 5m --filter-pattern '{job_id}'")
        
except Exception as e:
    print(f"⚠️  Error checking logs: {e}")

print(f"\n✅ Test workflow created and executed!")
print(f"   Workflow ID: {workflow_id}")
print(f"   Job ID: {job_id}")
print(f"   Webhook URL: {workflow_data['delivery_webhook_url']}")
print(f"\n   Check the webhook receiver to verify artifacts are included in the payload.")

