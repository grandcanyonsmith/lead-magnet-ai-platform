import { db } from '../utils/db';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';
import { artifactsController } from './artifacts';
import { ulid } from 'ulid';
import { logger } from '../utils/logger';
import { ArtifactUrlService } from '../services/artifactUrlService';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../utils/env';
import { jobExecutionService } from '../services/jobExecutionService';
import { generateExecutionStepsUrl } from '../utils/executionStepsUtils';

const JOBS_TABLE = env.jobsTable;
const SUBMISSIONS_TABLE = env.submissionsTable;
const ARTIFACTS_BUCKET = env.artifactsBucket;

const s3Client = new S3Client({ region: env.awsRegion });

class JobsController {
  async list(tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse> {
    const workflowId = queryParams.workflow_id;
    const status = queryParams.status;
    const pageSize = queryParams.limit ? parseInt(queryParams.limit) : 20;
    const offset = queryParams.offset ? parseInt(queryParams.offset) : 0;
    
    // Fetch more items than needed to support offset-based pagination
    const fetchLimit = pageSize + offset;

    let jobs;
    let totalCount = 0;
    
    if (workflowId && status) {
      const result = await db.query(
        JOBS_TABLE,
        'gsi_workflow_status',
        'workflow_id = :workflow_id AND #status = :status',
        { ':workflow_id': workflowId, ':status': status },
        { '#status': 'status' },
        fetchLimit
      );
      jobs = result.items;
      // For total count, we'd need a separate query, but for now estimate based on fetched items
      totalCount = jobs.length;
    } else if (workflowId) {
      const result = await db.query(
        JOBS_TABLE,
        'gsi_workflow_status',
        'workflow_id = :workflow_id',
        { ':workflow_id': workflowId },
        undefined,
        fetchLimit
      );
      jobs = result.items;
      totalCount = jobs.length;
    } else {
      const result = await db.query(
        JOBS_TABLE,
        'gsi_tenant_created',
        'tenant_id = :tenant_id',
        { ':tenant_id': tenantId },
        undefined,
        fetchLimit
      );
      jobs = result.items;
      // For tenant queries, try to get a better count estimate
      // Fetch a larger sample to estimate total
      const countResult = await db.query(
        JOBS_TABLE,
        'gsi_tenant_created',
        'tenant_id = :tenant_id',
        { ':tenant_id': tenantId },
        undefined,
        1000 // Sample size for count estimation
      );
      const countJobs = countResult.items;
      totalCount = countJobs.length >= 1000 ? 1000 : countJobs.length;
    }

    // Ensure jobs are sorted by created_at DESC (most recent first)
    // db.query already uses ScanIndexForward: false, but add explicit sort as fallback
    jobs.sort((a: any, b: any) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA; // DESC order
    });

    // Apply offset and limit
    const paginatedJobs = jobs.slice(offset, offset + pageSize);
    const hasMore = jobs.length > offset + pageSize;

    return {
      statusCode: 200,
      body: {
        jobs: paginatedJobs,
        count: paginatedJobs.length,
        total: totalCount,
        offset,
        limit: pageSize,
        has_more: hasMore,
      },
    };
  }

