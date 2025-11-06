#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Lead Magnet AI - Complete E2E Test Suite${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""

API_URL="https://czp5b77azd.execute-api.us-east-1.amazonaws.com"
REGION="us-east-1"
TENANT_ID="tenant_test_001"

# Track test results
PASSED=0
FAILED=0

# Test counter
TEST_NUM=1

# Helper function to print test results
test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ Test $TEST_NUM: $2${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ Test $TEST_NUM: $2${NC}"
        ((FAILED++))
    fi
    ((TEST_NUM++))
    echo ""
}

# Test 1: Verify required fields in form
echo -e "${YELLOW}Test $TEST_NUM: Verify required fields (name, email, phone) in form${NC}"
FORM_RESPONSE=$(curl -s "$API_URL/v1/forms/test-form")
HAS_NAME=$(echo "$FORM_RESPONSE" | jq -r '.form_fields_schema.fields[] | select(.field_id == "name") | .field_id' 2>/dev/null || echo "")
HAS_EMAIL=$(echo "$FORM_RESPONSE" | jq -r '.form_fields_schema.fields[] | select(.field_id == "email") | .field_id' 2>/dev/null || echo "")
HAS_PHONE=$(echo "$FORM_RESPONSE" | jq -r '.form_fields_schema.fields[] | select(.field_id == "phone") | .field_id' 2>/dev/null || echo "")

if [ -n "$HAS_NAME" ] && [ -n "$HAS_EMAIL" ] && [ -n "$HAS_PHONE" ]; then
    test_result 0 "Required fields present in form"
    echo "  Found: name, email, phone"
else
    test_result 1 "Required fields missing"
    echo "  Missing: name=$HAS_NAME, email=$HAS_EMAIL, phone=$HAS_PHONE"
fi

# Test 2: Submit form with all required fields
echo -e "${YELLOW}Test $TEST_NUM: Submit form with required fields${NC}"
SUBMIT_RESPONSE=$(curl -s -X POST "$API_URL/v1/forms/test-form/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "submission_data": {
      "name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "+14155551234",
      "project": "I need a market research report for fitness industry"
    }
  }')

JOB_ID=$(echo "$SUBMIT_RESPONSE" | jq -r '.job_id' 2>/dev/null || echo "")

if [ -n "$JOB_ID" ] && [ "$JOB_ID" != "null" ]; then
    test_result 0 "Form submission successful"
    echo "  Job ID: $JOB_ID"
    echo "$SUBMIT_RESPONSE" | jq .
else
    test_result 1 "Form submission failed"
    echo "$SUBMIT_RESPONSE" | jq .
    exit 1
fi

# Test 3: Verify submission includes name, email, phone
echo -e "${YELLOW}Test $TEST_NUM: Verify submission data includes required fields${NC}"
SUBMISSION_ID=$(aws dynamodb get-item \
  --region $REGION \
  --table-name leadmagnet-jobs \
  --key "{\"job_id\":{\"S\":\"$JOB_ID\"}}" \
  --query 'Item.submission_id.S' \
  --output text 2>/dev/null || echo "")

if [ -n "$SUBMISSION_ID" ]; then
    SUBMISSION_DATA=$(aws dynamodb get-item \
      --region $REGION \
      --table-name leadmagnet-submissions \
      --key "{\"submission_id\":{\"S\":\"$SUBMISSION_ID\"}}" \
      --query 'Item.submission_data.M' \
      --output json 2>/dev/null || echo "{}")
    
    SUB_NAME=$(echo "$SUBMISSION_DATA" | jq -r '.name.S // .name // ""' 2>/dev/null || echo "")
    SUB_EMAIL=$(echo "$SUBMISSION_DATA" | jq -r '.email.S // .email // ""' 2>/dev/null || echo "")
    SUB_PHONE=$(echo "$SUBMISSION_DATA" | jq -r '.phone.S // .phone // ""' 2>/dev/null || echo "")
    
    if [ -n "$SUB_NAME" ] && [ -n "$SUB_EMAIL" ] && [ -n "$SUB_PHONE" ]; then
        test_result 0 "Submission contains all required fields"
        echo "  Name: $SUB_NAME"
        echo "  Email: $SUB_EMAIL"
        echo "  Phone: $SUB_PHONE"
    else
        test_result 1 "Submission missing required fields"
        echo "  Name: $SUB_NAME"
        echo "  Email: $SUB_EMAIL"
        echo "  Phone: $SUB_PHONE"
    fi
else
    test_result 1 "Could not find submission"
fi

