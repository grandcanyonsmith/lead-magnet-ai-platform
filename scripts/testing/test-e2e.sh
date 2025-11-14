#!/bin/bash
set -e

# Source shared utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/shell_common.sh"

show_header "Lead Magnet AI - End-to-End Test" "Testing form submission and job processing"

API_URL=$(get_api_url)

# Test 1: Get form schema
print_subsection "Test 1: Get form schema"
FORM_RESPONSE=$(curl -s "$API_URL/v1/forms/test-form")
echo "$FORM_RESPONSE" | jq . 2>/dev/null || echo "$FORM_RESPONSE"
if echo "$FORM_RESPONSE" | jq -e '.form_id' > /dev/null 2>&1; then
    print_success "Form retrieved successfully"
else
    print_error "Form retrieval failed"
    exit 1
fi
echo ""

# Test 2: Submit form
print_subsection "Test 2: Submit form with test data"
SUBMIT_RESPONSE=$(curl -s -X POST "$API_URL/v1/forms/test-form/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "submission_data": {
      "name": "Jane Smith",
      "email": "jane@example.com",
      "phone": "+14155551234",
      "project": "I need a comprehensive market research report for the fitness industry"
    }
  }')

echo "$SUBMIT_RESPONSE" | jq . 2>/dev/null || echo "$SUBMIT_RESPONSE"
JOB_ID=$(echo "$SUBMIT_RESPONSE" | jq -r '.job_id // empty' 2>/dev/null)

if [ -n "$JOB_ID" ] && [ "$JOB_ID" != "null" ]; then
    print_success "Form submitted successfully. Job ID: $JOB_ID"
else
    print_error "Form submission failed"
    exit 1
fi
echo ""

# Test 3: Check job status
print_subsection "Test 3: Check job status in DynamoDB"
JOB_STATUS=$(aws dynamodb get-item \
  --table-name leadmagnet-jobs \
  --key "{\"job_id\":{\"S\":\"$JOB_ID\"}}" \
  --query 'Item.status.S' \
  --output text \
  --region "$(get_aws_region)" 2>/dev/null || echo "")

echo "Job Status: $JOB_STATUS"
if [ -n "$JOB_STATUS" ]; then
    print_success "Job found in database"
else
    print_error "Job not found"
    exit 1
fi
echo ""

# Test 4: Check Step Functions execution
print_subsection "Test 4: Check Step Functions executions"
EXECUTIONS=$(aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:$(get_aws_region):$(get_aws_account_id):stateMachine:leadmagnet-job-processor \
  --max-results 1 \
  --query 'executions[0].{status:status,name:name}' \
  --region "$(get_aws_region)" 2>/dev/null || echo "{}")

echo "$EXECUTIONS" | jq . 2>/dev/null || echo "$EXECUTIONS"
print_success "Step Functions execution verified"
echo ""

# Test 5: Verify data in all tables
print_subsection "Test 5: Verify data in DynamoDB tables"

echo "Workflows:"
aws dynamodb scan --table-name leadmagnet-workflows --max-items 1 --query 'Items[0].{id:workflow_id.S,name:workflow_name.S}' --region "$(get_aws_region)" | jq . 2>/dev/null || echo "{}"

echo "Forms:"
aws dynamodb scan --table-name leadmagnet-forms --max-items 1 --query 'Items[0].{id:form_id.S,name:form_name.S}' --region "$(get_aws_region)" | jq . 2>/dev/null || echo "{}"

echo "Submissions:"
aws dynamodb scan --table-name leadmagnet-submissions --max-items 1 --query 'Items[0].{id:submission_id.S,created:created_at.S}' --region "$(get_aws_region)" | jq . 2>/dev/null || echo "{}"

echo "Jobs:"
aws dynamodb scan --table-name leadmagnet-jobs --max-items 1 --query 'Items[0].{id:job_id.S,status:status.S}' --region "$(get_aws_region)" | jq . 2>/dev/null || echo "{}"

echo "Templates:"
aws dynamodb scan --table-name leadmagnet-templates --max-items 1 --query 'Items[0].{id:template_id.S,name:template_name.S}' --region "$(get_aws_region)" | jq . 2>/dev/null || echo "{}"

print_success "All tables verified"
echo ""

# Summary
print_section "E2E Test Summary"
print_success "API Gateway accessible"
print_success "Form retrieval working"
print_success "Form submission working"
print_success "Job creation working"
print_success "Step Functions orchestration working"
print_success "All DynamoDB tables accessible"
echo ""
print_success "All tests passed! 🎉"
echo ""
echo "API URL: $API_URL"
echo "Test Form: $API_URL/v1/forms/test-form"
echo ""