  async get(tenantId: string, jobId: string): Promise<RouteResponse> {
    const job = await db.get(JOBS_TABLE, { job_id: jobId });

    if (!job) {
      throw new ApiError('This generated lead magnet doesn\'t exist', 404);
    }

    if (job.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this lead magnet', 403);
    }

    // Execution steps are ALWAYS stored in S3 (never in DynamoDB).
    // Generate public URL for execution_steps so frontend can fetch them directly from S3.
    // Uses CloudFront URL (non-expiring) if available, otherwise falls back to presigned URL.
    if (job.execution_steps_s3_key) {
      try {
        // Verify S3 file exists before generating URL
        try {
          const headCommand = new HeadObjectCommand({
            Bucket: ARTIFACTS_BUCKET,
            Key: job.execution_steps_s3_key,
          });
          await s3Client.send(headCommand);
          logger.debug(`Verified execution_steps S3 file exists for job ${jobId}`, {
            s3Key: job.execution_steps_s3_key,
          });
        } catch (s3Error: any) {
          if (s3Error.name === 'NotFound' || s3Error.$metadata?.httpStatusCode === 404) {
            logger.warn(`Execution steps S3 file not found for job ${jobId}`, {
              s3Key: job.execution_steps_s3_key,
              error: s3Error.message,
            });
            // Don't generate URL if file doesn't exist
          } else {
            logger.error(`Error checking execution steps S3 file for job ${jobId}`, {
              s3Key: job.execution_steps_s3_key,
              error: s3Error.message,
            });
            // Continue anyway - might be a transient error
          }
        }

        const executionStepsUrl = await generateExecutionStepsUrl(job.execution_steps_s3_key);
        if (executionStepsUrl) {
          job.execution_steps_s3_url = executionStepsUrl;
          const isCloudFront = !ArtifactUrlService.isPresignedUrl(executionStepsUrl);
          logger.info(`Generated ${isCloudFront ? 'CloudFront' : 'presigned'} URL for execution_steps for job ${jobId}`, {
            s3Key: job.execution_steps_s3_key,
            isCloudFront,
            url: executionStepsUrl.substring(0, 100) + '...', // Log partial URL for debugging
          });
        } else {
          logger.warn(`Failed to generate URL for execution_steps for job ${jobId}`, {
            s3Key: job.execution_steps_s3_key,
          });
        }
      } catch (error: any) {
        logger.error(`Error processing execution_steps URL for job ${jobId}`, {
          s3Key: job.execution_steps_s3_key,
          error: error.message,
          errorStack: error.stack,
        });
        // Continue without URL - frontend will handle gracefully
      }
    } else {
      logger.debug(`No execution_steps_s3_key for job ${jobId} - steps may not be created yet`);
    }

    // Refresh output_url from artifacts if job is completed and has artifacts
    // This ensures the URL never expires
    if (job.status === 'completed' && job.artifacts && Array.isArray(job.artifacts) && job.artifacts.length > 0) {
      try {
        // Get the first artifact (usually the final output)
        const artifactId = job.artifacts[job.artifacts.length - 1]; // Get the last artifact (final output)
        if (artifactId) {
          const artifactResponse = await artifactsController.get(tenantId, artifactId);
          if (artifactResponse.body && artifactResponse.body.public_url) {
            // Update job with fresh URL
            await db.update(JOBS_TABLE, { job_id: jobId }, {
              output_url: artifactResponse.body.public_url,
              updated_at: new Date().toISOString(),
            });
            job.output_url = artifactResponse.body.public_url;
          }
        }
      } catch (error) {
        console.error(`Error refreshing output_url for job ${jobId}:`, error);
        // Continue with existing output_url if refresh fails
      }
    }

    return {
      statusCode: 200,
      body: job,
    };
  }