# Test 4: Check job status
echo -e "${YELLOW}Test $TEST_NUM: Check job status${NC}"
JOB_STATUS=$(aws dynamodb get-item \
  --region $REGION \
  --table-name leadmagnet-jobs \
  --key "{\"job_id\":{\"S\":\"$JOB_ID\"}}" \
  --query 'Item.status.S' \
  --output text 2>/dev/null || echo "")

if [ -n "$JOB_STATUS" ]; then
    test_result 0 "Job found in database"
    echo "  Status: $JOB_STATUS"
else
    test_result 1 "Job not found"
fi

# Test 5: Verify Step Functions execution
echo -e "${YELLOW}Test $TEST_NUM: Verify Step Functions execution${NC}"
EXECUTION_ARN=$(aws stepfunctions list-executions \
  --region $REGION \
  --state-machine-arn arn:aws:states:$REGION:471112574622:stateMachine:leadmagnet-job-processor \
  --max-results 1 \
  --query 'executions[0].executionArn' \
  --output text 2>/dev/null || echo "")

if [ -n "$EXECUTION_ARN" ] && [ "$EXECUTION_ARN" != "None" ]; then
    test_result 0 "Step Functions execution found"
    echo "  Execution ARN: $EXECUTION_ARN"
else
    test_result 1 "No Step Functions execution found"
fi

# Test 6: Wait for job completion and check artifacts
echo -e "${YELLOW}Test $TEST_NUM: Wait for job completion (max 60 seconds)${NC}"
MAX_WAIT=60
ELAPSED=0
COMPLETED=false

while [ $ELAPSED -lt $MAX_WAIT ]; do
    CURRENT_STATUS=$(aws dynamodb get-item \
      --region $REGION \
      --table-name leadmagnet-jobs \
      --key "{\"job_id\":{\"S\":\"$JOB_ID\"}}" \
      --query 'Item.status.S' \
      --output text 2>/dev/null || echo "unknown")
    
    if [ "$CURRENT_STATUS" = "completed" ]; then
        COMPLETED=true
        break
    elif [ "$CURRENT_STATUS" = "failed" ]; then
        ERROR_MSG=$(aws dynamodb get-item \
          --region $REGION \
          --table-name leadmagnet-jobs \
          --key "{\"job_id\":{\"S\":\"$JOB_ID\"}}" \
          --query 'Item.error_message.S' \
          --output text 2>/dev/null || echo "Unknown error")
        echo -e "${RED}  Job failed: $ERROR_MSG${NC}"
        break
    fi
    
    echo -e "${BLUE}  Waiting... ($ELAPSED/$MAX_WAIT seconds) - Status: $CURRENT_STATUS${NC}"
    sleep 5
    ELAPSED=$((ELAPSED + 5))
done

if [ "$COMPLETED" = true ]; then
    test_result 0 "Job completed successfully"
    
    # Test 7: Verify artifacts were created
    echo -e "${YELLOW}Test $TEST_NUM: Verify artifacts created${NC}"
    ARTIFACTS=$(aws dynamodb get-item \
      --region $REGION \
      --table-name leadmagnet-jobs \
      --key "{\"job_id\":{\"S\":\"$JOB_ID\"}}" \
      --query 'Item.artifacts.L[*].S' \
      --output text 2>/dev/null || echo "")
    
    OUTPUT_URL=$(aws dynamodb get-item \
      --region $REGION \
      --table-name leadmagnet-jobs \
      --key "{\"job_id\":{\"S\":\"$JOB_ID\"}}" \
      --query 'Item.output_url.S' \
      --output text 2>/dev/null || echo "")
    
    if [ -n "$ARTIFACTS" ] && [ -n "$OUTPUT_URL" ]; then
        test_result 0 "Artifacts created and output URL available"
        echo "  Output URL: $OUTPUT_URL"
        echo "  Artifacts: $ARTIFACTS"
        
        # Test 8: Verify output URL is accessible
        echo -e "${YELLOW}Test $TEST_NUM: Verify output URL is accessible${NC}"
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$OUTPUT_URL" 2>/dev/null || echo "000")
        if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "403" ]; then
            test_result 0 "Output URL is accessible (HTTP $HTTP_CODE)"
        else
            test_result 1 "Output URL not accessible (HTTP $HTTP_CODE)"
        fi
    else
        test_result 1 "Artifacts or output URL missing"
    fi
else
    test_result 1 "Job did not complete within timeout"
fi

# Test 9: Verify workflow delivery configuration
echo -e "${YELLOW}Test $TEST_NUM: Check workflow delivery configuration${NC}"
WORKFLOW_ID=$(aws dynamodb get-item \
  --region $REGION \
  --table-name leadmagnet-jobs \
  --key "{\"job_id\":{\"S\":\"$JOB_ID\"}}" \
  --query 'Item.workflow_id.S' \
  --output text 2>/dev/null || echo "")

