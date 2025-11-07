import { db } from '../utils/db';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';
import { ArtifactUrlService } from '../services/artifactUrlService';

const ARTIFACTS_TABLE = process.env.ARTIFACTS_TABLE;

if (!ARTIFACTS_TABLE) {
  console.error('[Artifacts Controller] ARTIFACTS_TABLE environment variable is not set');
}

class ArtifactsController {
  async list(tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse> {
    if (!ARTIFACTS_TABLE) {
      throw new ApiError('ARTIFACTS_TABLE environment variable is not configured', 500);
    }

    const jobId = queryParams.job_id;
    const artifactType = queryParams.artifact_type;
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;

    let artifacts;
    if (jobId) {
      artifacts = await db.query(
        ARTIFACTS_TABLE!,
        'gsi_job_id',
        'job_id = :job_id',
        { ':job_id': jobId },
        undefined,
        limit
      );
    } else if (artifactType) {
      artifacts = await db.query(
        ARTIFACTS_TABLE!,
        'gsi_tenant_type',
        'tenant_id = :tenant_id AND artifact_type = :artifact_type',
        { ':tenant_id': tenantId, ':artifact_type': artifactType },
        undefined,
        limit
      );
    } else {
      artifacts = await db.query(
        ARTIFACTS_TABLE!,
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

    // Sort by created_at DESC (most recent first)
    artifacts.sort((a: any, b: any) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA; // DESC order
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
          const objectUrl = await ArtifactUrlService.ensureValidUrl(artifact);
          
          return {
            ...artifact,
            object_url: objectUrl,
            public_url: objectUrl,
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
    if (!ARTIFACTS_TABLE) {
      throw new ApiError('ARTIFACTS_TABLE environment variable is not configured', 500);
    }

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
      artifact.public_url = await ArtifactUrlService.ensureValidUrl(artifact);
    }

    return {
      statusCode: 200,
      body: artifact,
    };
  }
}

export const artifactsController = new ArtifactsController();

