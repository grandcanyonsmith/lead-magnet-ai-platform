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

API_URL="${API_URL:-https://czp5b77azd.execute-api.us-east-1.amazonaws.com}"

echo -e "${BLUE}Testing webhook endpoint structure and validation...${NC}"
echo ""

# Test 1: Test invalid token (should return 404)
echo -e "${YELLOW}Test 1: Invalid webhook token (should return 404)${NC}"
INVALID_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/v1/webhooks/invalid_token_test_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "wf_test001",
    "form_data": {
      "name": "Test User",
      "email": "test@example.com",
      "phone": "+14155551234"
    }
  }')

HTTP_CODE=$(echo "$INVALID_RESPONSE" | tail -n1)
BODY=$(echo "$INVALID_RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
if [ "$HTTP_CODE" = "404" ]; then
    echo -e "${GREEN}✓ Invalid token correctly returns 404${NC}"
else
    echo -e "${YELLOW}⚠ Expected 404, got $HTTP_CODE${NC}"
fi
echo "Response: $BODY"
echo ""

# Test 2: Test missing workflow identifier (should return 400)
echo -e "${YELLOW}Test 2: Missing workflow identifier (should return 400)${NC}"
echo "Note: This test uses a dummy token - actual 400/404 depends on token validation order"
MISSING_WF_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/v1/webhooks/test_token_for_validation" \
  -H "Content-Type: application/json" \
  -d '{
    "form_data": {
      "name": "Test User",
      "email": "test@example.com",
      "phone": "+14155551234"
    }
  }')

HTTP_CODE2=$(echo "$MISSING_WF_RESPONSE" | tail -n1)
BODY2=$(echo "$MISSING_WF_RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE2"
if [ "$HTTP_CODE2" = "400" ] || [ "$HTTP_CODE2" = "404" ]; then
    echo -e "${GREEN}✓ Missing workflow identifier correctly rejected (400 or 404)${NC}"
else
    echo -e "${YELLOW}⚠ Expected 400 or 404, got $HTTP_CODE2${NC}"
fi
echo "Response: $BODY2"
echo ""

# Test 3: Test malformed JSON (should return 400)
echo -e "${YELLOW}Test 3: Malformed JSON (should return 400)${NC}"
MALFORMED_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/v1/webhooks/test_token" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "wf_test001",
    "form_data": {
      "name": "Test User"
      "email": "test@example.com"
    }
  }' 2>&1)

HTTP_CODE3=$(echo "$MALFORMED_RESPONSE" | tail -n1)
echo "HTTP Status: $HTTP_CODE3"
if [ "$HTTP_CODE3" = "400" ] || [ "$HTTP_CODE3" = "500" ]; then
    echo -e "${GREEN}✓ Malformed JSON correctly rejected${NC}"
else
    echo -e "${YELLOW}⚠ Expected 400 or 500, got $HTTP_CODE3${NC}"
fi
echo ""

# Summary
echo ""
echo -e "${GREEN}========================================"
echo "Webhook Endpoint Validation Tests"
echo "========================================${NC}"
echo ""
echo -e "${BLUE}Endpoint Structure:${NC}"
echo "  POST $API_URL/v1/webhooks/{token}"
echo ""
echo -e "${BLUE}Required Request Body:${NC}"
echo "  {"
echo "    \"workflow_id\": \"wf_xxxxx\" OR \"workflow_name\": \"My Workflow\","
echo "    \"form_data\": {"
echo "      \"name\": \"...\","
echo "      \"email\": \"...\","
echo "      \"phone\": \"...\""
echo "    }"
echo "  }"
echo ""
echo -e "${BLUE}To test with a real webhook:${NC}"
echo "1. Get your webhook token from: $API_URL/admin/settings"
echo "2. Get a workflow_id from: $API_URL/admin/workflows"
echo "3. Run:"
echo "   curl -X POST \"$API_URL/v1/webhooks/YOUR_TOKEN\" \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"workflow_id\":\"wf_xxxxx\",\"form_data\":{\"name\":\"Test\",\"email\":\"test@test.com\",\"phone\":\"+14155551234\"}}'"
echo ""
echo -e "${GREEN}✓ Basic endpoint validation tests completed${NC}"
echo ""

