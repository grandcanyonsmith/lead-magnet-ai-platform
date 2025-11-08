# Test Plan: DynamoDB Size Limit Fix and S3 Offloading

## Overview
This test plan verifies the fixes for DynamoDB item size limits and execution_steps S3 offloading functionality.

## Test Environment Setup

### Prerequisites
- AWS account with DynamoDB, S3, and Lambda access
- Test job creation capability
- Access to CloudWatch logs
- Ability to query DynamoDB directly

### Test Data Requirements
1. **Small execution_steps**: < 300KB (should be stored directly in DynamoDB)
2. **Large execution_steps**: > 300KB (should be offloaded to S3)
3. **Transition case**: Job that starts small and grows large over time

---

## Test Cases

### Test Case 1: Small Execution Steps (< 300KB)
**Objective**: Verify small execution_steps are stored directly in DynamoDB

**Steps**:
1. Create a new job with a workflow that generates small execution_steps (< 300KB)
2. Process the job through completion
3. Query DynamoDB to verify:
   - `execution_steps` field exists in DynamoDB item
   - `execution_steps_s3_key` field does NOT exist
   - `execution_steps` contains the full data

**Expected Results**:
- ✅ Job completes successfully
- ✅ `execution_steps` stored directly in DynamoDB
- ✅ No `execution_steps_s3_key` field present
- ✅ Data retrievable via API

**Verification**:
```bash
# Query DynamoDB
aws dynamodb get-item \
  --table-name leadmagnet-jobs \
  --key '{"job_id": {"S": "JOB_ID_HERE"}}' \
  --query 'Item.execution_steps'

# Should return execution_steps data, not null
```

---

### Test Case 2: Large Execution Steps (> 300KB)
**Objective**: Verify large execution_steps are automatically offloaded to S3

**Steps**:
1. Create a job with a workflow that generates large execution_steps (> 300KB)
   - Use multiple steps with extensive output
   - Include image generation steps
2. Process the job through completion
3. Verify:
   - `execution_steps_s3_key` exists in DynamoDB
   - `execution_steps` field does NOT exist in DynamoDB (removed)
   - S3 object exists at the key specified in `execution_steps_s3_key`
   - S3 object contains valid JSON with execution_steps data

**Expected Results**:
- ✅ Job completes successfully (no DynamoDB size limit error)
- ✅ `execution_steps_s3_key` stored in DynamoDB
- ✅ `execution_steps` removed from DynamoDB
- ✅ S3 object contains correct data
- ✅ API can retrieve execution_steps from S3

**Verification**:
```bash
# Check DynamoDB item
aws dynamodb get-item \
  --table-name leadmagnet-jobs \
  --key '{"job_id": {"S": "JOB_ID_HERE"}}' \
  --query 'Item.execution_steps_s3_key'

# Should return S3 key like "jobs/JOB_ID/execution_steps.json"

# Verify S3 object exists
aws s3 ls s3://ARTIFACTS_BUCKET/jobs/JOB_ID/execution_steps.json

# Download and verify content
aws s3 cp s3://ARTIFACTS_BUCKET/jobs/JOB_ID/execution_steps.json - | jq '.'
```

---

### Test Case 3: Stale S3 Key Cleanup
**Objective**: Verify stale `execution_steps_s3_key` is removed when storing small execution_steps

**Steps**:
1. Create a job that initially has large execution_steps (stored in S3)
2. Manually add `execution_steps_s3_key` to the DynamoDB item
3. Update the job with small execution_steps (< 300KB)
4. Verify:
   - `execution_steps` is stored directly in DynamoDB
   - `execution_steps_s3_key` is removed from DynamoDB
   - Old S3 object may still exist (cleanup is separate concern)

**Expected Results**:
- ✅ `execution_steps` stored directly in DynamoDB
- ✅ `execution_steps_s3_key` removed from DynamoDB item
- ✅ No data inconsistency

**Verification**:
```bash
# Check DynamoDB item after update
aws dynamodb get-item \
  --table-name leadmagnet-jobs \
  --key '{"job_id": {"S": "JOB_ID_HERE"}}' \
  --query 'Item.{execution_steps: execution_steps, execution_steps_s3_key: execution_steps_s3_key}'

# Should show execution_steps present, execution_steps_s3_key absent
```

---

### Test Case 4: API Retrieval of S3-Stored Execution Steps
**Objective**: Verify API correctly loads execution_steps from S3

**Steps**:
1. Create a job with large execution_steps (stored in S3)
2. Call the GET `/admin/jobs/{jobId}` API endpoint
3. Verify:
   - Response includes `execution_steps` field
   - `execution_steps` contains full data
   - No errors in API logs

**Expected Results**:
- ✅ API returns complete execution_steps data
- ✅ Data matches what was stored in S3
- ✅ No errors in CloudWatch logs

