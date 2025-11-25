#!/bin/bash
# Instructions to create and test workflow with webhook artifacts

API_URL="https://czp5b77azd.execute-api.us-east-1.amazonaws.com"
WEBHOOK_URL="https://template-docs-grandcanyonsmit.replit.app/api/clients/generate-from-webhook"

echo "📋 Instructions to Create and Test Workflow"
echo "==========================================="
echo ""
echo "Step 1: Get your auth token"
echo "----------------------------"
echo "1. Log in to https://dmydkyj79auy7.cloudfront.net"
echo "2. Open DevTools (F12) > Application > Local Storage"
echo "3. Find 'CognitoIdentityServiceProvider.*.idToken'"
echo "4. Copy the token value"
echo ""
read -p "Paste your token: " TOKEN
echo ""

echo "Step 2: Create workflow"
echo "-----------------------"
WORKFLOW_JSON='{
  "workflow_name": "Test Webhook Artifacts",
  "workflow_description": "Test artifacts in webhook payload",
  "status": "active",
  "delivery_method": "webhook",
  "delivery_webhook_url": "'$WEBHOOK_URL'",
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
}'

RESPONSE=$(curl -s -X POST "$API_URL/admin/workflows" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$WORKFLOW_JSON")

WORKFLOW_ID=$(echo "$RESPONSE" | jq -r '.workflow_id // .body.workflow_id // empty')
FORM_ID=$(echo "$RESPONSE" | jq -r '.form_id // .body.form_id // empty')

if [ -z "$WORKFLOW_ID" ]; then
    echo "❌ Failed to create workflow"
    echo "Response: $RESPONSE"
    exit 1
fi

echo "✅ Workflow created: $WORKFLOW_ID"
echo "✅ Form ID: $FORM_ID"
echo ""

# Get form slug
FORM_RESPONSE=$(curl -s -X GET "$API_URL/admin/forms/$FORM_ID" \
  -H "Authorization: Bearer $TOKEN")
FORM_SLUG=$(echo "$FORM_RESPONSE" | jq -r '.public_slug // .body.public_slug // empty')

echo "Step 3: Submit form"
echo "-------------------"
echo "Form slug: $FORM_SLUG"
echo ""

SUBMIT_RESPONSE=$(curl -s -X POST "$API_URL/v1/forms/$FORM_SLUG/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "message": "Test webhook artifacts"
  }')

JOB_ID=$(echo "$SUBMIT_RESPONSE" | jq -r '.job_id // empty')

if [ -z "$JOB_ID" ]; then
    echo "❌ Failed to submit form"
    echo "Response: $SUBMIT_RESPONSE"
    exit 1
fi

echo "✅ Job created: $JOB_ID"
echo ""

echo "Step 4: Wait for completion and check logs"
echo "------------------------------------------"
echo "Waiting for job to complete..."
for i in {1..24}; do
    sleep 5
    STATUS=$(curl -s "$API_URL/v1/jobs/$JOB_ID/status" | jq -r '.status // empty')
    echo "   [$i/24] Status: $STATUS"
    [ "$STATUS" = "completed" ] && break
    [ "$STATUS" = "failed" ] && echo "❌ Job failed" && exit 1
done

echo ""
echo "Step 5: Check CloudWatch logs"
echo "-----------------------------"
aws logs tail /aws/lambda/leadmagnet-job-processor \
  --region us-east-1 \
  --since 5m \
  --filter-pattern "$JOB_ID" \
  | grep -i "Artifact URLs\|artifacts_count" || echo "⚠️  Check logs manually"

echo ""
echo "✅ Test complete!"
echo "   Check webhook receiver at: $WEBHOOK_URL"
echo "   Verify payload includes: artifacts, images, html_files, markdown_files"
