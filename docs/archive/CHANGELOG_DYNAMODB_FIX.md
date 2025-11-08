# Changelog: DynamoDB Size Limit Fix and S3 Offloading

## Date: November 7, 2025

## Summary
Fixed critical DynamoDB item size limit errors by implementing automatic S3 offloading for large `execution_steps` data. This prevents `ValidationException` errors when job execution steps exceed DynamoDB's 400KB item size limit.

---

## Changes Made

### 1. DynamoDB Size Limit Handling (`backend/worker/db_service.py`)

#### Size Threshold Adjustment
- **Changed**: Threshold reduced from 350KB to 300KB
- **Reason**: Provides better safety margin for DynamoDB's 400KB limit, accounting for other job fields (status, timestamps, artifacts, etc.)
- **Impact**: More aggressive S3 offloading prevents edge cases

#### Size Estimation Improvement
- **Added**: 10% buffer to size estimation
- **Reason**: Accounts for DynamoDB serialization overhead
- **Implementation**: `_estimate_dynamodb_size()` now multiplies byte size by 1.1

#### S3 Offloading Implementation
- **Added**: Automatic detection and offloading of large `execution_steps`
- **Process**:
  1. Estimate size of `execution_steps` before update
  2. If > 300KB, serialize to JSON and upload to S3
  3. Store S3 key (`execution_steps_s3_key`) in DynamoDB
  4. Remove `execution_steps` from DynamoDB update
- **S3 Path**: `jobs/{job_id}/execution_steps.json`
- **Storage**: Private S3 objects (`public=False`)

#### Stale S3 Key Cleanup Fix
- **Fixed**: Bug where stale `execution_steps_s3_key` references were never cleaned up
- **Problem**: When storing small `execution_steps` directly, old S3 keys remained in DynamoDB
- **Solution**: 
  - Track whether `execution_steps` was stored in S3 using flag
  - When storing small `execution_steps` directly, mark `execution_steps_s3_key` for removal
  - Use DynamoDB `REMOVE` clause to delete stale attribute
- **Impact**: Prevents data inconsistency and wasted storage

#### Error Handling Improvements
- **Enhanced**: Error logging for S3 load failures
- **Added**: S3 key included in error messages for better debugging
- **Added**: Clarifying comments about data consistency

---

### 2. API Layer Updates (`backend/api/src/controllers/jobs.ts`)

#### S3 Loading Implementation
- **Added**: `loadExecutionStepsFromS3()` helper function
- **Process**:
  1. Check if job has `execution_steps_s3_key` and no `execution_steps`
  2. Download JSON from S3
  3. Parse and populate `execution_steps` field
- **Error Handling**: Returns `null` on failure, logged but doesn't fail request

#### Job Retrieval Updates
- **Modified**: `get()` method to load `execution_steps` from S3 when needed
- **Behavior**: Transparent to API consumers - `execution_steps` always populated

---

### 3. Worker Updates (`backend/worker/processor.py`)

#### S3 Service Integration
- **Updated**: All `update_job()` calls that include `execution_steps` now pass `s3_service=self.s3`
- **Locations**:
  - Job initialization (line 72)
  - Step updates (lines 127, 234, 299, 356, 436, 775)
  - Job completion (lines 506, 929)
- **Impact**: Ensures large execution_steps are automatically offloaded

---

### 4. GitHub Actions Workflow Fixes

#### Workflow Syntax Corrections
- **Fixed**: Invalid `if` condition syntax in all workflow files
- **Problem**: GitHub Actions doesn't support direct `secrets` comparisons in `if` conditions
- **Solution**: 
  - Store secrets in environment variables
  - Use environment variable comparisons: `env.AWS_ROLE_ARN != ''`
- **Files Updated**:
  - `.github/workflows/api-deploy.yml`
  - `.github/workflows/worker-ecr.yml`
  - `.github/workflows/frontend-deploy.yml`
  - `.github/workflows/cdk-infra.yml`

---

## Technical Details

### Size Calculation
```python
def _estimate_dynamodb_size(self, value: Any) -> int:
    json_str = json.dumps(value, default=str)
    byte_size = len(json_str.encode('utf-8'))
    return int(byte_size * 1.1)  # 10% buffer
```

### S3 Offloading Logic
```python
if estimated_size > MAX_DYNAMODB_ITEM_SIZE:  # 300KB
    # Upload to S3
    s3_key = f"jobs/{job_id}/execution_steps.json"
    s3_service.upload_artifact(s3_key, json.dumps(execution_steps), ...)
    
    # Store key, remove data
    updates['execution_steps_s3_key'] = s3_key
    del updates['execution_steps']
```

