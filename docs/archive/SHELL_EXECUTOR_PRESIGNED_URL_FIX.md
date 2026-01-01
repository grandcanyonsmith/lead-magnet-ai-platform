# Shell Executor Presigned URL Expiration Fix

## Problem

Shell executor tasks were failing with:
```
Failed to upload result: HTTP 500 Internal Server Error
```

### Root Cause

The presigned PUT URL for uploading results had an expiration of only **300 seconds (5 minutes)**, but:
- Shell executor tasks can take up to **20 minutes per command** (based on `SHELL_EXECUTOR_TIMEOUT_MS`)
- Lambda functions wait up to **600 seconds (10 minutes)** for results (or up to Lambda timeout of 15 minutes)
- If a task takes longer than 5 minutes to complete, the presigned URL expires before the task can upload the result

## Solution

Increased presigned PUT URL expiration from **300 seconds (5 minutes)** to **1800 seconds (30 minutes)** to ensure the URL remains valid even for long-running tasks.

### Changes Made

1. **`backend/worker/services/shell_executor_service.py`**
   - Changed `ExpiresIn=300` → `ExpiresIn=1800` for result PUT URL

2. **`backend/api/src/services/shellExecutorService.ts`**
   - Changed `expiresIn: 300` → `expiresIn: 1800` for result PUT URL

## Why 30 Minutes?

- Maximum task duration: 20 minutes per command (configurable via `SHELL_EXECUTOR_TIMEOUT_MS`)
- Multiple commands: Tasks can have multiple commands, potentially taking longer
- Buffer: 10-minute buffer ensures URL doesn't expire even for edge cases
- S3 limit: S3 presigned URLs can be valid for up to 7 days, so 30 minutes is well within limits

## Deployment

This fix is included in the same deployment as the S3-based job request fix. After deploying:

1. **Deploy Worker** (Python Lambda) - Contains the updated presigned URL expiration
2. **Deploy API** (TypeScript Lambda) - Contains the updated presigned URL expiration

No infrastructure changes needed - this is purely a code change.

## Verification

After deployment, monitor shell executor tasks:

```bash
# Check recent shell executor logs
aws logs tail /aws/ecs/leadmagnet-shell-executor --follow --region us-east-1

# Look for successful uploads (no more HTTP 500 errors)
# Should see: "shell-executor completed" messages
```

## Related Issues

This fix works together with the S3-based job request fix:
- **S3 job request fix**: Prevents "Container Overrides length must be at most 8192" errors
- **Presigned URL fix**: Prevents "Failed to upload result: HTTP 500" errors

Both fixes are needed for shell executor to work reliably with large, long-running tasks.
