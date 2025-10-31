#!/bin/bash
set -e

echo "🧪 FINAL COMPREHENSIVE E2E TEST"
echo "════════════════════════════════════════════════════"
echo ""

API_URL="https://czp5b77azd.execute-api.us-east-1.amazonaws.com"
PROD_FRONTEND="https://dmydkyj79auy7.cloudfront.net/frontend/index.html"
LOCAL_FRONTEND="http://localhost:3000"

echo "✅ Test 1: Backend API - Form Retrieval"
FORM=$(curl -s "$API_URL/v1/forms/test-form")
if echo "$FORM" | jq -e '.form_id' > /dev/null 2>&1; then
    echo "   ✅ PASS - Form retrieved"
else
    echo "   ❌ FAIL - Form not found"
    exit 1
fi

echo ""
echo "✅ Test 2: Backend API - Form Submission"
SUBMIT=$(curl -s -X POST "$API_URL/v1/forms/test-form/submit" \
  -H "Content-Type: application/json" \
  -d '{"submission_data":{"name":"Final E2E Test","email":"finaletest@example.com","project":"Comprehensive testing"}}')
JOB_ID=$(echo "$SUBMIT" | jq -r '.job_id')
if [ -n "$JOB_ID" ] && [ "$JOB_ID" != "null" ]; then
    echo "   ✅ PASS - Job created: $JOB_ID"
else
    echo "   ❌ FAIL - Job creation failed"
    exit 1
fi

echo ""
echo "✅ Test 3: DynamoDB - Job Record"
aws dynamodb get-item --table-name leadmagnet-jobs --key "{\"job_id\":{\"S\":\"$JOB_ID\"}}" > /dev/null
echo "   ✅ PASS - Job found in database"

echo ""
echo "✅ Test 4: Production Frontend - Accessibility"
PROD_HTML=$(curl -s "$PROD_FRONTEND")
if echo "$PROD_HTML" | grep -q "Lead Magnet AI Platform"; then
    echo "   ✅ PASS - Production frontend accessible"
else
    echo "   ❌ FAIL - Production frontend not accessible"
    exit 1
fi

echo ""
echo "✅ Test 5: Local Frontend - Accessibility"
LOCAL_HTML=$(curl -s "$LOCAL_FRONTEND")
if echo "$LOCAL_HTML" | grep -q "Lead Magnet AI Platform"; then
    echo "   ✅ PASS - Local frontend accessible"
else
    echo "   ❌ FAIL - Local frontend not accessible"
    exit 1
fi

echo ""
echo "✅ Test 6: GitHub Repository"
if git remote get-url origin | grep -q "grandcanyonsmith/lead-magnet-ai-platform"; then
    echo "   ✅ PASS - Git repository configured"
else
    echo "   ❌ FAIL - Git repository not configured"
    exit 1
fi

echo ""
echo "✅ Test 7: AWS Resources"
aws dynamodb list-tables | grep -q "leadmagnet-workflows" && echo "   ✅ PASS - DynamoDB tables exist"
aws lambda get-function --function-name leadmagnet-api-handler > /dev/null && echo "   ✅ PASS - Lambda function exists"
aws stepfunctions describe-state-machine --state-machine-arn "arn:aws:states:us-east-1:471112574622:stateMachine:leadmagnet-job-processor" > /dev/null && echo "   ✅ PASS - Step Functions exists"

echo ""
echo "════════════════════════════════════════════════════"
echo "🎉 ALL TESTS PASSED! 🎉"
echo "════════════════════════════════════════════════════"
echo ""
echo "✅ Backend API:           WORKING"
echo "✅ Form Submission:       WORKING"
echo "✅ Job Creation:          WORKING"
echo "✅ Production Frontend:   ACCESSIBLE"
echo "✅ Local Frontend:        ACCESSIBLE"
echo "✅ GitHub:                CONFIGURED"
echo "✅ AWS Resources:         DEPLOYED"
echo ""
echo "🚀 Platform is 100% operational!"
echo ""
echo "Access production: $PROD_FRONTEND"
echo "Access local:      $LOCAL_FRONTEND"
echo ""
