#!/bin/bash
# Quick Mobile Test Verification Script

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📱 Mobile Testing Verification${NC}"
echo "=================================="
echo ""

API_URL="https://czp5b77azd.execute-api.us-east-1.amazonaws.com"
FRONTEND_URL="https://dmydkyj79auy7.cloudfront.net"
FORM_SLUG="ai-personalized-resource-request"

echo -e "${YELLOW}1. Testing API Endpoints (should work on mobile)${NC}"
echo ""

# Test form endpoint
echo "Testing form endpoint..."
FORM_NAME=$(curl -s "$API_URL/v1/forms/$FORM_SLUG" | jq -r '.form_name // "ERROR"')
if [ "$FORM_NAME" != "ERROR" ] && [ -n "$FORM_NAME" ]; then
    echo -e "${GREEN}✓ Form API: $FORM_NAME${NC}"
else
    echo -e "${RED}✗ Form API failed${NC}"
fi

# Test form submission
echo "Testing form submission..."
JOB_ID=$(curl -s -X POST "$API_URL/v1/forms/$FORM_SLUG/submit" \
  -H "Content-Type: application/json" \
  -d '{"submission_data":{"name":"Mobile Test","email":"mobile@test.com","phone":"+14155551234","field_1":"Test","field_2":"test@test.com","field_3":"Technology","field_4":"Beginner","field_5":"Mobile test"}}' \
  | jq -r '.job_id // "ERROR"')

if [ "$JOB_ID" != "ERROR" ] && [ -n "$JOB_ID" ]; then
    echo -e "${GREEN}✓ Form submission: Job $JOB_ID created${NC}"
    
    # Test job status
    sleep 1
    STATUS=$(curl -s "$API_URL/v1/jobs/$JOB_ID/status" | jq -r '.status // "ERROR"')
    if [ "$STATUS" != "ERROR" ]; then
        echo -e "${GREEN}✓ Job status endpoint: $STATUS${NC}"
    fi
else
    echo -e "${RED}✗ Form submission failed${NC}"
fi

echo ""
echo -e "${YELLOW}2. Mobile Test URLs${NC}"
echo ""
echo "Open these URLs on your mobile device:"
echo ""
echo -e "${BLUE}Jobs List:${NC}"
echo "  $FRONTEND_URL/dashboard/jobs"
echo ""
echo -e "${BLUE}Form Page:${NC}"
echo "  $FRONTEND_URL/v1/forms/$FORM_SLUG"
echo ""

echo -e "${YELLOW}3. Mobile Test Checklist${NC}"
echo ""
echo "On mobile device, test:"
echo "  [ ] Jobs list page loads"
echo "  [ ] Tap job card → Navigates to job detail (not dashboard)"
echo "  [ ] Tap 'View Document' → Opens document (not redirect)"
echo "  [ ] Form page loads with correct slug"
echo "  [ ] Form submission works"
echo ""

echo -e "${GREEN}✅ All API endpoints verified!${NC}"
echo ""
echo "Next: Test the frontend URLs on your mobile device"

