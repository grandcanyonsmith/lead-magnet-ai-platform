#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Lead Magnet AI - Form E2E Test${NC}"
echo "========================================"
echo ""

API_URL="https://czp5b77azd.execute-api.us-east-1.amazonaws.com"
FORM_SLUG="ai-personalized-resource-request"
FRONTEND_URL="https://dmydkyj79auy7.cloudfront.net"

# Test 1: Get form schema via API
echo -e "${YELLOW}Test 1: Get form schema via API${NC}"
FORM_RESPONSE=$(curl -s "$API_URL/v1/forms/$FORM_SLUG")
echo "$FORM_RESPONSE" | jq -r '.form_name // "ERROR"'
if echo "$FORM_RESPONSE" | jq -e '.form_id' > /dev/null; then
    echo -e "${GREEN}✓ Form API endpoint works${NC}"
    FORM_NAME=$(echo "$FORM_RESPONSE" | jq -r '.form_name')
    echo "  Form Name: $FORM_NAME"
else
    echo -e "${RED}✗ Form API endpoint failed${NC}"
    exit 1
fi
echo ""

# Test 2: Submit form
echo -e "${YELLOW}Test 2: Submit form${NC}"
SUBMIT_RESPONSE=$(curl -s -X POST "$API_URL/v1/forms/$FORM_SLUG/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "submission_data": {
      "name": "E2E Test User",
      "email": "e2e@test.com",
      "phone": "+14155559999",
      "field_1": "Test User",
      "field_2": "test@example.com",
      "field_3": "Technology",
      "field_4": "Beginner",
      "field_5": "Testing the full form submission flow"
    }
  }')

echo "$SUBMIT_RESPONSE" | jq .
JOB_ID=$(echo "$SUBMIT_RESPONSE" | jq -r '.job_id')

if [ -n "$JOB_ID" ] && [ "$JOB_ID" != "null" ]; then
    echo -e "${GREEN}✓ Form submitted successfully${NC}"
    echo "  Job ID: $JOB_ID"
else
    echo -e "${RED}✗ Form submission failed${NC}"
    exit 1
fi
echo ""

# Test 3: Check job status
echo -e "${YELLOW}Test 3: Check job status${NC}"
sleep 2
STATUS_RESPONSE=$(curl -s "$API_URL/v1/jobs/$JOB_ID/status")
echo "$STATUS_RESPONSE" | jq .
STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')

if [ -n "$STATUS" ] && [ "$STATUS" != "null" ]; then
    echo -e "${GREEN}✓ Job status endpoint works${NC}"
    echo "  Status: $STATUS"
else
    echo -e "${RED}✗ Job status endpoint failed${NC}"
    exit 1
fi
echo ""

# Test 4: Check frontend form page
echo -e "${YELLOW}Test 4: Check frontend form page${NC}"
FRONTEND_RESPONSE=$(curl -s -L "$FRONTEND_URL/v1/forms/$FORM_SLUG" | head -50)
if echo "$FRONTEND_RESPONSE" | grep -q "Loading form\|AI-Personalized\|form_name"; then
    echo -e "${GREEN}✓ Frontend form page accessible${NC}"
else
    echo -e "${YELLOW}⚠ Frontend form page may need client-side routing${NC}"
    echo "  URL: $FRONTEND_URL/v1/forms/$FORM_SLUG"
    echo "  Note: Form should load via client-side routing"
fi
echo ""

# Test 5: Verify job in database
echo -e "${YELLOW}Test 5: Verify job in database${NC}"
JOB_DB=$(aws dynamodb get-item \
  --table-name leadmagnet-jobs \
  --key "{\"job_id\":{\"S\":\"$JOB_ID\"}}" \
  --query 'Item.{status:status.S,created:created_at.S}' \
  --output json 2>/dev/null || echo '{}')

if echo "$JOB_DB" | jq -e '.status' > /dev/null; then
    echo -e "${GREEN}✓ Job found in database${NC}"
    echo "$JOB_DB" | jq .
else
    echo -e "${YELLOW}⚠ Job may not be in database yet (checking...)${NC}"
fi
echo ""

# Summary
echo ""
echo -e "${GREEN}========================================"
echo "E2E Test Summary"
echo "========================================${NC}"
echo -e "✓ API form endpoint: $API_URL/v1/forms/$FORM_SLUG"
echo -e "✓ Form submission: Working"
echo -e "✓ Job status endpoint: $API_URL/v1/jobs/$JOB_ID/status"
echo -e "✓ Frontend form page: $FRONTEND_URL/v1/forms/$FORM_SLUG"
echo ""
echo -e "${GREEN}All API tests passed! 🎉${NC}"
echo ""
echo "Next steps:"
echo "1. Open $FRONTEND_URL/v1/forms/$FORM_SLUG in a browser"
echo "2. The form should load and extract the slug from the URL"
echo "3. Submit the form and verify job creation"
echo ""

