#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}Lead Magnet AI - Webhook Test${NC}"
echo "========================================"
echo ""

# Get API URL from environment or use default
API_URL="${API_URL:-https://czp5b77azd.execute-api.us-east-1.amazonaws.com}"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}✗ jq is required but not installed${NC}"
    echo "Install with: brew install jq (macOS) or apt-get install jq (Linux)"
    exit 1
fi

# Check if user is authenticated (has AWS credentials)
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${YELLOW}⚠ AWS credentials not configured. Some tests may fail.${NC}"
    echo ""
fi

echo -e "${BLUE}API URL: $API_URL${NC}"
echo ""

# Test 1: Get user settings to retrieve webhook token
echo -e "${YELLOW}Test 1: Get user settings (requires authentication)${NC}"
echo "Note: This test requires a valid JWT token"
echo "You can get your webhook URL from the dashboard at /admin/settings"
echo ""
echo -e "${BLUE}To get your webhook token manually:${NC}"
echo "1. Log in to the dashboard"
echo "2. Go to Settings"
echo "3. Copy your webhook_url"
echo ""
read -p "Enter your webhook token (or press Enter to skip): " WEBHOOK_TOKEN

if [ -z "$WEBHOOK_TOKEN" ]; then
    echo -e "${YELLOW}⚠ Skipping webhook tests - no token provided${NC}"
    echo ""
    echo "To test webhooks:"
    echo "1. Get your webhook URL from /admin/settings"
    echo "2. Extract the token from the URL (last part after /v1/webhooks/)"
    echo "3. Run this script with: WEBHOOK_TOKEN=your_token ./scripts/test-webhook.sh"
    exit 0
fi

echo -e "${GREEN}✓ Using webhook token: ${WEBHOOK_TOKEN:0:20}...${NC}"
echo ""

# Test 2: Test webhook with workflow_id
echo -e "${YELLOW}Test 2: POST to webhook with workflow_id${NC}"
WEBHOOK_RESPONSE=$(curl -s -X POST "$API_URL/v1/webhooks/$WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "wf_test001",
    "form_data": {
      "name": "Webhook Test User",
      "email": "webhook@test.com",
      "phone": "+14155551234",
      "custom_field": "Test value from webhook"
    }
  }')

echo "$WEBHOOK_RESPONSE" | jq . 2>/dev/null || echo "$WEBHOOK_RESPONSE"
JOB_ID=$(echo "$WEBHOOK_RESPONSE" | jq -r '.job_id // empty' 2>/dev/null)

if [ -n "$JOB_ID" ] && [ "$JOB_ID" != "null" ]; then
    echo -e "${GREEN}✓ Webhook with workflow_id succeeded${NC}"
    echo "  Job ID: $JOB_ID"
else
    echo -e "${RED}✗ Webhook with workflow_id failed${NC}"
    echo "  Response: $WEBHOOK_RESPONSE"
fi
echo ""

# Test 3: Test webhook with workflow_name
echo -e "${YELLOW}Test 3: POST to webhook with workflow_name${NC}"
read -p "Enter a workflow name to test (or press Enter to skip): " WORKFLOW_NAME

if [ -n "$WORKFLOW_NAME" ]; then
    WEBHOOK_RESPONSE2=$(curl -s -X POST "$API_URL/v1/webhooks/$WEBHOOK_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"workflow_name\": \"$WORKFLOW_NAME\",
        \"form_data\": {
          \"name\": \"Webhook Test User 2\",
          \"email\": \"webhook2@test.com\",
          \"phone\": \"+14155551235\",
          \"custom_field\": \"Test value from webhook with workflow_name\"
        }
      }")

    echo "$WEBHOOK_RESPONSE2" | jq . 2>/dev/null || echo "$WEBHOOK_RESPONSE2"
    JOB_ID2=$(echo "$WEBHOOK_RESPONSE2" | jq -r '.job_id // empty' 2>/dev/null)

    if [ -n "$JOB_ID2" ] && [ "$JOB_ID2" != "null" ]; then
        echo -e "${GREEN}✓ Webhook with workflow_name succeeded${NC}"
        echo "  Job ID: $JOB_ID2"
    else
        echo -e "${RED}✗ Webhook with workflow_name failed${NC}"
        echo "  Response: $WEBHOOK_RESPONSE2"
    fi
else
    echo -e "${YELLOW}⚠ Skipping workflow_name test${NC}"
fi
echo ""

# Test 4: Test invalid token
echo -e "${YELLOW}Test 4: Test invalid webhook token${NC}"
INVALID_RESPONSE=$(curl -s -X POST "$API_URL/v1/webhooks/invalid_token_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "wf_test001",
    "form_data": {
      "name": "Test",
      "email": "test@test.com",
      "phone": "+14155551234"
    }
  }')

echo "$INVALID_RESPONSE" | jq . 2>/dev/null || echo "$INVALID_RESPONSE"
STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/v1/webhooks/invalid_token_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "wf_test001",
    "form_data": {
      "name": "Test",
      "email": "test@test.com",
      "phone": "+14155551234"
    }
  }')

if [ "$STATUS_CODE" = "404" ]; then
    echo -e "${GREEN}✓ Invalid token correctly returns 404${NC}"
else
    echo -e "${YELLOW}⚠ Expected 404, got $STATUS_CODE${NC}"
fi
echo ""

# Test 5: Test missing workflow identifier
echo -e "${YELLOW}Test 5: Test missing workflow identifier${NC}"
MISSING_WF_RESPONSE=$(curl -s -X POST "$API_URL/v1/webhooks/$WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "form_data": {
      "name": "Test",
      "email": "test@test.com",
      "phone": "+14155551234"
    }
  }')

echo "$MISSING_WF_RESPONSE" | jq . 2>/dev/null || echo "$MISSING_WF_RESPONSE"
STATUS_CODE2=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/v1/webhooks/$WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "form_data": {
      "name": "Test",
      "email": "test@test.com",
      "phone": "+14155551234"
    }
  }')

if [ "$STATUS_CODE2" = "400" ]; then
    echo -e "${GREEN}✓ Missing workflow identifier correctly returns 400${NC}"
else
    echo -e "${YELLOW}⚠ Expected 400, got $STATUS_CODE2${NC}"
fi
echo ""

# Summary
echo ""
echo -e "${GREEN}========================================"
echo "Webhook Test Summary"
echo "========================================${NC}"
echo -e "Webhook URL: $API_URL/v1/webhooks/$WEBHOOK_TOKEN"
if [ -n "$JOB_ID" ] && [ "$JOB_ID" != "null" ]; then
    echo -e "${GREEN}✓ Webhook with workflow_id: SUCCESS${NC}"
    echo "  Job ID: $JOB_ID"
    echo "  Check status: $API_URL/v1/jobs/$JOB_ID/status"
fi
if [ -n "$JOB_ID2" ] && [ "$JOB_ID2" != "null" ]; then
    echo -e "${GREEN}✓ Webhook with workflow_name: SUCCESS${NC}"
    echo "  Job ID: $JOB_ID2"
    echo "  Check status: $API_URL/v1/jobs/$JOB_ID2/status"
fi
echo ""
echo -e "${GREEN}Webhook tests completed! 🎉${NC}"
echo ""

