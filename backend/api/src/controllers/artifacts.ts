import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { db } from '../utils/db';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';

const ARTIFACTS_TABLE = process.env.ARTIFACTS_TABLE!;
const ARTIFACTS_BUCKET = process.env.ARTIFACTS_BUCKET!;

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

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

    // Ensure all artifacts have accessible URLs
    // Generate presigned URLs for artifacts that don't have public_url or expired URLs
    const artifactsWithUrls = await Promise.all(
      artifacts.map(async (artifact: any) => {
        // Check if artifact has a valid public_url
        const hasValidUrl = artifact.public_url && 
          artifact.s3_key &&
          (!artifact.url_expires_at || new Date(artifact.url_expires_at) > new Date(Date.now() + 3600000)); // Regenerate if expires within 1 hour
        
        if (hasValidUrl && artifact.s3_key) {
          // Return artifact with public_url as object_url for frontend compatibility
          return {
            ...artifact,
            object_url: artifact.public_url,
            file_name: artifact.artifact_name || artifact.file_name,
            size_bytes: artifact.file_size_bytes ? parseInt(artifact.file_size_bytes) : artifact.size_bytes,
          };
        }
        
        // Generate presigned URL if missing or expired
        if (artifact.s3_key) {
          try {
            const command = new GetObjectCommand({
              Bucket: ARTIFACTS_BUCKET,
              Key: artifact.s3_key,
            });
            
            // Use 7 days expiration to match worker (604800 seconds)
            const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 604800 });
            const expiresAt = new Date(Date.now() + 604800 * 1000).toISOString();
            
            // Update artifact in database with new presigned URL
            await db.update(ARTIFACTS_TABLE, { artifact_id: artifact.artifact_id }, {
              public_url: presignedUrl,
              url_expires_at: expiresAt,
            });
            
            return {
              ...artifact,
              object_url: presignedUrl,
              public_url: presignedUrl,
              url_expires_at: expiresAt,
              file_name: artifact.artifact_name || artifact.file_name,
              size_bytes: artifact.file_size_bytes ? parseInt(artifact.file_size_bytes) : artifact.size_bytes,
            };
          } catch (error) {
            console.error(`Error generating presigned URL for artifact ${artifact.artifact_id}:`, error);
            return {
              ...artifact,
              object_url: null,
              file_name: artifact.artifact_name || artifact.file_name,
              size_bytes: artifact.file_size_bytes ? parseInt(artifact.file_size_bytes) : artifact.size_bytes,
            };
          }
        }
        
        return {
          ...artifact,
          object_url: artifact.public_url || null,
          file_name: artifact.artifact_name || artifact.file_name,
          size_bytes: artifact.file_size_bytes ? parseInt(artifact.file_size_bytes) : artifact.size_bytes,
        };
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

    // Generate presigned URL if not already public or expired
    if (!artifact.public_url || !artifact.s3_key || 
        (artifact.url_expires_at && new Date(artifact.url_expires_at) < new Date())) {
      const command = new GetObjectCommand({
        Bucket: ARTIFACTS_BUCKET,
        Key: artifact.s3_key,
      });

      // Use 7 days expiration to match worker (604800 seconds)
      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 604800 });
      const expiresAt = new Date(Date.now() + 604800 * 1000).toISOString();

      // Update artifact with new presigned URL
      await db.update(ARTIFACTS_TABLE, { artifact_id: artifactId }, {
        public_url: presignedUrl,
        url_expires_at: expiresAt,
      });

      artifact.public_url = presignedUrl;
      artifact.url_expires_at = expiresAt;
    }

    return {
      statusCode: 200,
      body: artifact,
    };
  }
}

export const artifactsController = new ArtifactsController();

