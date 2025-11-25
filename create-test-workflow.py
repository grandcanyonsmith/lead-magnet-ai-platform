#!/usr/bin/env python3
"""
Create a test workflow with webhook delivery via API.
Uses manual token input since programmatic auth is complex.
"""

import json
import requests
import sys

API_URL = "https://czp5b77azd.execute-api.us-east-1.amazonaws.com"
WEBHOOK_URL = "https://template-docs-grandcanyonsmit.replit.app/api/clients/generate-from-webhook"

print("🔧 Create Test Workflow with Webhook Delivery")
print("=" * 50)
print()
print("Since programmatic authentication is complex, please:")
print("1. Log in to https://dmydkyj79auy7.cloudfront.net")
print("2. Open browser DevTools (F12)")
print("3. Go to Application > Local Storage")
print("4. Find and copy your auth token (look for 'idToken' or 'authToken')")
print()

token = input("Paste your auth token here (or press Enter to skip): ").strip()

if not token:
    print("\n⚠️  No token provided. Creating workflow manually via curl command:")
    print()
    workflow_data = {
        "workflow_name": "Test Webhook Artifacts",
        "workflow_description": "Test workflow to verify artifacts in webhook",
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
    
    print("Run this command:")
    print()
    print(f"curl -X POST '{API_URL}/admin/workflows' \\")
    print("  -H 'Content-Type: application/json' \\")
    print(f"  -H 'Authorization: Bearer YOUR_TOKEN_HERE' \\")
    print(f"  -d '{json.dumps(workflow_data)}'")
    print()
    sys.exit(0)

# Create workflow
workflow_data = {
    "workflow_name": "Test Webhook Artifacts",
    "workflow_description": "Test workflow to verify artifacts in webhook",
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
    "Authorization": f"Bearer {token}",
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
        print("❌ Authentication failed. Token may be expired.")
        print("   Please get a fresh token from the browser.")
        sys.exit(1)
    
    response.raise_for_status()
    result = response.json()
    
    workflow_id = result.get('workflow_id') or result.get('body', {}).get('workflow_id')
    form_id = result.get('form_id') or result.get('body', {}).get('form_id')
    
    if not workflow_id:
        print(f"❌ Unexpected response format: {result}")
        sys.exit(1)
    
    print(f"✅ Workflow created!")
    print(f"   Workflow ID: {workflow_id}")
    print(f"   Form ID: {form_id}")
    
    # Get form slug
    if form_id:
        form_response = requests.get(
            f"{API_URL}/admin/forms/{form_id}",
            headers=headers,
            timeout=30
        )
        if form_response.status_code == 200:
            form_data = form_response.json()
            form_slug = form_data.get('public_slug') or form_data.get('body', {}).get('public_slug')
            if form_slug:
                print(f"   Form slug: {form_slug}")
                print()
                print("📤 Submit the form with:")
                print(f"   curl -X POST '{API_URL}/v1/forms/{form_slug}/submit' \\")
                print("     -H 'Content-Type: application/json' \\")
                print("     -d '{\"name\": \"Test\", \"email\": \"test@example.com\"}'")
    
except requests.exceptions.RequestException as e:
    print(f"❌ Request failed: {e}")
    if hasattr(e, 'response') and e.response is not None:
        print(f"   Status: {e.response.status_code}")
        print(f"   Response: {e.response.text[:200]}")
    sys.exit(1)

print("\n✅ Done! The workflow will send webhooks to:")
print(f"   {WEBHOOK_URL}")
print("\n   Verify that the webhook payload includes:")
print("   - artifacts (array)")
print("   - images (array)")
print("   - html_files (array)")
print("   - markdown_files (array)")

