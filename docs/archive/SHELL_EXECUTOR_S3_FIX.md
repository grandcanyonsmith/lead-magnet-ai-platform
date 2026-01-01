# Shell Executor S3-Based Job Request Fix

## Problem

Step 5 (Automated Screenshot Capture) was failing with the error:
```
Container Overrides length must be at most 8192
```

### Root Cause

When Step 4 generated a large screenshot plan (many URLs, viewports, capture types), Step 5 tried to convert it into Playwright commands. The entire job request was base64-encoded and passed as an environment variable `SHELL_EXECUTOR_JOB_B64` to the ECS task. AWS ECS has a limit of 8192 characters for container overrides, and the base64-encoded job request exceeded this limit.

## Solution

Changed the shell executor contract to use S3 for storing job requests instead of passing them as environment variables:

1. **Upload job request to S3**: The orchestrator (Python worker or TypeScript API) uploads the job request JSON to S3
2. **Generate presigned GET URL**: A presigned GET URL (typically 500-800 characters) is generated for the job request
3. **Pass URL as env var**: The presigned GET URL is passed as `SHELL_EXECUTOR_JOB_GET_URL` environment variable (well under the 8192 limit)
4. **Runner fetches from S3**: The ECS task runner downloads the job request from the presigned URL

### Benefits

- ✅ **No size limit**: Job requests can be arbitrarily large (within S3 object limits)
- ✅ **Maintains security**: No IAM role needed for the task (uses presigned URLs)
- ✅ **Backward compatible**: Runner still supports legacy `SHELL_EXECUTOR_JOB_B64` and `SHELL_EXECUTOR_JOB_JSON` for migration
- ✅ **Automatic cleanup**: Both job requests and results are cleaned up after execution

## Changes Made

### Contract Version
- Updated from `2025-12-18` to `2025-12-29`

### Files Modified

1. **`backend/api/src/services/shellExecutorContract.ts`**
   - Updated contract version to `2025-12-29`

2. **`backend/worker/services/shell_executor_service.py`**
   - Uploads job request JSON to S3 (`shell-jobs/{job_id}.json`)
   - Generates presigned GET URL
   - Passes GET URL as `SHELL_EXECUTOR_JOB_GET_URL` env var
   - Removed base64 encoding
   - Added size validation (warns if GET URL exceeds 8000 chars)
   - Cleans up job request after execution or timeout

3. **`backend/api/src/services/shellExecutorService.ts`**
   - Same changes as Python version
   - Uses `GetObjectCommand` and `DeleteObjectCommand` for S3 operations

4. **`backend/shell-executor/runner.js`**
   - Updated contract version to `2025-12-29`
   - `readJobRequest()` now supports fetching from presigned GET URL
   - Maintains backward compatibility with legacy env vars
   - Made `readJobRequest()` async to support fetch

5. **`infrastructure/lib/shell-executor-stack.ts`**
   - Added lifecycle rule for `shell-jobs/` prefix (1 day expiration)

## Migration

The runner maintains backward compatibility:
- **New jobs**: Use `SHELL_EXECUTOR_JOB_GET_URL` (contract version `2025-12-29`)
- **Legacy jobs**: Still support `SHELL_EXECUTOR_JOB_B64` and `SHELL_EXECUTOR_JOB_JSON` (contract version `2025-12-18`)

## Testing

After deployment, verify:
1. ✅ Shell executor tasks can fetch job requests from S3
2. ✅ Large job requests (e.g., screenshot plans with many URLs) work correctly
3. ✅ Job requests are cleaned up after execution
4. ✅ Legacy jobs still work (if any are in flight)

## Deployment Notes

1. **Deploy infrastructure first**: Update the shell executor stack to add the lifecycle rule
2. **Deploy runner**: Update the ECS task definition with the new runner.js
3. **Deploy orchestrators**: Update Python worker and TypeScript API with new contract

The changes are backward compatible, so you can deploy in any order without breaking in-flight jobs.
