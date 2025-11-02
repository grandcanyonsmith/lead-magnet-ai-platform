#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧪 Testing Artifact Creation${NC}"
echo "=========================================="
echo ""

API_URL="https://czp5b77azd.execute-api.us-east-1.amazonaws.com"

# Step 1: Submit a form to trigger job creation
echo -e "${YELLOW}Step 1: Submitting form to trigger job...${NC}"
SUBMIT_RESPONSE=$(curl -s -X POST "$API_URL/v1/forms/test-form/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "submission_data": {
      "name": "Artifact Test User",
      "email": "artifact-test@example.com",
      "project": "I need a comprehensive market research report for testing artifact creation"
    }
  }')

echo "$SUBMIT_RESPONSE" | jq .
JOB_ID=$(echo "$SUBMIT_RESPONSE" | jq -r '.job_id')

if [ -z "$JOB_ID" ] || [ "$JOB_ID" == "null" ]; then
    echo -e "${RED}✗ Failed to create job${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Job created: $JOB_ID${NC}"
echo ""

# Step 2: Wait for job to process (poll for completion)
echo -e "${YELLOW}Step 2: Waiting for job to process...${NC}"
MAX_WAIT=300  # 5 minutes max wait
WAIT_TIME=0
INTERVAL=10

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    JOB_DATA=$(aws dynamodb get-item \
        --table-name leadmagnet-jobs \
        --key "{\"job_id\":{\"S\":\"$JOB_ID\"}}" \
        --region us-east-1 \
        --output json 2>/dev/null || echo '{}')
    
    STATUS=$(echo "$JOB_DATA" | jq -r '.Item.status.S // "pending"')
    
    echo "  Status: $STATUS (waited ${WAIT_TIME}s)"
    
    if [ "$STATUS" == "completed" ]; then
        echo -e "${GREEN}✓ Job completed!${NC}"
        break
    elif [ "$STATUS" == "failed" ]; then
        ERROR_MSG=$(echo "$JOB_DATA" | jq -r '.Item.error_message.S // "Unknown error"')
        echo -e "${RED}✗ Job failed: $ERROR_MSG${NC}"
        echo "$JOB_DATA" | jq .
        exit 1
    fi
    
    sleep $INTERVAL
    WAIT_TIME=$((WAIT_TIME + INTERVAL))
done

if [ $WAIT_TIME -ge $MAX_WAIT ]; then
    echo -e "${RED}✗ Job timed out after $MAX_WAIT seconds${NC}"
    exit 1
fi

echo ""

# Step 3: Check job output_url
echo -e "${YELLOW}Step 3: Checking job output_url...${NC}"
JOB_DATA=$(aws dynamodb get-item \
    --table-name leadmagnet-jobs \
    --key "{\"job_id\":{\"S\":\"$JOB_ID\"}}" \
    --region us-east-1 \
    --output json)

OUTPUT_URL=$(echo "$JOB_DATA" | jq -r '.Item.output_url.S // empty')
ARTIFACTS=$(echo "$JOB_DATA" | jq -r '.Item.artifacts.L // []')

if [ -n "$OUTPUT_URL" ]; then
    echo -e "${GREEN}✓ Job has output_url: $OUTPUT_URL${NC}"
else
    echo -e "${RED}✗ Job missing output_url!${NC}"
fi

if [ "$ARTIFACTS" != "[]" ] && [ "$ARTIFACTS" != "null" ]; then
    ARTIFACT_COUNT=$(echo "$ARTIFACTS" | jq 'length')
    echo -e "${GREEN}✓ Job has $ARTIFACT_COUNT artifact(s) referenced${NC}"
    echo "$ARTIFACTS" | jq .
else
    echo -e "${YELLOW}⚠ Job has no artifacts array (may be normal)${NC}"
fi

echo ""

