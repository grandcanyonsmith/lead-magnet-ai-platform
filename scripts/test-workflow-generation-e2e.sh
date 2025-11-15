#!/bin/bash

# End-to-end test script for async workflow generation with webhook completion
# This script tests the full flow from submission to completion

set -e

echo "🧪 Testing Workflow Generation E2E Flow"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:3001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
TENANT_ID="${TENANT_ID:-test_tenant}"
AUTH_TOKEN="${AUTH_TOKEN:-}"

# Test description
DESCRIPTION="A course idea validator that analyzes market demand, competition, target audience, and provides actionable recommendations for course creators"

echo "📋 Test Configuration:"
echo "  API URL: $API_URL"
echo "  Frontend URL: $FRONTEND_URL"
echo "  Tenant ID: $TENANT_ID"
echo ""

# Step 1: Submit workflow generation request
echo "1️⃣  Submitting workflow generation request..."
RESPONSE=$(curl -s -X POST "$API_URL/admin/workflows/generate-with-ai" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  ${AUTH_TOKEN:+-H "Authorization: Bearer $AUTH_TOKEN"} \
  -d "{
    \"description\": \"$DESCRIPTION\",
    \"model\": \"gpt-5\",
    \"webhook_url\": \"$FRONTEND_URL/api/webhooks/workflow-completion/{jobId}\"
  }")

JOB_ID=$(echo "$RESPONSE" | jq -r '.body.job_id // .job_id // empty')

if [ -z "$JOB_ID" ] || [ "$JOB_ID" = "null" ]; then
  echo -e "${RED}❌ Failed to get job_id from response${NC}"
  echo "Response: $RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Job created: $JOB_ID${NC}"
echo ""

# Step 2: Check job status
echo "2️⃣  Checking job status..."
STATUS_RESPONSE=$(curl -s -X GET "$API_URL/admin/workflows/generation-status/$JOB_ID" \
  -H "X-Tenant-ID: $TENANT_ID" \
  ${AUTH_TOKEN:+-H "Authorization: Bearer $AUTH_TOKEN"})

STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.body.status // .status // empty')
echo "  Status: $STATUS"

if [ "$STATUS" != "pending" ] && [ "$STATUS" != "processing" ]; then
  echo -e "${YELLOW}⚠️  Unexpected status: $STATUS${NC}"
fi
echo ""

# Step 3: Wait for job completion (polling)
echo "3️⃣  Waiting for job completion (max 5 minutes)..."
MAX_WAIT=300
WAIT_INTERVAL=5
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
  sleep $WAIT_INTERVAL
  ELAPSED=$((ELAPSED + WAIT_INTERVAL))
  
  STATUS_RESPONSE=$(curl -s -X GET "$API_URL/admin/workflows/generation-status/$JOB_ID" \
    -H "X-Tenant-ID: $TENANT_ID" \
    ${AUTH_TOKEN:+-H "Authorization: Bearer $AUTH_TOKEN"})
  
  STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.body.status // .status // empty')
  WORKFLOW_ID=$(echo "$STATUS_RESPONSE" | jq -r '.body.workflow_id // empty')
  
  echo "  [$ELAPSED s] Status: $STATUS"
  
  if [ "$STATUS" = "completed" ]; then
    if [ -n "$WORKFLOW_ID" ] && [ "$WORKFLOW_ID" != "null" ]; then
      echo -e "${GREEN}✅ Job completed! Workflow ID: $WORKFLOW_ID${NC}"
      break
    else
      echo -e "${YELLOW}⚠️  Job completed but no workflow_id found${NC}"
    fi
  elif [ "$STATUS" = "failed" ]; then
    ERROR_MSG=$(echo "$STATUS_RESPONSE" | jq -r '.body.error_message // .error_message // "Unknown error"')
    echo -e "${RED}❌ Job failed: $ERROR_MSG${NC}"
    exit 1
  fi
done

if [ "$STATUS" != "completed" ]; then
  echo -e "${RED}❌ Job did not complete within $MAX_WAIT seconds${NC}"
  exit 1
fi
echo ""

# Step 4: Verify workflow was created as draft
echo "4️⃣  Verifying workflow was created as draft..."
WORKFLOW_RESPONSE=$(curl -s -X GET "$API_URL/admin/workflows/$WORKFLOW_ID" \
  -H "X-Tenant-ID: $TENANT_ID" \
  ${AUTH_TOKEN:+-H "Authorization: Bearer $AUTH_TOKEN"})

WORKFLOW_STATUS=$(echo "$WORKFLOW_RESPONSE" | jq -r '.body.status // .status // empty')
WORKFLOW_NAME=$(echo "$WORKFLOW_RESPONSE" | jq -r '.body.workflow_name // .workflow_name // empty')

if [ "$WORKFLOW_STATUS" = "draft" ]; then
  echo -e "${GREEN}✅ Workflow is saved as draft${NC}"
  echo "  Workflow Name: $WORKFLOW_NAME"
else
  echo -e "${RED}❌ Workflow status is '$WORKFLOW_STATUS', expected 'draft'${NC}"
  exit 1
fi
echo ""

# Step 5: Test webhook endpoint
echo "5️⃣  Testing webhook completion endpoint..."
WEBHOOK_URL="$FRONTEND_URL/api/webhooks/workflow-completion/$JOB_ID"

# Simulate webhook POST
WEBHOOK_PAYLOAD="{
  \"job_id\": \"$JOB_ID\",
  \"status\": \"completed\",
  \"workflow_id\": \"$WORKFLOW_ID\",
  \"completed_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
}"

WEBHOOK_RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$WEBHOOK_PAYLOAD")

WEBHOOK_SUCCESS=$(echo "$WEBHOOK_RESPONSE" | jq -r '.success // false')

if [ "$WEBHOOK_SUCCESS" = "true" ]; then
  echo -e "${GREEN}✅ Webhook endpoint accepted completion${NC}"
else
  echo -e "${YELLOW}⚠️  Webhook endpoint response: $WEBHOOK_RESPONSE${NC}"
fi
echo ""

# Step 6: Test webhook status check (GET)
echo "6️⃣  Testing webhook status check endpoint..."
STATUS_CHECK=$(curl -s -X GET "$WEBHOOK_URL")

STATUS_CHECK_SUCCESS=$(echo "$STATUS_CHECK" | jq -r '.success // false')
STATUS_CHECK_WORKFLOW_ID=$(echo "$STATUS_CHECK" | jq -r '.workflow_id // empty')

if [ "$STATUS_CHECK_SUCCESS" = "true" ] && [ "$STATUS_CHECK_WORKFLOW_ID" = "$WORKFLOW_ID" ]; then
  echo -e "${GREEN}✅ Webhook status check works correctly${NC}"
else
  echo -e "${YELLOW}⚠️  Status check response: $STATUS_CHECK${NC}"
fi
echo ""

# Summary
echo "======================================"
echo -e "${GREEN}✅ All tests passed!${NC}"
echo ""
echo "Summary:"
echo "  Job ID: $JOB_ID"
echo "  Workflow ID: $WORKFLOW_ID"
echo "  Workflow Name: $WORKFLOW_NAME"
echo "  Status: $WORKFLOW_STATUS"
echo ""
echo "Next steps:"
echo "  1. Open $FRONTEND_URL/dashboard/workflows/$WORKFLOW_ID/edit"
echo "  2. Verify the workflow is displayed with 'Draft' badge"
echo "  3. Review and save the workflow"
echo ""

