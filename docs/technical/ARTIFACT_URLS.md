# Artifact URLs

This document explains how artifact URLs are generated and managed in the Lead Magnet AI platform.

## Overview

Artifacts (generated files) are stored in S3 and accessed via public URLs. The system supports two URL types:

1. **CloudFront URLs** (preferred): Non-expiring URLs served via AWS CloudFront CDN
2. **Presigned URLs** (fallback): Expiring URLs (max 7 days) generated from S3

## URL Types

### CloudFront URLs

**Format:**
```
https://{cloudfront-domain}/{s3-key}
```

**Example:**
```
https://d1234567890.cloudfront.net/jobs/job_123/execution_steps.json
```

**Characteristics:**
- ✅ Non-expiring (permanent)
- ✅ Faster delivery (CDN caching)
- ✅ Lower cost (CloudFront pricing)
- ✅ Requires CloudFront distribution configured

**When Used:**
- When `CLOUDFRONT_DOMAIN` environment variable is set
- Preferred method for all artifacts

### Presigned URLs

**Format:**
```
https://{bucket}.s3.amazonaws.com/{key}?X-Amz-Algorithm=...&X-Amz-Signature=...
```

**Example:**
```
https://leadmagnet-artifacts.s3.amazonaws.com/jobs/job_123/execution_steps.json?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=...
```

**Characteristics:**
- ⚠️ Expiring (maximum 7 days per AWS limits)
- ⚠️ Slower delivery (direct S3 access)
- ⚠️ Higher cost (S3 data transfer)
- ✅ Works without CloudFront configuration

**When Used:**
- When `CLOUDFRONT_DOMAIN` is not set
- Fallback when CloudFront is unavailable

## URL Generation Logic

The `ArtifactUrlService` class handles URL generation:

```typescript
// Simplified logic
if (CLOUDFRONT_DOMAIN) {
  return CloudFront URL (non-expiring)
} else {
  return Presigned URL (expiring, 7 days max)
}
```

### Code Location

- **Service**: `backend/api/src/services/artifactUrlService.ts`
- **Usage**: `backend/api/src/controllers/jobs.ts`, `backend/api/src/controllers/artifacts.ts`

## URL Refresh

### When URLs Are Refreshed

1. **On Job Retrieval**: When fetching job details, output URLs are refreshed if expired
2. **On Artifact Retrieval**: When fetching artifact details, URLs are refreshed if expired
3. **Automatic Detection**: System checks if URL is presigned and expired

### Refresh Logic

```typescript
// Check if URL needs refresh
if (isPresignedUrl(url) && isExpired(url)) {
  // Generate new URL
  const newUrl = await ArtifactUrlService.generateUrl(s3Key);
  // Update database
  await updateArtifact(artifactId, { public_url: newUrl });
}
```

## Execution Steps URLs

Execution steps are **always stored in S3** and accessed via URLs:

1. **Storage**: Execution steps JSON stored at `jobs/{job_id}/execution_steps.json`
2. **URL Generation**: Generated when job is retrieved via API
3. **Frontend Fetch**: Frontend fetches execution steps directly from S3 URL

### Code Flow

```typescript
// Backend: Generate URL
if (job.execution_steps_s3_key) {
  const url = await generateExecutionStepsUrl(job.execution_steps_s3_key);
  job.execution_steps_s3_url = url;
}

// Frontend: Fetch from URL
if (data.execution_steps_s3_url) {
  const response = await fetch(data.execution_steps_s3_url);
  const executionSteps = await response.json();
}
```

## Artifact URLs

Artifacts (research reports, HTML deliverables, etc.) are stored in S3 and accessed via URLs:

1. **Storage**: Artifacts stored at various S3 paths
2. **URL Generation**: Generated when artifact is created or retrieved
3. **Public Access**: Artifacts are stored as public objects for direct access

### Artifact Types

- `report_markdown`: Research reports
- `html_final`: Final HTML deliverables
- `step_output`: Individual step outputs

## Configuration

### CloudFront Setup

1. **Environment Variable**: Set `CLOUDFRONT_DOMAIN` to your CloudFront distribution domain
2. **S3 Bucket**: Configure CloudFront to serve from artifacts S3 bucket
3. **Public Access**: Ensure S3 objects are publicly accessible

### Presigned URL Setup

1. **No Configuration**: Works automatically if CloudFront not configured
2. **Expiration**: Defaults to 7 days (604800 seconds)
3. **IAM Permissions**: Requires `s3:GetObject` permission

## Best Practices

1. **Use CloudFront**: Configure CloudFront for production environments
2. **Monitor Expiration**: Check presigned URL expiration dates
3. **Refresh URLs**: Automatically refresh expired URLs on access
4. **Public Objects**: Store artifacts as public objects for CloudFront access
5. **Error Handling**: Handle URL generation failures gracefully

## Troubleshooting

### URLs Not Generating

1. Check `CLOUDFRONT_DOMAIN` is set correctly (if using CloudFront)
2. Verify S3 bucket permissions
3. Check IAM permissions for presigned URL generation
4. Review CloudWatch logs for errors

### URLs Expiring

1. Use CloudFront URLs (non-expiring)
2. Implement URL refresh logic
3. Monitor expiration dates
4. Set longer expiration for presigned URLs (max 7 days)

### CloudFront Not Working

1. Verify CloudFront distribution is active
2. Check S3 bucket origin configuration
3. Verify public access to S3 objects
4. Check CloudFront cache behavior
5. Review CloudFront access logs

## Code Examples

### Generate URL

```typescript
import { ArtifactUrlService } from '../services/artifactUrlService';

// Generate URL for S3 key
const { url, expiresAt } = await ArtifactUrlService.generateUrl('jobs/job_123/artifact.html');

// Check if URL is presigned
const isPresigned = ArtifactUrlService.isPresignedUrl(url);

// Refresh URL if needed
if (ArtifactUrlService.needsUrlRefresh(artifact)) {
  const { url: newUrl } = await ArtifactUrlService.refreshUrl(artifact);
}
```

### Check URL Type

```typescript
// Check if URL is presigned (expiring)
const isPresigned = ArtifactUrlService.isPresignedUrl(url);

// Check if URL needs refresh
const needsRefresh = ArtifactUrlService.needsUrlRefresh(artifact);
```

## Related Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [Execution Paths](./EXECUTION_PATHS.md)
- [Glossary](./GLOSSARY.md)

