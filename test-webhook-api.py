#!/usr/bin/env python3
"""
Test webhook artifacts by creating a workflow and submitting a form.
Uses AWS SDK to authenticate via Cognito.
"""

import json
import requests
import boto3
import time
import sys
try:
    from warrant.aws_srp import AWSSRP
except ImportError:
    try:
        from warrant_lite import AWSSRP
    except ImportError:
        AWSSRP = None

# Configuration
API_URL = "https://czp5b77azd.execute-api.us-east-1.amazonaws.com"
WEBHOOK_URL = "https://template-docs-grandcanyonsmit.replit.app/api/clients/generate-from-webhook"
USER_POOL_ID = "us-east-1_asu0YOrBD"
CLIENT_ID = "4lb3j8kqfvfgkvfeb4h4naani5"
REGION = "us-east-1"
EMAIL = "canyon@coursecreator360.com"
PASSWORD = "Sterling7147!"

print("🔐 Authenticating with Cognito...")
id_token = None

# Try SRP auth if available
if AWSSRP:
    try:
        aws = AWSSRP(username=EMAIL, password=PASSWORD, pool_id=USER_POOL_ID, client_id=CLIENT_ID, client=boto3.client('cognito-idp', region_name=REGION))
        tokens = aws.authenticate_user()
        id_token = tokens['AuthenticationResult']['IdToken']
        print("✅ Authentication successful (SRP)")
    except Exception as e:
        print(f"⚠️  SRP auth failed: {e}")

# Try admin auth as fallback
if not id_token:
    try:
        cognito = boto3.client('cognito-idp', region_name=REGION)
        response = cognito.admin_initiate_auth(
            UserPoolId=USER_POOL_ID,
            ClientId=CLIENT_ID,
            AuthFlow='ADMIN_NO_SRP_AUTH',
            AuthParameters={
                'USERNAME': EMAIL,
                'PASSWORD': PASSWORD
            }
        )
        id_token = response['AuthenticationResult']['IdToken']
        print("✅ Authentication successful (admin auth)")
    except Exception as e:
        print(f"❌ Admin auth failed: {e}")
        print("\n⚠️  Could not authenticate programmatically.")
        print("   Please get a token manually:")
        print("   1. Log in to https://dmydkyj79auy7.cloudfront.net")
        print("   2. Open DevTools > Application > Local Storage")
        print("   3. Find 'CognitoIdentityServiceProvider.*.idToken'")
        print("   4. Copy the token value")
        print("\n   Then run:")
        print(f"   TOKEN=your_token python3 -c \"")
        print(f"   import sys; sys.path.insert(0, '.'); ")
        print(f"   from test_webhook_manual import create_workflow; ")
        print(f"   create_workflow('your_token')\"")
        sys.exit(1)

# Create workflow
workflow_data = {
    "workflow_name": f"Test Webhook Artifacts {int(time.time())}",
    "workflow_description": "Test workflow to verify artifacts are included in webhook payload",
    "status": "active",
    "delivery_method": "webhook",
    "delivery_webhook_url": WEBHOOK_URL,
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
    
    if response.status_code == 401:
        print("❌ Authentication failed. Token may be expired or invalid.")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text[:200]}")
        sys.exit(1)
    
    response.raise_for_status()
    result = response.json()
    
    # Handle nested body structure
    if 'body' in result and isinstance(result['body'], str):
        result = json.loads(result['body'])
    elif 'body' in result:
        result = result['body']
    
    workflow_id = result.get('workflow_id')
    form_id = result.get('form_id')
    
    if not workflow_id:
        print(f"❌ Unexpected response format: {json.dumps(result, indent=2)}")
        sys.exit(1)
    
    print(f"✅ Workflow created: {workflow_id}")
    print(f"✅ Form ID: {form_id}")
    
except requests.exceptions.RequestException as e:
    print(f"❌ Request failed: {e}")
    if hasattr(e, 'response') and e.response is not None:
        print(f"   Status: {e.response.status_code}")
        print(f"   Response: {e.response.text[:500]}")
    sys.exit(1)

# Get form details
print("\n📋 Getting form details...")
try:
    form_response = requests.get(
        f"{API_URL}/admin/forms/{form_id}",
        headers=headers,
        timeout=30
    )
    form_response.raise_for_status()
    form_result = form_response.json()
    
    if 'body' in form_result and isinstance(form_result['body'], str):
        form_result = json.loads(form_result['body'])
    elif 'body' in form_result:
        form_result = form_result['body']
    
    form_slug = form_result.get('public_slug')
    if not form_slug:
        print(f"⚠️  Could not get form slug from: {json.dumps(form_result, indent=2)}")
        sys.exit(1)
    
    print(f"✅ Form slug: {form_slug}")
    
except Exception as e:
    print(f"❌ Failed to get form: {e}")
    sys.exit(1)

# Submit form
print("\n📤 Submitting form to trigger workflow...")
submission_data = {
    "name": "Test User",
    "email": "test@example.com",
    "message": "Test webhook artifacts"
}

try:
    submit_response = requests.post(
        f"{API_URL}/v1/forms/{form_slug}/submit",
        json=submission_data,
        timeout=30
    )
    submit_response.raise_for_status()
    submit_result = submit_response.json()
    
    job_id = submit_result.get('job_id')
    if not job_id:
        print(f"❌ No job_id in response: {json.dumps(submit_result, indent=2)}")
        sys.exit(1)
    
    print(f"✅ Form submitted, Job ID: {job_id}")
    
except Exception as e:
    print(f"❌ Failed to submit form: {e}")
    if hasattr(e, 'response') and e.response is not None:
        print(f"   Response: {e.response.text[:500]}")
    sys.exit(1)

# Wait for job completion
print("\n⏳ Waiting for job to complete...")
max_wait = 120
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
    print(f"   Check manually: {API_URL}/v1/jobs/{job_id}/status")

# Check CloudWatch logs
print("\n🔍 Checking CloudWatch logs for artifact URLs...")
logs = boto3.client('logs', region_name=REGION)
log_group = "/aws/lambda/leadmagnet-job-processor"

try:
    end_time = int(time.time() * 1000)
    start_time = end_time - (10 * 60 * 1000)  # Last 10 minutes
    
    response = logs.filter_log_events(
        logGroupName=log_group,
        startTime=start_time,
        filterPattern=f'"{job_id}"',
        limit=100
    )
    
    artifact_logs = [
        event['message'] for event in response.get('events', [])
        if 'Artifact URLs in payload' in event['message'] or 'artifacts_count' in event['message'] or 'DeliveryService' in event['message']
    ]
    
    if artifact_logs:
        print("✅ Found artifact-related logs:")
        for log in artifact_logs[:10]:
            print(f"   {log[:200]}")
    else:
        print("⚠️  No artifact logs found yet")
        print("   Checking all logs for this job...")
        all_logs = [e['message'] for e in response.get('events', [])]
        delivery_logs = [log for log in all_logs if 'DeliveryService' in log or 'webhook' in log.lower()]
        if delivery_logs:
            print("   Found delivery/webhook logs:")
            for log in delivery_logs[:5]:
                print(f"   {log[:200]}")
        
except Exception as e:
    print(f"⚠️  Error checking logs: {e}")

print(f"\n✅ Test complete!")
print(f"   Workflow ID: {workflow_id}")
print(f"   Job ID: {job_id}")
print(f"   Webhook URL: {WEBHOOK_URL}")
print(f"\n   Check the webhook receiver to verify artifacts are included:")
print(f"   - artifacts array")
print(f"   - images array")
print(f"   - html_files array")
print(f"   - markdown_files array")

