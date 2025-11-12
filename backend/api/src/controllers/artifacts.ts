import { db, normalizeQueryResult } from '../utils/db';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';
import { ArtifactUrlService } from '../services/artifactUrlService';
import { logger } from '../utils/logger';

const ARTIFACTS_TABLE = process.env.ARTIFACTS_TABLE;
const JOBS_TABLE = process.env.JOBS_TABLE;

if (!ARTIFACTS_TABLE) {
  logger.error('[Artifacts Controller] ARTIFACTS_TABLE environment variable is not set');
}

class ArtifactsController {
  async list(tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse> {
    if (!ARTIFACTS_TABLE) {
      throw new ApiError('ARTIFACTS_TABLE environment variable is not configured', 500);
    }

    const jobId = queryParams.job_id;
    const artifactType = queryParams.artifact_type;
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;

    let artifactsResult;
    if (jobId) {
      artifactsResult = await db.query(
        ARTIFACTS_TABLE!,
        'gsi_job_id',
        'job_id = :job_id',
        { ':job_id': jobId },
        undefined,
        limit
      );
    } else if (artifactType) {
      artifactsResult = await db.query(
        ARTIFACTS_TABLE!,
        'gsi_tenant_type',
        'tenant_id = :tenant_id AND artifact_type = :artifact_type',
        { ':tenant_id': tenantId, ':artifact_type': artifactType },
        undefined,
        limit
      );
    } else {
      artifactsResult = await db.query(
        ARTIFACTS_TABLE!,
        'gsi_tenant_type',
        'tenant_id = :tenant_id',
        { ':tenant_id': tenantId },
        undefined,
        limit
      );
    }
    let artifacts = normalizeQueryResult(artifactsResult);

    // Filter out report.md artifacts - they're for internal use only
    artifacts = artifacts.filter((artifact: any) => {
      const fileName = artifact.artifact_name || artifact.file_name || '';
      return !fileName.includes('report.md') && artifact.artifact_type !== 'report_markdown';
    });

    // Fetch workflow_id for artifacts that have job_id
    // Collect unique job_ids
    const jobIds = new Set<string>();
    artifacts.forEach((artifact: any) => {
      if (artifact.job_id) {
        jobIds.add(artifact.job_id);
      }
    });

    // Batch fetch jobs to get workflow_ids
    const jobIdToWorkflowId = new Map<string, string>();
    if (jobIds.size > 0 && JOBS_TABLE) {
      try {
        await Promise.all(
          Array.from(jobIds).map(async (jobId) => {
            try {
              const job = await db.get(JOBS_TABLE, { job_id: jobId });
              if (job && job.workflow_id) {
                jobIdToWorkflowId.set(jobId, job.workflow_id);
              }
            } catch (error) {
              logger.warn(`Failed to fetch workflow_id for job ${jobId}`, { error, job_id: jobId });
            }
          })
        );
      } catch (error) {
        logger.error('Error batch fetching workflow_ids', { error });
      }
    }

    // Sort by created_at DESC (most recent first)
    artifacts.sort((a: any, b: any) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA; // DESC order
    });

    // Ensure all artifacts have accessible URLs and include workflow_id
    // Use CloudFront URLs (non-expiring) when available, fallback to presigned URLs
    const artifactsWithUrls = await Promise.all(
      artifacts.map(async (artifact: any) => {
        const workflowId = artifact.job_id ? jobIdToWorkflowId.get(artifact.job_id) : undefined;
        if (!artifact.s3_key) {
          return {
            ...artifact,
            object_url: artifact.public_url || null,
            file_name: artifact.artifact_name || artifact.file_name,
            size_bytes: artifact.file_size_bytes ? parseInt(artifact.file_size_bytes) : artifact.size_bytes,
            content_type: artifact.mime_type || artifact.content_type, // Map mime_type to content_type for frontend
            workflow_id: workflowId, // Include workflow_id from job lookup
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
            content_type: artifact.mime_type || artifact.content_type, // Map mime_type to content_type for frontend
            workflow_id: workflowId, // Include workflow_id from job lookup
          };
        } catch (error) {
          logger.error(`Error generating URL for artifact ${artifact.artifact_id}`, { error, artifact_id: artifact.artifact_id });
          return {
            ...artifact,
            object_url: artifact.public_url || null,
            file_name: artifact.artifact_name || artifact.file_name,
            size_bytes: artifact.file_size_bytes ? parseInt(artifact.file_size_bytes) : artifact.size_bytes,
            content_type: artifact.mime_type || artifact.content_type, // Map mime_type to content_type for frontend
            workflow_id: workflowId, // Include workflow_id from job lookup
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

