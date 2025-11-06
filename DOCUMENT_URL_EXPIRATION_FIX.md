# Document URL Expiration Fix

## Problem
Document URLs were expiring after 7 days, causing users to see "ExpiredToken" errors when trying to view documents that were created more than a week ago.

## Solution
Implemented a multi-layered approach to ensure document URLs never expire:

### 1. Extended Expiration Time
- Changed pre-signed URL expiration from **7 days** to **1 year** (31,536,000 seconds)
- This applies to both API and Worker when generating URLs

### 2. Always Refresh URLs on Access
- **Artifacts Controller**: Always regenerates URLs when artifacts are listed or accessed
- **Jobs Controller**: Refreshes `output_url` from artifacts when a job is accessed
- This ensures that every time a document is viewed, it gets a fresh URL with 1 year expiration

### 3. Files Modified

#### `backend/api/src/controllers/artifacts.ts`
- `list()`: Always regenerates URLs for all artifacts (removed expiration check)
- `get()`: Always regenerates URL when artifact is accessed directly
- Expiration: Changed from 7 days (604800) to 1 year (31536000)

#### `backend/api/src/controllers/jobs.ts`
- `get()`: Refreshes `output_url` from artifacts when job is accessed
- Ensures job detail pages always show valid, non-expired URLs

#### `backend/worker/s3_service.py`
- `upload_artifact()`: Changed initial URL expiration from 7 days to 1 year
- Provides better UX even before API refresh

## How It Works

1. **When a document is created** (Worker):
   - Artifact is uploaded to S3
   - Pre-signed URL is generated with 1 year expiration
   - URL is stored in artifact record and job `output_url`

2. **When a document is viewed** (API):
   - User accesses job detail page or artifact list
   - API checks artifact and regenerates URL with fresh 1 year expiration
   - Updated URL is returned to frontend
   - Job `output_url` is updated in database

3. **Result**:
   - URLs effectively never expire because they're refreshed on every access
   - Even if a URL expires, accessing the job/artifact page will generate a new one
   - 1 year expiration provides buffer for cached/bookmarked URLs

## Testing

To verify the fix works:

1. Access a job detail page: `/admin/jobs/{jobId}`
2. Check that `output_url` is a fresh pre-signed URL
3. Verify URL expiration is ~1 year in the future
4. Access the URL - it should work without expiration errors

## Future Improvements

Consider using CloudFront signed URLs or making artifacts publicly accessible via CloudFront for even better performance and no expiration concerns.

