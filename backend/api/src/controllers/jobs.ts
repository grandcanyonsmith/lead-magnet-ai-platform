import { db } from '../utils/db';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';
import { artifactsController } from './artifacts';
import { ulid } from 'ulid';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../utils/logger';

const JOBS_TABLE = process.env.JOBS_TABLE!;
const SUBMISSIONS_TABLE = process.env.SUBMISSIONS_TABLE!;
const STEP_FUNCTIONS_ARN = process.env.STEP_FUNCTIONS_ARN!;
const ARTIFACTS_BUCKET = process.env.ARTIFACTS_BUCKET!;

const sfnClient = STEP_FUNCTIONS_ARN ? new SFNClient({ region: process.env.AWS_REGION || 'us-east-1' }) : null;
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Download execution_steps from S3 if stored there
 */
async function loadExecutionStepsFromS3(s3Key: string): Promise<any[] | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: ARTIFACTS_BUCKET,
      Key: s3Key,
    });
    
    const response = await s3Client.send(command);
    const body = await response.Body?.transformToString();
    if (!body) {
      return null;
    }
    
    return JSON.parse(body);
  } catch (error) {
    logger.error(`Error loading execution_steps from S3: ${s3Key}`, error);
    return null;
  }
}

class JobsController {
  async list(tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse> {
    const workflowId = queryParams.workflow_id;
    const status = queryParams.status;
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;

    let jobs;
    if (workflowId && status) {
      jobs = await db.query(
        JOBS_TABLE,
        'gsi_workflow_status',
        'workflow_id = :workflow_id AND #status = :status',
        { ':workflow_id': workflowId, ':status': status },
        { '#status': 'status' },
        limit
      );
    } else if (workflowId) {
      jobs = await db.query(
        JOBS_TABLE,
        'gsi_workflow_status',
        'workflow_id = :workflow_id',
        { ':workflow_id': workflowId },
        undefined,
        limit
      );
    } else {
      jobs = await db.query(
        JOBS_TABLE,
        'gsi_tenant_created',
        'tenant_id = :tenant_id',
        { ':tenant_id': tenantId },
        undefined,
        limit
      );
    }

    // Ensure jobs are sorted by created_at DESC (most recent first)
    // db.query already uses ScanIndexForward: false, but add explicit sort as fallback
    jobs.sort((a: any, b: any) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA; // DESC order
    });

    return {
      statusCode: 200,
      body: {
        jobs,
        count: jobs.length,
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

    // Load execution_steps from S3 if stored there
    if (job.execution_steps_s3_key && !job.execution_steps) {
      const executionSteps = await loadExecutionStepsFromS3(job.execution_steps_s3_key);
      if (executionSteps) {
        job.execution_steps = executionSteps;
      }
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

    // Start Step Functions execution
    try {
      // Check if we're in local development - process job directly
      if (process.env.IS_LOCAL === 'true' || process.env.NODE_ENV === 'development' || !STEP_FUNCTIONS_ARN) {
        logger.info('Local mode detected, processing resubmitted job directly', { jobId: newJobId });
        
        // Import worker processor for local processing
        setImmediate(async () => {
          try {
            const { processJobLocally } = await import('../services/jobProcessor');
            await processJobLocally(newJobId, originalJob.tenant_id, originalJob.workflow_id, newSubmissionId);
          } catch (error: any) {
            logger.error('Error processing resubmitted job in local mode', {
              jobId: newJobId,
              error: error.message,
              errorStack: error.stack,
            });
            // Update job status to failed
            await db.update(JOBS_TABLE, { job_id: newJobId }, {
              status: 'failed',
              error_message: `Processing failed: ${error.message}`,
              updated_at: new Date().toISOString(),
            });
          }
        });
      } else {
        const command = new StartExecutionCommand({
          stateMachineArn: STEP_FUNCTIONS_ARN,
          input: JSON.stringify({
            job_id: newJobId,
            tenant_id: originalJob.tenant_id,
            workflow_id: originalJob.workflow_id,
            submission_id: newSubmissionId,
          }),
        });

        await sfnClient!.send(command);
        logger.info('Started Step Functions execution for resubmitted job', { jobId: newJobId });
      }
    } catch (error: any) {
      logger.error('Error starting Step Functions execution for resubmitted job', {
        jobId: newJobId,
        error: error.message,
      });
      // Update job status to failed
      await db.update(JOBS_TABLE, { job_id: newJobId }, {
        status: 'failed',
        error_message: `Failed to start processing: ${error.message}`,
        updated_at: new Date().toISOString(),
      });
      throw new ApiError(`Failed to resubmit job: ${error.message}`, 500);
    }

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

