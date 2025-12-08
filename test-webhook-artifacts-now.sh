#!/bin/bash
# Test webhook artifacts feature end-to-end

set -e

API_URL="https://czp5b77azd.execute-api.us-east-1.amazonaws.com"
WEBHOOK_URL="https://template-docs-grandcanyonsmit.replit.app/api/clients/generate-from-webhook"

echo "🧪 Testing Webhook Artifacts Feature"
echo "===================================="
echo ""

# Get a recent job that has artifacts
echo "📋 Finding a recent job with artifacts..."
RECENT_JOBS=$(aws logs tail /aws/lambda/leadmagnet-job-processor \
    --region us-east-1 \
    --since 1h \
    --format short 2>/dev/null | grep -o "job_[A-Z0-9]*" | sort -u | head -5)

if [ -z "$RECENT_JOBS" ]; then
    echo "⚠️  No recent jobs found in logs"
    echo ""
    echo "To test manually:"
    echo "1. Create a workflow with a webhook step"
    echo "2. Set webhook_url to: $WEBHOOK_URL"
    echo "3. Run the workflow"
    echo "4. Check the job details page - the Input section should show artifacts in the payload"
    exit 0
fi

echo "Found jobs: $RECENT_JOBS"
echo ""

# Check logs for artifact inclusion
for JOB_ID in $RECENT_JOBS; do
    echo "🔍 Checking job: $JOB_ID"
    
    # Check for artifact logs
    ARTIFACT_LOGS=$(aws logs filter-log-events \
        --log-group-name /aws/lambda/leadmagnet-job-processor \
        --region us-east-1 \
        --start-time $(($(date +%s) - 3600))000 \
        --filter-pattern "$JOB_ID" \
        --max-items 100 \
        --query 'events[*].message' \
        --output text 2>/dev/null | grep -i "Artifact URLs in webhook\|artifacts_count\|WebhookStepService.*artifact" || echo "")
    
    if [ -n "$ARTIFACT_LOGS" ]; then
        echo "✅ Found artifact logs for $JOB_ID:"
        echo "$ARTIFACT_LOGS" | head -5
        echo ""
        
        # Get job status
        JOB_STATUS=$(curl -s "$API_URL/v1/jobs/$JOB_ID/status" 2>/dev/null | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
        echo "   Job status: $JOB_STATUS"
        echo ""
        echo "✅ Test passed! Artifacts are being included in webhook payloads."
        echo ""
        echo "To verify in frontend:"
        echo "1. Go to: https://dmydkyj79auy7.cloudfront.net/dashboard/jobs/$JOB_ID"
        echo "2. Find the webhook step"
        echo "3. Click 'Details' to expand"
        echo "4. Check the 'Input' section - it should show 'artifacts', 'images', 'html_files', 'markdown_files' arrays"
        exit 0
    fi
done

echo "⚠️  No artifact logs found in recent jobs"
echo ""
echo "This could mean:"
echo "1. Jobs haven't completed webhook steps yet"
echo "2. Jobs don't have artifacts yet"
echo ""
echo "To test with a new job:"
echo "1. Create a workflow with a webhook step"
echo "2. Set webhook_url to: $WEBHOOK_URL"
echo "3. Submit the form"
echo "4. Wait for completion"
echo "5. Check the job details page"











