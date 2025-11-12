# Execution Steps S3 Optimization

## Overview

This document describes the optimization implemented to fetch execution steps directly from S3 instead of loading them in the Lambda function, reducing memory usage and API response size.

## Problem

Previously, execution steps were loaded from S3 in the backend API Lambda function and included in the API response. This caused:
- Increased Lambda memory usage
- Larger API response sizes
- Slower API responses
- Risk of hitting Lambda memory limits for jobs with many execution steps

Additionally, HTML generation output was truncated to 5000 characters, causing incomplete HTML pages to be stored.

## Solution

### Backend Changes

1. **Presigned URL Generation** (`backend/api/src/controllers/jobs.ts`)
   - Generate presigned URLs for execution steps stored in S3
   - Always generate URL when `execution_steps_s3_key` exists, even if some steps are in DynamoDB
   - Frontend fetches execution steps directly from S3 using the presigned URL

2. **HTML Output Truncation Removal** (`backend/worker/services/execution_step_manager.py`)
   - Removed 5000 character truncation from HTML generation output
   - Full HTML output is now stored (automatically moved to S3 if exceeds DynamoDB limits)

### Frontend Changes

1. **S3 Fetch Logic** (`frontend/src/hooks/useJobDetail.ts`)
   - Fetch execution steps from S3 when `execution_steps_s3_url` is present
   - S3 data takes precedence over DynamoDB data (S3 has complete set, DynamoDB may have partial)
   - Graceful fallback to DynamoDB data if S3 fetch fails

2. **Cost Formatting Fix** (`frontend/src/components/jobs/ExecutionSteps.tsx`)
   - Handle both number and string types for `cost_usd` field
   - S3 data may have different format than DynamoDB data

## Benefits

- **Reduced Lambda Memory Usage**: Execution steps no longer loaded in Lambda function
- **Smaller API Responses**: Only presigned URL returned instead of full execution steps
- **Faster API Responses**: No need to download and parse large JSON from S3 in Lambda
- **Complete HTML Output**: Full HTML pages stored without truncation
- **Better Scalability**: Can handle jobs with many execution steps without hitting Lambda limits

## Implementation Details

### Backend Flow

1. API receives request for job details
2. Checks if `execution_steps_s3_key` exists in DynamoDB
3. Generates presigned URL (1 hour expiration)
4. Returns job data with `execution_steps_s3_url` field
5. Frontend fetches execution steps directly from S3

### Frontend Flow

1. Fetch job data from API
2. Check if `execution_steps_s3_url` exists
3. Fetch execution steps from S3 using presigned URL
4. Replace DynamoDB execution steps with S3 data (if available)
5. Display all execution steps in UI

### Data Storage

- **DynamoDB**: May contain partial execution steps (first 5 steps) if total exceeds 400KB
- **S3**: Contains complete execution steps (all steps, including full HTML output)
- **Priority**: S3 data is always preferred when available

## Files Modified

### Backend
- `backend/api/src/controllers/jobs.ts` - Presigned URL generation
- `backend/worker/services/execution_step_manager.py` - Removed HTML truncation
- `backend/worker/legacy_processor.py` - Removed HTML truncation

### Frontend
- `frontend/src/hooks/useJobDetail.ts` - S3 fetch logic
- `frontend/src/components/jobs/ExecutionSteps.tsx` - Cost formatting fix
- `frontend/src/app/dashboard/jobs/[id]/page-client.tsx` - Removed debug logs

## Testing

To test the implementation:

1. Create a job with many execution steps (or large HTML output)
2. Verify execution steps are stored in S3 (`execution_steps_s3_key` exists)
3. Check API response includes `execution_steps_s3_url`
4. Verify frontend fetches and displays all execution steps
5. Confirm HTML output is complete (not truncated)

## Backward Compatibility

- Jobs with execution steps in DynamoDB only: Still work (no S3 URL generated)
- Jobs with execution steps in S3: New behavior (presigned URL generated)
- Jobs with both: S3 data takes precedence (complete set)

## Future Improvements

- Consider caching presigned URLs in frontend
- Add retry logic for S3 fetch failures
- Monitor S3 fetch performance and errors
- Consider CloudFront for execution steps if access patterns warrant it