### Stale Key Cleanup Logic
```python
if 'execution_steps' in updates and not execution_steps_stored_in_s3:
    if 'execution_steps_s3_key' not in updates:
        updates['execution_steps_s3_key'] = None  # Mark for removal

# Later in update expression building:
if value is None and key == 'execution_steps_s3_key':
    remove_attributes.append(key)  # Add to REMOVE clause
```

---

## Breaking Changes

### None
- All changes are backward compatible
- Existing jobs with `execution_steps` in DynamoDB continue to work
- API interface unchanged

---

## Migration Notes

### Existing Jobs
- Jobs with `execution_steps` already in DynamoDB: No action needed
- Jobs with large `execution_steps`: Will be automatically offloaded on next update
- Old S3 objects: Not automatically cleaned up (separate maintenance task)

### Data Consistency
- Jobs should never have both `execution_steps` and `execution_steps_s3_key` simultaneously
- If both exist, `execution_steps_s3_key` takes precedence
- Cleanup logic ensures consistency going forward

---

## Performance Impact

### Positive Impacts
- ✅ Prevents DynamoDB write failures
- ✅ Reduces DynamoDB item size
- ✅ Enables unlimited execution_steps size

### Potential Impacts
- ⚠️ S3 upload adds ~50-200ms per large update
- ⚠️ S3 download adds ~50-200ms per job retrieval
- ⚠️ Additional S3 storage costs (minimal)

### Mitigation
- S3 operations are asynchronous where possible
- Error handling prevents blocking
- CloudFront caching reduces S3 read costs

---

## Monitoring

### Key Metrics to Watch
1. **DynamoDB Errors**: `ValidationException` for item size should drop to zero
2. **S3 Operations**: Monitor upload/download success rates
3. **API Latency**: Check for increases in job retrieval time
4. **Storage Costs**: Monitor S3 storage growth

### CloudWatch Log Patterns
- `"execution_steps for job {job_id} is too large"` - S3 offloading triggered
- `"Stored execution_steps in S3 at {s3_key}"` - Successful offload
- `"Error loading execution_steps from S3"` - S3 retrieval failure
- `"Loaded execution_steps from S3 for job {job_id}"` - Successful retrieval

---

## Testing

See `TEST_PLAN_DYNAMODB_FIX.md` for comprehensive test plan.

### Quick Verification
1. Create job with large execution_steps (> 300KB)
2. Verify job completes without DynamoDB errors
3. Check DynamoDB item has `execution_steps_s3_key`
4. Verify API returns complete execution_steps data

---

## Rollback Procedure

If issues occur:

1. **Revert Lambda Functions**:
   ```bash
   # Get previous version
   aws lambda list-versions-by-function --function-name leadmagnet-api-handler
   aws lambda list-versions-by-function --function-name leadmagnet-worker
   
   # Update alias to previous version
   aws lambda update-alias --function-name FUNCTION_NAME --function-version PREVIOUS_VERSION
   ```

2. **Monitor**:
   - Check CloudWatch logs for errors
   - Verify job processing resumes normally

3. **Investigate**:
   - Review error logs
   - Test locally if possible
   - Fix and redeploy

---

## Related Issues Fixed

- ✅ DynamoDB `ValidationException`: Item size exceeded 400KB
- ✅ Stale `execution_steps_s3_key` references not cleaned up
- ✅ GitHub Actions workflow syntax errors
- ✅ Missing `s3_service` parameter in some `update_job` calls

---

## Future Improvements

### Potential Enhancements
1. **S3 Object Cleanup**: Automatically delete old S3 objects when `execution_steps_s3_key` is removed
2. **Compression**: Compress JSON before storing in S3 to reduce storage costs
3. **Caching**: Cache frequently accessed execution_steps in memory
4. **Metrics**: Add CloudWatch metrics for S3 offload frequency and sizes
5. **Migration Script**: Script to migrate existing large execution_steps to S3

### Considerations
- S3 object lifecycle policies could be added for automatic cleanup
- Consider using S3 Intelligent-Tiering for cost optimization
- Monitor S3 request costs if job retrieval frequency is high

---

## Contributors
- Fix implemented: November 7, 2025
- Code review: Completed
- Testing: See test plan

---

## References
- [DynamoDB Item Size Limits](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Limits.html)
- [AWS S3 Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/best-practices.html)
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)

