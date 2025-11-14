#!/bin/bash

# Test script for Quick Edit Step feature
# This tests the API endpoint directly

echo "Testing Quick Edit Step API Endpoint"
echo "====================================="
echo ""

# Get the first job ID (you'll need to replace this with an actual job ID)
JOB_ID="${1:-}"
if [ -z "$JOB_ID" ]; then
    echo "Usage: ./scripts/test-quick-edit.sh <job_id> [step_order]"
    echo ""
    echo "To find a job ID, check the jobs list in the dashboard."
    exit 1
fi

STEP_ORDER="${2:-1}"
API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3001}"

echo "Job ID: $JOB_ID"
echo "Step Order: $STEP_ORDER"
echo "API URL: $API_URL"
echo ""

# Note: This requires authentication token
# In a real test, you'd need to get the auth token from localStorage or cookies
echo "To test manually:"
echo "1. Open browser DevTools (F12)"
echo "2. Go to Application > Local Storage > http://localhost:3000"
echo "3. Find 'authToken' or similar key"
echo "4. Copy the token value"
echo ""
echo "Then run:"
echo "curl -X POST $API_URL/admin/jobs/$JOB_ID/quick-edit-step \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN_HERE' \\"
echo "  -d '{\"step_order\": $STEP_ORDER, \"user_prompt\": \"Make the tone more professional\", \"save\": false}'"
echo ""