**Verification**:
```bash
# Call API endpoint
curl -X GET \
  "https://API_URL/admin/jobs/JOB_ID" \
  -H "Authorization: Bearer TOKEN" \
  | jq '.execution_steps | length'

# Should return number of steps > 0
```

---

### Test Case 5: Error Handling - Missing S3 Object
**Objective**: Verify graceful handling when S3 object is missing

**Steps**:
1. Create a job with `execution_steps_s3_key` pointing to non-existent S3 object
2. Call GET job API endpoint
3. Verify:
   - API handles error gracefully
   - Returns empty `execution_steps` array
   - Error logged in CloudWatch with S3 key included

**Expected Results**:
- ✅ API returns job with empty `execution_steps: []`
- ✅ Error logged with S3 key for debugging
- ✅ No exception thrown to client

**Verification**:
```bash
# Check CloudWatch logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/leadmagnet-api-handler \
  --filter-pattern "Error loading execution_steps from S3" \
  --query 'events[*].message'

# Should show error with S3 key included
```

---

### Test Case 6: Size Estimation Accuracy
**Objective**: Verify size estimation correctly identifies items > 300KB

**Steps**:
1. Create execution_steps data of various sizes:
   - ~250KB (should stay in DynamoDB)
   - ~310KB (should go to S3)
   - ~350KB (should go to S3)
2. Verify threshold behavior matches expectations

**Expected Results**:
- ✅ Items < 300KB stored in DynamoDB
- ✅ Items > 300KB stored in S3
- ✅ 10% buffer accounts for DynamoDB serialization overhead

---

### Test Case 7: Concurrent Updates
**Objective**: Verify no race conditions during concurrent updates

**Steps**:
1. Create a job
2. Simulate concurrent updates to execution_steps
3. Verify:
   - All updates succeed
   - Final state is consistent
   - No data loss

**Expected Results**:
- ✅ All updates complete successfully
- ✅ Final execution_steps reflects all updates
- ✅ No race conditions

---

## Regression Tests

### Test Case 8: Backward Compatibility
**Objective**: Verify existing jobs with execution_steps in DynamoDB still work

**Steps**:
1. Identify existing jobs with `execution_steps` stored directly in DynamoDB
2. Retrieve via API
3. Verify data is accessible

**Expected Results**:
- ✅ Existing jobs remain accessible
- ✅ No breaking changes

---

### Test Case 9: Edge Cases
**Objective**: Test edge cases and boundary conditions

**Test Scenarios**:
- Empty execution_steps array
- Execution_steps with null values
- Very large execution_steps (> 1MB)
- Multiple updates transitioning between S3 and DynamoDB

**Expected Results**:
- ✅ All edge cases handled gracefully
- ✅ No errors or data corruption

---

## Performance Tests

### Test Case 10: Large Job Processing Performance
**Objective**: Verify performance with large execution_steps

**Metrics to Monitor**:
- Job processing time
- DynamoDB write latency
- S3 upload/download latency
- API response time

**Expected Results**:
- ✅ No significant performance degradation
- ✅ S3 operations complete within acceptable time
- ✅ API response time < 2 seconds

---

## Monitoring and Validation

### CloudWatch Metrics to Monitor
- DynamoDB write throttles
- S3 request errors
- Lambda execution errors
- API 5xx errors

### Logs to Review
- Worker logs: `execution_steps stored in S3` messages
- API logs: `Error loading execution_steps from S3` messages
- DynamoDB access logs

### Success Criteria
- ✅ Zero DynamoDB ValidationException errors for item size
- ✅ All jobs complete successfully regardless of execution_steps size
- ✅ API successfully retrieves execution_steps from both DynamoDB and S3
- ✅ No data loss or corruption

---

## Test Execution Checklist

- [ ] Test Case 1: Small execution_steps (< 300KB)
- [ ] Test Case 2: Large execution_steps (> 300KB)
- [ ] Test Case 3: Stale S3 key cleanup
- [ ] Test Case 4: API retrieval from S3
- [ ] Test Case 5: Missing S3 object error handling
- [ ] Test Case 6: Size estimation accuracy
- [ ] Test Case 7: Concurrent updates
- [ ] Test Case 8: Backward compatibility
- [ ] Test Case 9: Edge cases
- [ ] Test Case 10: Performance tests

---

## Rollback Plan

If issues are discovered:
1. Revert to previous Lambda function version
2. Monitor CloudWatch logs for errors
3. Investigate root cause
4. Fix and re-test before redeployment

---

## Notes

- Size threshold is 300KB (down from 350KB) to provide safety margin
- 10% buffer added to size estimation for DynamoDB serialization overhead
- S3 objects are stored with `public=False` for security
- Old S3 objects are not automatically cleaned up (separate concern)

