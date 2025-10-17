import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { db } from '../utils/db';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';

const ARTIFACTS_TABLE = process.env.ARTIFACTS_TABLE!;
const ARTIFACTS_BUCKET = process.env.ARTIFACTS_BUCKET!;

const s3Client = new S3Client({ region: process.env.AWS_REGION });

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

    return {
      statusCode: 200,
      body: {
        artifacts,
        count: artifacts.length,
      },
    };
  }

  async get(tenantId: string, artifactId: string): Promise<RouteResponse> {
    const artifact = await db.get(ARTIFACTS_TABLE, { artifact_id: artifactId });

    if (!artifact) {
      throw new ApiError('Artifact not found', 404);
    }

    if (artifact.tenant_id !== tenantId) {
      throw new ApiError('Unauthorized', 403);
    }

    // Generate presigned URL if not already public
    if (!artifact.public_url || artifact.url_expires_at < new Date().toISOString()) {
      const command = new GetObjectCommand({
        Bucket: ARTIFACTS_BUCKET,
        Key: artifact.s3_key,
      });

      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

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