# Step 4: Query artifacts table for this job
echo -e "${YELLOW}Step 4: Checking artifacts table...${NC}"
ARTIFACTS=$(aws dynamodb query \
    --table-name leadmagnet-artifacts \
    --index-name gsi_job_id \
    --key-condition-expression "job_id = :jid" \
    --expression-attribute-values "{\":jid\":{\"S\":\"$JOB_ID\"}}" \
    --region us-east-1 \
    --output json 2>/dev/null || echo '{"Items":[]}')

ARTIFACT_COUNT=$(echo "$ARTIFACTS" | jq '.Items | length')

if [ "$ARTIFACT_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Found $ARTIFACT_COUNT artifact(s) in database${NC}"
    echo ""
    echo "Artifacts:"
    echo "$ARTIFACTS" | jq '.Items[] | {
        artifact_id: .artifact_id.S,
        artifact_type: .artifact_type.S,
        artifact_name: .artifact_name.S,
        public_url: .public_url.S,
        s3_key: .s3_key.S,
        file_size_bytes: .file_size_bytes.N
    }'
    
    echo ""
    echo -e "${YELLOW}Step 5: Testing artifact URLs...${NC}"
    
    # Test each artifact URL
    echo "$ARTIFACTS" | jq -r '.Items[] | select(.public_url.S != null) | .public_url.S' | while read -r url; do
        if [ -n "$url" ]; then
            echo "  Testing: $url"
            HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" || echo "000")
            if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "403" ]; then
                echo -e "    ${GREEN}✓ URL accessible (HTTP $HTTP_CODE)${NC}"
            else
                echo -e "    ${RED}✗ URL not accessible (HTTP $HTTP_CODE)${NC}"
            fi
        fi
    done
    
else
    echo -e "${RED}✗ No artifacts found in database!${NC}"
    echo ""
    echo "Checking if artifacts table exists and has correct index..."
    aws dynamodb describe-table --table-name leadmagnet-artifacts --region us-east-1 --query 'Table.{TableName:TableName,GlobalSecondaryIndexes:GlobalSecondaryIndexes[].IndexName}' 2>/dev/null || echo "Table description failed"
fi

echo ""

# Step 6: Check S3 bucket for artifacts
echo -e "${YELLOW}Step 6: Checking S3 bucket for artifacts...${NC}"
BUCKET_NAME="leadmagnet-artifacts-471112574622"
S3_PREFIX=$(echo "$JOB_DATA" | jq -r '.Item.tenant_id.S // "unknown"')

if [ "$S3_PREFIX" != "unknown" ]; then
    S3_PREFIX="${S3_PREFIX}/jobs/${JOB_ID}/"
    echo "Checking S3 prefix: s3://${BUCKET_NAME}/${S3_PREFIX}"
    
    S3_OBJECTS=$(aws s3 ls "s3://${BUCKET_NAME}/${S3_PREFIX}" --recursive --region us-east-1 2>/dev/null || echo "")
    
    if [ -n "$S3_OBJECTS" ]; then
        echo -e "${GREEN}✓ Found S3 objects:${NC}"
        echo "$S3_OBJECTS" | while read -r line; do
            echo "  $line"
        done
    else
        echo -e "${RED}✗ No S3 objects found at prefix${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Could not determine tenant_id from job${NC}"
fi

echo ""

# Summary
echo ""
echo -e "${BLUE}=========================================="
echo "Test Summary"
echo "==========================================${NC}"
if [ -n "$OUTPUT_URL" ] && [ "$ARTIFACT_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Artifact creation test PASSED!${NC}"
    echo ""
    echo "Job ID: $JOB_ID"
    echo "Output URL: $OUTPUT_URL"
    echo "Artifacts created: $ARTIFACT_COUNT"
    echo ""
    echo "You can view the artifact at: $OUTPUT_URL"
    exit 0
else
    echo -e "${RED}❌ Artifact creation test FAILED!${NC}"
    echo ""
    echo "Issues found:"
    [ -z "$OUTPUT_URL" ] && echo "  - Job missing output_url"
    [ "$ARTIFACT_COUNT" -eq 0 ] && echo "  - No artifacts found in database"
    exit 1
fi

