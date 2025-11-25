#!/bin/bash
# Simple test: Use an existing workflow or create via form submission
# This tests the webhook artifacts feature

set -e

API_URL="https://czp5b77azd.execute-api.us-east-1.amazonaws.com"
WEBHOOK_URL="https://template-docs-grandcanyonsmit.replit.app/api/clients/generate-from-webhook"

echo "🧪 Testing Webhook Artifacts Feature"
echo "====================================="
echo ""
echo "This script will:"
echo "1. Find an existing workflow with webhook delivery"
echo "2. Or guide you to create one manually"
echo "3. Submit a form to trigger the workflow"
echo "4. Verify artifacts are included in webhook payload"
echo ""

# Check if we have a workflow ID
if [ -z "$1" ]; then
    echo "Usage: $0 <workflow_id>"
    echo ""
    echo "To find a workflow ID:"
    echo "1. Log in to https://dmydkyj79auy7.cloudfront.net"
    echo "2. Go to Workflows"
    echo "3. Find a workflow with webhook delivery configured"
    echo "4. Copy the workflow ID"
    echo ""
    echo "Or create a new workflow:"
    echo "1. Go to Workflows > New"
    echo "2. Add a step (e.g., AI step to generate content)"
    echo "3. Set Delivery Method to 'Webhook'"
    echo "4. Set Webhook URL to: $WEBHOOK_URL"
    echo "5. Save and activate the workflow"
    echo ""
    exit 1
fi

WORKFLOW_ID="$1"
echo "✅ Using workflow: $WORKFLOW_ID"

# Get workflow details to find the form
echo ""
echo "📋 Getting workflow details..."
WORKFLOW_RESPONSE=$(curl -s "$API_URL/v1/workflows/$WORKFLOW_ID" 2>/dev/null || echo "{}")

if [ "$WORKFLOW_RESPONSE" = "{}" ]; then
    echo "⚠️  Could not fetch workflow (may require auth)"
    echo "   Please provide the form slug manually:"
    read -p "Form slug: " FORM_SLUG
else
    FORM_SLUG=$(echo "$WORKFLOW_RESPONSE" | jq -r '.form.public_slug // empty' 2>/dev/null || echo "")
fi

if [ -z "$FORM_SLUG" ]; then
    echo "⚠️  Could not determine form slug"
    read -p "Enter form slug: " FORM_SLUG
fi

echo "✅ Form slug: $FORM_SLUG"

# Submit form
echo ""
echo "📤 Submitting form..."
SUBMIT_RESPONSE=$(curl -s -X POST "$API_URL/v1/forms/$FORM_SLUG/submit" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Test User",
        "email": "test@example.com",
        "message": "Test webhook artifacts"
    }')

JOB_ID=$(echo "$SUBMIT_RESPONSE" | jq -r '.job_id // empty' 2>/dev/null || echo "")

if [ -z "$JOB_ID" ] || [ "$JOB_ID" = "null" ]; then
    echo "❌ Failed to get job_id"
    echo "Response: $SUBMIT_RESPONSE"
    exit 1
fi

echo "✅ Job created: $JOB_ID"

# Wait for completion
echo ""
echo "⏳ Waiting for job to complete..."
for i in {1..24}; do
    sleep 5
    STATUS_RESPONSE=$(curl -s "$API_URL/v1/jobs/$JOB_ID/status")
    STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status // empty' 2>/dev/null || echo "unknown")
    
    echo "   [$i/24] Status: $STATUS"
    
    if [ "$STATUS" = "completed" ]; then
        echo "✅ Job completed!"
        break
    elif [ "$STATUS" = "failed" ]; then
        ERROR=$(echo "$STATUS_RESPONSE" | jq -r '.error_message // "Unknown error"' 2>/dev/null || echo "Unknown error")
        echo "❌ Job failed: $ERROR"
        exit 1
    fi
done

# Check logs
echo ""
echo "🔍 Checking CloudWatch logs for artifact URLs..."
aws logs tail /aws/lambda/leadmagnet-job-processor \
    --region us-east-1 \
    --since 5m \
    --filter-pattern "$JOB_ID" \
    | grep -i "Artifact URLs\|artifacts_count" || echo "⚠️  No artifact logs found (check manually)"

echo ""
echo "✅ Test complete!"
echo "   Job ID: $JOB_ID"
echo "   Check the webhook receiver at: $WEBHOOK_URL"
echo "   Verify the payload includes 'artifacts', 'images', 'html_files', 'markdown_files' arrays"

