import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { db } from '../utils/db';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';

const ARTIFACTS_TABLE = process.env.ARTIFACTS_TABLE!;
const ARTIFACTS_BUCKET = process.env.ARTIFACTS_BUCKET!;
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN?.trim() || '';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Check if a URL is a presigned S3 URL (contains X-Amz- query parameters)
 */
function isPresignedUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.has('X-Amz-Algorithm') || urlObj.searchParams.has('X-Amz-Signature');
  } catch {
    return false;
  }
}

/**
 * Generate a CloudFront URL for an S3 key
 */
function generateCloudFrontUrl(s3Key: string): string {
  return `https://${CLOUDFRONT_DOMAIN}/${s3Key}`;
}

/**
 * Generate a presigned URL as fallback when CloudFront is not available
 */
async function generatePresignedUrl(s3Key: string): Promise<{ url: string; expiresAt: string }> {
  const command = new GetObjectCommand({
    Bucket: ARTIFACTS_BUCKET,
    Key: s3Key,
  });
  
  // Use 7 days expiration as fallback
  const expiresIn = 604800;
  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  
  return { url: presignedUrl, expiresAt };
}

class ArtifactsController {
  async list(tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse> {
    const jobId = queryParams.job_id;
    const artifactType = queryParams.artifact_type;
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;

    let artifacts;
    if (jobId) {
      artifacts = await db.query(
        ARTIFACTS_TABLE,
        'gsi_job_id',
        'job_id = :job_id',
        { ':job_id': jobId },
        undefined,
        limit
      );
    } else if (artifactType) {
      artifacts = await db.query(
        ARTIFACTS_TABLE,
        'gsi_tenant_type',
        'tenant_id = :tenant_id AND artifact_type = :artifact_type',
        { ':tenant_id': tenantId, ':artifact_type': artifactType },
        undefined,
        limit
      );
    } else {
      artifacts = await db.query(
        ARTIFACTS_TABLE,
        'gsi_tenant_type',
        'tenant_id = :tenant_id',
        { ':tenant_id': tenantId },
        undefined,
        limit
      );
    }

    // Filter out report.md artifacts - they're for internal use only
    artifacts = artifacts.filter((artifact: any) => {
      const fileName = artifact.artifact_name || artifact.file_name || '';
      return !fileName.includes('report.md') && artifact.artifact_type !== 'report_markdown';
    });

    // Ensure all artifacts have accessible URLs
    // Use CloudFront URLs (non-expiring) when available, fallback to presigned URLs
    const artifactsWithUrls = await Promise.all(
      artifacts.map(async (artifact: any) => {
        if (!artifact.s3_key) {
          return {
            ...artifact,
            object_url: artifact.public_url || null,
            file_name: artifact.artifact_name || artifact.file_name,
            size_bytes: artifact.file_size_bytes ? parseInt(artifact.file_size_bytes) : artifact.size_bytes,
          };
        }

        try {
          // Check if artifact already has a valid CloudFront URL
          const hasValidCloudFrontUrl = artifact.public_url && 
            !isPresignedUrl(artifact.public_url) &&
            artifact.public_url.startsWith('https://');
          
          // Check if artifact has expired presigned URL or needs replacement
          const hasExpiredPresignedUrl = isPresignedUrl(artifact.public_url) &&
            (artifact.url_expires_at && new Date(artifact.url_expires_at) < new Date());
          
          const needsUrlUpdate = !artifact.public_url || hasExpiredPresignedUrl || isPresignedUrl(artifact.public_url);

          if (hasValidCloudFrontUrl && !needsUrlUpdate) {
            // Already has a valid CloudFront URL, use it
            return {
              ...artifact,
              object_url: artifact.public_url,
              file_name: artifact.artifact_name || artifact.file_name,
              size_bytes: artifact.file_size_bytes ? parseInt(artifact.file_size_bytes) : artifact.size_bytes,
            };
          }

          // Generate new URL
          let objectUrl: string;
          let updateData: any = {};

          if (CLOUDFRONT_DOMAIN) {
            // Use CloudFront URL (non-expiring)
            objectUrl = generateCloudFrontUrl(artifact.s3_key);
            // CloudFront URLs don't expire, so we don't set url_expires_at
            updateData = {
              public_url: objectUrl,
              url_expires_at: null, // Clear expiration for CloudFront URLs
            };
          } else {
            // Fallback to presigned URL if CloudFront is not configured
            const { url, expiresAt } = await generatePresignedUrl(artifact.s3_key);
            objectUrl = url;
            updateData = {
              public_url: url,
              url_expires_at: expiresAt,
            };
          }

          // Update artifact in database with new URL
          await db.update(ARTIFACTS_TABLE, { artifact_id: artifact.artifact_id }, updateData);

          return {
            ...artifact,
            object_url: objectUrl,
            public_url: objectUrl,
            url_expires_at: updateData.url_expires_at || null,
            file_name: artifact.artifact_name || artifact.file_name,
            size_bytes: artifact.file_size_bytes ? parseInt(artifact.file_size_bytes) : artifact.size_bytes,
          };
        } catch (error) {
          console.error(`Error generating URL for artifact ${artifact.artifact_id}:`, error);
          return {
            ...artifact,
            object_url: artifact.public_url || null,
            file_name: artifact.artifact_name || artifact.file_name,
            size_bytes: artifact.file_size_bytes ? parseInt(artifact.file_size_bytes) : artifact.size_bytes,
          };
        }
      })
    );

    return {
      statusCode: 200,
      body: {
        artifacts: artifactsWithUrls,
        count: artifactsWithUrls.length,
      },
    };
  }

  async get(tenantId: string, artifactId: string): Promise<RouteResponse> {
    const artifact = await db.get(ARTIFACTS_TABLE, { artifact_id: artifactId });

    if (!artifact) {
      throw new ApiError('This file doesn\'t exist', 404);
    }

    if (artifact.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this file', 403);
    }

    // Don't allow access to report.md files through the API
    const fileName = artifact.artifact_name || artifact.file_name || '';
    if (fileName.includes('report.md') || artifact.artifact_type === 'report_markdown') {
      throw new ApiError('This file is not available for download', 404);
    }

    // Generate URL if missing, expired, or is a presigned URL (replace with CloudFront)
    if (artifact.s3_key) {
      // Check if artifact already has a valid CloudFront URL
      const hasValidCloudFrontUrl = artifact.public_url && 
        !isPresignedUrl(artifact.public_url) &&
        artifact.public_url.startsWith('https://');
      
      // Check if artifact has expired presigned URL or needs replacement
      const hasExpiredPresignedUrl = isPresignedUrl(artifact.public_url) &&
        (artifact.url_expires_at && new Date(artifact.url_expires_at) < new Date());
      
      const needsUrlUpdate = !artifact.public_url || hasExpiredPresignedUrl || isPresignedUrl(artifact.public_url);

      if (!hasValidCloudFrontUrl || needsUrlUpdate) {
        let objectUrl: string;
        let updateData: any = {};

        if (CLOUDFRONT_DOMAIN) {
          // Use CloudFront URL (non-expiring)
          objectUrl = generateCloudFrontUrl(artifact.s3_key);
          // CloudFront URLs don't expire, so we don't set url_expires_at
          updateData = {
            public_url: objectUrl,
            url_expires_at: null, // Clear expiration for CloudFront URLs
          };
        } else {
          // Fallback to presigned URL if CloudFront is not configured
          const { url, expiresAt } = await generatePresignedUrl(artifact.s3_key);
          objectUrl = url;
          updateData = {
            public_url: url,
            url_expires_at: expiresAt,
          };
        }

        // Update artifact with new URL
        await db.update(ARTIFACTS_TABLE, { artifact_id: artifactId }, updateData);

        artifact.public_url = objectUrl;
        artifact.url_expires_at = updateData.url_expires_at || null;
      }
    }

    return {
      statusCode: 200,
      body: artifact,
    };
  }
}

export const artifactsController = new ArtifactsController();

