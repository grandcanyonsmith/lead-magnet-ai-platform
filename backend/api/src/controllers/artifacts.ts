import { db, normalizeQueryResult } from '../utils/db';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';
import { ArtifactUrlService } from '../services/artifactUrlService';
import { logger } from '../utils/logger';
import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../utils/env';

const ARTIFACTS_TABLE = env.artifactsTable;
const JOBS_TABLE = env.jobsTable;
const ARTIFACTS_BUCKET = env.artifactsBucket;

if (!ARTIFACTS_TABLE) {
  logger.error('[Artifacts Controller] ARTIFACTS_TABLE environment variable is not set');
}

if (!ARTIFACTS_BUCKET) {
  throw new Error('ARTIFACTS_BUCKET environment variable is required');
}

const s3Client = new S3Client({ region: env.awsRegion });

class ArtifactsController {
  async list(_tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse> {
    if (!ARTIFACTS_TABLE) {
      throw new ApiError('ARTIFACTS_TABLE environment variable is not configured', 500);
    }

    const jobId = queryParams.job_id;
    const artifactType = queryParams.artifact_type;
    const limit = queryParams.limit ? parseInt(queryParams.limit) : undefined;
    const scanPageSize = 200; // Reasonable page size for full-table scans

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
      // Remove tenant_id filtering - show all artifacts from all accounts
      const allArtifacts = await db.scanAll(ARTIFACTS_TABLE!, scanPageSize);
      const filteredByType = allArtifacts.filter((a: any) => a.artifact_type === artifactType);
      artifactsResult = { items: limit ? filteredByType.slice(0, limit) : filteredByType };
    } else {
      // Remove tenant_id filtering - show all artifacts from all accounts
      artifactsResult = { items: await db.scanAll(ARTIFACTS_TABLE!, scanPageSize, limit) };
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

  async get(_tenantId: string, artifactId: string): Promise<RouteResponse> {
    if (!ARTIFACTS_TABLE) {
      throw new ApiError('ARTIFACTS_TABLE environment variable is not configured', 500);
    }

    const artifact = await db.get(ARTIFACTS_TABLE, { artifact_id: artifactId });

    if (!artifact) {
      throw new ApiError('This file doesn\'t exist', 404);
    }

    // Removed tenant_id check - allow access to all artifacts from all accounts

    // Don't allow access to report.md files through the API
    const fileName = artifact.artifact_name || artifact.file_name || '';
    if (fileName.includes('report.md') || artifact.artifact_type === 'report_markdown') {
      throw new ApiError('This file is not available for download', 404);
    }

    // Generate URL if missing, expired, or is a presigned URL (replace with CloudFront)
    if (artifact.s3_key) {
      artifact.public_url = await ArtifactUrlService.ensureValidUrl(artifact);
    }

    // Map mime_type to content_type for frontend consistency (same as list endpoint)
    const artifactResponse = {
      ...artifact,
      object_url: artifact.public_url || artifact.object_url || null,
      file_name: artifact.artifact_name || artifact.file_name,
      size_bytes: artifact.file_size_bytes ? parseInt(artifact.file_size_bytes) : artifact.size_bytes,
      content_type: artifact.mime_type || artifact.content_type, // Map mime_type to content_type for frontend
    };

    return {
      statusCode: 200,
      body: artifactResponse,
    };
  }

  /**
   * Get artifact content by fetching directly from S3.
   * This endpoint proxies the artifact content to avoid presigned URL expiration issues.
   */
  async getContent(_tenantId: string, artifactId: string): Promise<RouteResponse> {
    if (!ARTIFACTS_TABLE) {
      throw new ApiError('ARTIFACTS_TABLE environment variable is not configured', 500);
    }

    const artifact = await db.get(ARTIFACTS_TABLE, { artifact_id: artifactId });

    if (!artifact) {
      throw new ApiError('Artifact not found', 404);
    }

    // Removed tenant_id check - allow access to all artifacts from all accounts

    if (!artifact.s3_key) {
      throw new ApiError('Artifact S3 key not found', 404);
    }

    // Helper function to try fetching with a specific S3 key
    const tryFetchWithKey = async (s3Key: string): Promise<{ content: string; contentType: string } | null> => {
      try {
        const command = new GetObjectCommand({
          Bucket: ARTIFACTS_BUCKET,
          Key: s3Key,
        });
        
        const response = await s3Client.send(command);
        
        if (!response.Body) {
          return null;
        }
        
        const content = await response.Body.transformToString();
        const contentType = response.ContentType || artifact.mime_type || 'text/plain';
        
        return { content, contentType };
      } catch (error: any) {
        if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
          return null;
        }
        throw error; // Re-throw non-404 errors
      }
    };

    // Generate alternative S3 key formats to try
    const generateAlternativeKeys = (originalKey: string): string[] => {
      const alternatives: string[] = [];
      
      // Extract the path after tenant_id (e.g., "/jobs/job_xxx/final.html")
      const match = originalKey.match(/^(?:cust_)?([^/]+)(\/jobs\/.+)$/);
      if (match) {
        const [, tenantPart, restOfPath] = match;
        
        // Try without cust_ prefix if it has one
        if (originalKey.startsWith('cust_')) {
          alternatives.push(`${tenantPart}${restOfPath}`);
        } else {
          // Try with cust_ prefix if it doesn't have one
          alternatives.push(`cust_${tenantPart}${restOfPath}`);
        }
        
        // If tenantPart looks like a UUID, try extracting just the first part
        // (e.g., "84c8e438-0061-70f2-2ce0-7cb44989a329" -> "84c8e438")
        const uuidMatch = tenantPart.match(/^([a-f0-9]{8})-/i);
        if (uuidMatch) {
          const shortId = uuidMatch[1];
          alternatives.push(`${shortId}${restOfPath}`);
          alternatives.push(`cust_${shortId}${restOfPath}`);
        }
      }
      
      return alternatives;
    };

    try {
      // Log the S3 key being requested for debugging
      logger.info(`Fetching artifact content from S3`, {
        artifactId,
        s3Key: artifact.s3_key,
        bucket: ARTIFACTS_BUCKET,
      });

      // Try the stored S3 key first
      let result = await tryFetchWithKey(artifact.s3_key);

      // If that fails, try alternative key formats
      if (!result) {
        const alternativeKeys = generateAlternativeKeys(artifact.s3_key);
        logger.info(`Primary S3 key not found, trying alternative formats`, {
          artifactId,
          originalKey: artifact.s3_key,
          alternatives: alternativeKeys,
        });

        for (const altKey of alternativeKeys) {
          result = await tryFetchWithKey(altKey);
          if (result) {
            logger.info(`Found artifact with alternative S3 key format`, {
              artifactId,
              originalKey: artifact.s3_key,
              foundKey: altKey,
            });
            // Optionally update the database with the correct key (commented out for now)
            // await db.update(ARTIFACTS_TABLE, { artifact_id: artifactId }, { s3_key: altKey });
            break;
          }
        }
      }

      if (!result) {
        // File not found with any key format
        logger.error(`Artifact file not found in S3 with any key format`, {
          artifactId,
          originalKey: artifact.s3_key,
          alternatives: generateAlternativeKeys(artifact.s3_key),
          bucket: ARTIFACTS_BUCKET,
        });
        throw new ApiError(`Artifact file not found in S3. Key: ${artifact.s3_key}`, 404);
      }

      const { content, contentType } = result;
      
      // For HTML content, add CORS headers and proper content type
      const headers: Record<string, string> = {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
      };
      
      // For HTML documents, ensure proper charset
      if (contentType.includes('text/html')) {
        headers['Content-Type'] = 'text/html; charset=utf-8';
      }
      
      return {
        statusCode: 200,
        body: content,
        headers,
      };
    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Error fetching artifact content for ${artifactId}`, {
        s3Key: artifact.s3_key,
        bucket: ARTIFACTS_BUCKET,
        error: error.message,
        errorName: error.name,
        httpStatusCode: error.$metadata?.httpStatusCode,
      });
      throw new ApiError(`Failed to fetch artifact content: ${error.message}`, 500);
    }
  }
}

export const artifactsController = new ArtifactsController();
