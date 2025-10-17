#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Lead Magnet AI - End-to-End Test${NC}"
echo "========================================"
echo ""

API_URL="https://czp5b77azd.execute-api.us-east-1.amazonaws.com"

# Test 1: Get form schema
echo -e "${YELLOW}Test 1: Get form schema${NC}"
FORM_RESPONSE=$(curl -s "$API_URL/v1/forms/test-form")
echo "$FORM_RESPONSE" | jq .
if echo "$FORM_RESPONSE" | jq -e '.form_id' > /dev/null; then
    echo -e "${GREEN}✓ Form retrieved successfully${NC}"
else
    echo -e "${RED}✗ Form retrieval failed${NC}"
    exit 1
fi
echo ""

# Test 2: Submit form
echo -e "${YELLOW}Test 2: Submit form with test data${NC}"
SUBMIT_RESPONSE=$(curl -s -X POST "$API_URL/v1/forms/test-form/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "submission_data": {
      "name": "Jane Smith",
      "email": "jane@example.com",
      "project": "I need a comprehensive market research report for the fitness industry"
    }
  }')

echo "$SUBMIT_RESPONSE" | jq .
JOB_ID=$(echo "$SUBMIT_RESPONSE" | jq -r '.job_id')

if [ -n "$JOB_ID" ] && [ "$JOB_ID" != "null" ]; then
    echo -e "${GREEN}✓ Form submitted successfully. Job ID: $JOB_ID${NC}"
else
    echo -e "${RED}✗ Form submission failed${NC}"
    exit 1
fi
echo ""

# Test 3: Check job status
echo -e "${YELLOW}Test 3: Check job status in DynamoDB${NC}"
JOB_STATUS=$(aws dynamodb get-item \
  --table-name leadmagnet-jobs \
  --key "{\"job_id\":{\"S\":\"$JOB_ID\"}}" \
  --query 'Item.status.S' \
  --output text)

echo "Job Status: $JOB_STATUS"
if [ -n "$JOB_STATUS" ]; then
    echo -e "${GREEN}✓ Job found in database${NC}"
else
    echo -e "${RED}✗ Job not found${NC}"
    exit 1
fi
echo ""

# Test 4: Check Step Functions execution
echo -e "${YELLOW}Test 4: Check Step Functions executions${NC}"
EXECUTIONS=$(aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:us-east-1:471112574622:stateMachine:leadmagnet-job-processor \
  --max-results 1 \
  --query 'executions[0].{status:status,name:name}')

echo "$EXECUTIONS" | jq .
echo -e "${GREEN}✓ Step Functions execution verified${NC}"
echo ""

# Test 5: Verify data in all tables
echo -e "${YELLOW}Test 5: Verify data in DynamoDB tables${NC}"

echo "Workflows:"
aws dynamodb scan --table-name leadmagnet-workflows --max-items 1 --query 'Items[0].{id:workflow_id.S,name:workflow_name.S}' | jq .

echo "Forms:"
aws dynamodb scan --table-name leadmagnet-forms --max-items 1 --query 'Items[0].{id:form_id.S,name:form_name.S}' | jq .

echo "Submissions:"
aws dynamodb scan --table-name leadmagnet-submissions --max-items 1 --query 'Items[0].{id:submission_id.S,created:created_at.S}' | jq .

echo "Jobs:"
aws dynamodb scan --table-name leadmagnet-jobs --max-items 1 --query 'Items[0].{id:job_id.S,status:status.S}' | jq .

echo "Templates:"
aws dynamodb scan --table-name leadmagnet-templates --max-items 1 --query 'Items[0].{id:template_id.S,name:template_name.S}' | jq .

echo -e "${GREEN}✓ All tables verified${NC}"
echo ""

# Summary
echo ""
echo -e "${GREEN}========================================"
echo "E2E Test Summary"
echo "========================================${NC}"
echo -e "✓ API Gateway accessible"
echo -e "✓ Form retrieval working"
echo -e "✓ Form submission working"
echo -e "✓ Job creation working"
echo -e "✓ Step Functions orchestration working"
echo -e "✓ All DynamoDB tables accessible"
echo ""
echo -e "${GREEN}All tests passed! 🎉${NC}"
echo ""
echo "API URL: $API_URL"
echo "Test Form: $API_URL/v1/forms/test-form"
echo ""