  /**
   * Get the final document for a job by serving the final artifact content.
   * This endpoint proxies the artifact content to avoid CloudFront redirect issues.
   */
  async getDocument(tenantId: string, jobId: string): Promise<RouteResponse> {
    const job = await db.get(JOBS_TABLE, { job_id: jobId });

    if (!job) {
      throw new ApiError('Job not found', 404);
    }

    if (job.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this job', 403);
    }

    // Find the final artifact (typically the last one, or one with type 'html_final' or 'markdown_final')
    if (!job.artifacts || !Array.isArray(job.artifacts) || job.artifacts.length === 0) {
      throw new ApiError('No artifacts found for this job', 404);
    }

    // Try to find html_final or markdown_final artifact first
    const ARTIFACTS_TABLE = process.env.ARTIFACTS_TABLE;
    if (!ARTIFACTS_TABLE) {
      throw new ApiError('ARTIFACTS_TABLE environment variable is not configured', 500);
    }

    let finalArtifactId: string | null = null;
    
    // Look for html_final or markdown_final artifact (check in reverse order)
    const artifactsReversed = [...job.artifacts].reverse();
    for (const artifactId of artifactsReversed) {
      try {
        const artifact = await db.get(ARTIFACTS_TABLE, { artifact_id: artifactId });
        if (artifact && (artifact.artifact_type === 'html_final' || artifact.artifact_type === 'markdown_final')) {
          finalArtifactId = artifactId;
          break;
        }
      } catch (error) {
        logger.warn(`Failed to fetch artifact ${artifactId}`, { error });
      }
    }

    // Fallback to last artifact if no final artifact found
    if (!finalArtifactId) {
      finalArtifactId = job.artifacts[job.artifacts.length - 1];
    }

    if (!finalArtifactId) {
      throw new ApiError('Final artifact not found', 404);
    }

    // Use artifacts controller to get content
    return await artifactsController.getContent(tenantId, finalArtifactId);
  }

  async getPublicStatus(jobId: string): Promise<RouteResponse> {
    const job = await db.get(JOBS_TABLE, { job_id: jobId });

    if (!job) {
      throw new ApiError('Job not found', 404);
    }

    // Return only public status information (no sensitive data)
    return {
      statusCode: 200,
      body: {
        job_id: job.job_id,
        status: job.status,
        output_url: job.output_url || null,
        error_message: job.error_message || null,
        created_at: job.created_at,
        completed_at: job.completed_at || null,
      },
    };
  }

  async resubmit(tenantId: string, jobId: string): Promise<RouteResponse> {
    // Get the original job
    const originalJob = await db.get(JOBS_TABLE, { job_id: jobId });

    if (!originalJob) {
      throw new ApiError('This generated lead magnet doesn\'t exist', 404);
    }

    if (originalJob.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to resubmit this lead magnet', 403);
    }

    // Get the submission data
    if (!originalJob.submission_id) {
      throw new ApiError('Cannot resubmit: original submission not found', 400);
    }

    const submission = await db.get(SUBMISSIONS_TABLE, { submission_id: originalJob.submission_id });
    if (!submission) {
      throw new ApiError('Cannot resubmit: submission data not found', 404);
    }

    if (submission.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to resubmit this lead magnet', 403);
    }

    // Create a new submission record (copy of the original)
    const newSubmissionId = `sub_${ulid()}`;
    const newSubmission = {
      submission_id: newSubmissionId,
      tenant_id: submission.tenant_id,
      form_id: submission.form_id,
      workflow_id: submission.workflow_id,
      submission_data: submission.submission_data,
      submitter_ip: submission.submitter_ip || null,
      submitter_email: submission.submitter_email || null,
      submitter_phone: submission.submitter_phone || null,
      submitter_name: submission.submitter_name || null,
      created_at: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90 days
    };

    await db.put(SUBMISSIONS_TABLE, newSubmission);

    // Create new job record
    const newJobId = `job_${ulid()}`;
    const newJob = {
      job_id: newJobId,
      tenant_id: originalJob.tenant_id,
      workflow_id: originalJob.workflow_id,
      submission_id: newSubmissionId,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.put(JOBS_TABLE, newJob);

    // Update submission with job_id
    await db.update(SUBMISSIONS_TABLE, { submission_id: newSubmissionId }, { job_id: newJobId });

    // Start job processing
    await jobExecutionService.startJobProcessing({
      jobId: newJobId,
      tenantId: originalJob.tenant_id,
      workflowId: originalJob.workflow_id,
      submissionId: newSubmissionId,
    });

    return {
      statusCode: 200,
      body: {
        job_id: newJobId,
        status: 'pending',
        message: 'Job resubmitted successfully',
      },
    };
  }
}

export const jobsController = new JobsController();
