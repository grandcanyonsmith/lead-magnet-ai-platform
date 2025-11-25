#!/bin/bash
# Test webhook artifacts using the public webhook endpoint
# This doesn't require authentication

set -e

API_URL="https://czp5b77azd.execute-api.us-east-1.amazonaws.com"

echo "🧪 Testing Webhook Artifacts via Public Webhook Endpoint"
echo "========================================================"
echo ""

# First, we need a webhook token
# Let's try to get it from DynamoDB or use a known one
echo "📋 Getting webhook token..."

# Try to get from user settings table
SETTINGS_TABLE=$(aws cloudformation describe-stacks \
    --stack-name leadmagnet-storage \
    --region us-east-1 \
    --query "Stacks[0].Outputs[?OutputKey=='UserSettingsTableName'].OutputValue" \
    --output text 2>/dev/null || echo "")

if [ -n "$SETTINGS_TABLE" ]; then
    WEBHOOK_TOKEN=$(aws dynamodb scan \
        --table-name "$SETTINGS_TABLE" \
        --region us-east-1 \
        --filter-expression "attribute_exists(webhook_token)" \
        --limit 1 \
        --query 'Items[0].webhook_token.S' \
        --output text 2>/dev/null || echo "")
fi

if [ -z "$WEBHOOK_TOKEN" ] || [ "$WEBHOOK_TOKEN" = "None" ]; then
    echo "⚠️  Could not get webhook token from DynamoDB"
    echo ""
    echo "Please provide a webhook token:"
    echo "1. Log in to https://dmydkyj79auy7.cloudfront.net"
    echo "2. Go to Settings"
    echo "3. Copy your webhook URL"
    echo "4. Extract the token (last part after /v1/webhooks/)"
    echo ""
    read -p "Enter webhook token: " WEBHOOK_TOKEN
fi

if [ -z "$WEBHOOK_TOKEN" ]; then
    echo "❌ No webhook token provided"
    exit 1
fi

echo "✅ Using webhook token: ${WEBHOOK_TOKEN:0:20}..."
echo ""

# Now we need a workflow_id that has webhook delivery configured
# Let's try to find one or create instructions
echo "📋 Finding workflow with webhook delivery..."
echo ""
echo "To test, you need a workflow with:"
echo "  - delivery_method: 'webhook'"
echo "  - delivery_webhook_url: 'https://template-docs-grandcanyonsmit.replit.app/api/clients/generate-from-webhook'"
echo ""
read -p "Enter workflow_id (or press Enter to skip): " WORKFLOW_ID

if [ -z "$WORKFLOW_ID" ]; then
    echo ""
    echo "⚠️  No workflow ID provided"
    echo ""
    echo "To create a workflow:"
    echo "1. Log in to the dashboard"
    echo "2. Create a new workflow with webhook delivery"
    echo "3. Run this script again with the workflow_id"
    exit 1
fi

echo "✅ Using workflow: $WORKFLOW_ID"
echo ""

# Submit via webhook endpoint
echo "📤 Submitting via webhook endpoint..."
WEBHOOK_RESPONSE=$(curl -s -X POST "$API_URL/v1/webhooks/$WEBHOOK_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
        \"workflow_id\": \"$WORKFLOW_ID\",
        \"name\": \"Test User\",
        \"email\": \"test@example.com\",
        \"message\": \"Test webhook artifacts\"
    }")

JOB_ID=$(echo "$WEBHOOK_RESPONSE" | jq -r '.job_id // empty' 2>/dev/null || echo "")

if [ -z "$JOB_ID" ] || [ "$JOB_ID" = "null" ]; then
    echo "❌ Failed to create job via webhook"
    echo "Response: $WEBHOOK_RESPONSE"
    exit 1
fi

echo "✅ Job created: $JOB_ID"
echo ""

# Wait for completion
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
    | grep -i "Artifact URLs\|artifacts_count\|DeliveryService" || echo "⚠️  Check logs manually"

echo ""
echo "✅ Test complete!"
echo "   Job ID: $JOB_ID"
echo "   Check webhook receiver at: https://template-docs-grandcanyonsmit.replit.app/api/clients/generate-from-webhook"
echo "   Verify payload includes: artifacts, images, html_files, markdown_files"