if [ -n "$WORKFLOW_ID" ]; then
    DELIVERY_METHOD=$(aws dynamodb get-item \
      --region $REGION \
      --table-name leadmagnet-workflows \
      --key "{\"workflow_id\":{\"S\":\"$WORKFLOW_ID\"}}" \
      --query 'Item.delivery_method.S' \
      --output text 2>/dev/null || echo "none")
    
    test_result 0 "Workflow delivery configuration found"
    echo "  Delivery Method: ${DELIVERY_METHOD:-none}"
    
    if [ -n "$DELIVERY_METHOD" ] && [ "$DELIVERY_METHOD" != "none" ]; then
        echo "  ✓ Delivery configured: $DELIVERY_METHOD"
    else
        echo "  ⚠ No delivery method configured"
    fi
else
    test_result 1 "Could not find workflow"
fi

# Test 10: Verify Twilio secret exists
echo -e "${YELLOW}Test $TEST_NUM: Verify Twilio secret exists in Secrets Manager${NC}"
TWILIO_SECRET=$(aws secretsmanager get-secret-value \
  --region us-east-1 \
  --secret-id leadmagnet/twilio-credentials \
  --query 'SecretString' \
  --output text 2>/dev/null || echo "")

if [ -n "$TWILIO_SECRET" ] && [ "$TWILIO_SECRET" != "None" ]; then
    test_result 0 "Twilio secret found in Secrets Manager"
    echo "  Secret exists in us-east-1"
    
    # Verify secret structure
    HAS_ACCOUNT_SID=$(echo "$TWILIO_SECRET" | jq -r '.TWILIO_ACCOUNT_SID // ""' 2>/dev/null || echo "")
    HAS_AUTH_TOKEN=$(echo "$TWILIO_SECRET" | jq -r '.TWILIO_AUTH_TOKEN // ""' 2>/dev/null || echo "")
    HAS_PHONE=$(echo "$TWILIO_SECRET" | jq -r '.TWILIO_FROM_NUMBER // ""' 2>/dev/null || echo "")
    
    if [ -n "$HAS_ACCOUNT_SID" ] && [ -n "$HAS_AUTH_TOKEN" ] && [ -n "$HAS_PHONE" ]; then
        echo "  ✓ Secret contains all required fields"
    else
        echo "  ⚠ Secret missing some fields"
    fi
else
    test_result 1 "Twilio secret not found"
fi

# Test 11: Test form submission without required fields (should fail)
echo -e "${YELLOW}Test $TEST_NUM: Test form submission without phone (should fail)${NC}"
FAIL_RESPONSE=$(curl -s -X POST "$API_URL/v1/forms/test-form/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "submission_data": {
      "name": "Jane Doe",
      "email": "jane@example.com",
      "project": "Testing without phone"
    }
  }')

ERROR_MSG=$(echo "$FAIL_RESPONSE" | jq -r '.message // ""' 2>/dev/null || echo "")
if [[ "$ERROR_MSG" == *"phone"* ]] || [[ "$ERROR_MSG" == *"required"* ]] || [[ "$ERROR_MSG" == *"must include"* ]]; then
    test_result 0 "Validation correctly rejects submission without phone"
    echo "  Error message: $ERROR_MSG"
else
    test_result 1 "Validation did not catch missing phone field"
    echo "  Response: $FAIL_RESPONSE"
fi

# Test 12: Check Lambda logs for errors
echo -e "${YELLOW}Test $TEST_NUM: Check Lambda logs for recent errors${NC}"
RECENT_ERRORS=$(aws logs filter-log-events \
  --region $REGION \
  --log-group-name /aws/lambda/leadmagnet-job-processor \
  --start-time $(($(date +%s) - 600))000 \
  --filter-pattern "ERROR" \
  --max-items 5 \
  --query 'events[*].message' \
  --output text 2>/dev/null || echo "")

if [ -n "$RECENT_ERRORS" ]; then
    test_result 1 "Found errors in Lambda logs"
    echo "  Recent errors found in logs"
else
    test_result 0 "No recent errors in Lambda logs"
fi

# Summary
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}E2E Test Summary${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}✗ Failed: $FAILED${NC}"
else
    echo -e "${GREEN}✗ Failed: $FAILED${NC}"
fi
echo ""
echo "API URL: $API_URL"
echo "Test Form: $API_URL/v1/forms/test-form"
echo "Job ID: $JOB_ID"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}⚠ Some tests failed. Review the output above.${NC}"
    exit 1
fi

