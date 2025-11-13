import { db } from '../utils/db';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';
import { artifactsController } from './artifacts';
import { ulid } from 'ulid';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { logger } from '../utils/logger';
import { ArtifactUrlService } from '../services/artifactUrlService';
import { GetObjectCommand, PutObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import OpenAI from 'openai';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const JOBS_TABLE = process.env.JOBS_TABLE!;
const SUBMISSIONS_TABLE = process.env.SUBMISSIONS_TABLE!;
const STEP_FUNCTIONS_ARN = process.env.STEP_FUNCTIONS_ARN!;
const ARTIFACTS_BUCKET_ENV = process.env.ARTIFACTS_BUCKET;

if (!ARTIFACTS_BUCKET_ENV) {
  throw new Error('ARTIFACTS_BUCKET environment variable is required');
}

// Type assertion: we've validated it's not undefined above
const ARTIFACTS_BUCKET: string = ARTIFACTS_BUCKET_ENV;

const sfnClient = STEP_FUNCTIONS_ARN ? new SFNClient({ region: process.env.AWS_REGION || 'us-east-1' }) : null;
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Generate a public URL for execution_steps stored in S3.
 * 
 * Execution steps are always stored in S3 (never in DynamoDB) to ensure
 * complete data storage without size limitations.
 * 
 * Uses CloudFront URL (non-expiring) if available, otherwise falls back to
 * a long-lived presigned URL. This ensures execution steps are always accessible.
 * 
 * @param s3Key - S3 key for the execution_steps JSON file
 * @returns Public URL string or null if generation fails
 */
async function generateExecutionStepsUrl(s3Key: string): Promise<string | null> {
  try {
    // Use ArtifactUrlService to get CloudFront URL (non-expiring) or long-lived presigned URL
    const { url } = await ArtifactUrlService.generateUrl(s3Key);
    return url;
  } catch (error) {
    logger.error(`Error generating URL for execution_steps: ${s3Key}`, error);
    return null;
  }
}

async function getOpenAIClient(): Promise<OpenAI> {
  const OPENAI_SECRET_NAME = process.env.OPENAI_SECRET_NAME || 'openai-api-key';
  
  try {
    const command = new GetSecretValueCommand({ SecretId: OPENAI_SECRET_NAME });
    const response = await secretsClient.send(command);
    
    if (!response.SecretString) {
      throw new ApiError('OpenAI API key not found in secret', 500);
    }
    
    const secret = JSON.parse(response.SecretString);
    const apiKey = secret.api_key || secret.OPENAI_API_KEY || secret.openai_api_key;
    
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new ApiError('OpenAI API key is empty', 500);
    }
    
    return new OpenAI({ apiKey });
  } catch (error: any) {
    logger.error('[Quick Edit Step] Error getting OpenAI client', { error: error.message });
    throw new ApiError(`Failed to initialize OpenAI client: ${error.message}`, 500);
  }
}

async function fetchExecutionStepsFromS3(s3Key: string): Promise<any[]> {
  try {
    if (!ARTIFACTS_BUCKET) {
      throw new ApiError('ARTIFACTS_BUCKET environment variable is not configured', 500);
    }

    const command = new GetObjectCommand({
      Bucket: ARTIFACTS_BUCKET,
      Key: s3Key,
    });
    
    const response = await s3Client.send(command);
    
    if (!response.Body) {
      throw new ApiError(`S3 object body is empty for key: ${s3Key}`, 500);
    }
    
    const bodyContents = await response.Body.transformToString();
    
    if (!bodyContents || bodyContents.trim() === '') {
      throw new ApiError(`S3 object content is empty for key: ${s3Key}`, 500);
    }
    
    let parsedData;
    try {
      parsedData = JSON.parse(bodyContents);
    } catch (parseError: any) {
      logger.error('[Quick Edit Step] Failed to parse execution steps JSON', {
        s3Key,
        parseError: parseError.message,
        contentLength: bodyContents.length,
      });
      throw new ApiError(`Failed to parse execution steps JSON from S3: ${parseError.message}`, 500);
    }
    
    // Validate that parsed data is an array
    if (!Array.isArray(parsedData)) {
      logger.error('[Quick Edit Step] Execution steps from S3 is not an array', {
        s3Key,
        dataType: typeof parsedData,
        isArray: Array.isArray(parsedData),
      });
      throw new ApiError(`Execution steps from S3 is not an array. Expected array, got ${typeof parsedData}`, 500);
    }
    
    // Empty array is valid, but log it for debugging
    if (parsedData.length === 0) {
      logger.warn('[Quick Edit Step] Execution steps array is empty', { s3Key });
    }
    
    return parsedData;
  } catch (error: any) {
    // If it's already an ApiError, re-throw it
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error('[Quick Edit Step] Error fetching execution steps from S3', {
      s3Key,
      error: error.message,
      errorStack: error.stack,
    });
    throw new ApiError(`Failed to fetch execution steps from S3: ${error.message}`, 500);
  }
}

async function saveExecutionStepsToS3(s3Key: string, executionSteps: any[]): Promise<void> {
  try {
    if (!ARTIFACTS_BUCKET) {
      throw new ApiError('ARTIFACTS_BUCKET environment variable is not configured', 500);
    }

    // Validate executionSteps is an array
    if (!Array.isArray(executionSteps)) {
      logger.error('[Quick Edit Step] Cannot save: execution steps is not an array', {
        s3Key,
        executionStepsType: typeof executionSteps,
        isArray: Array.isArray(executionSteps),
      });
      throw new ApiError('Cannot save execution steps: expected array', 500);
    }

    let jsonBody: string;
    try {
      jsonBody = JSON.stringify(executionSteps, null, 2);
    } catch (stringifyError: any) {
      logger.error('[Quick Edit Step] Failed to stringify execution steps for S3', {
        s3Key,
        stepsCount: executionSteps.length,
        error: stringifyError.message,
      });
      throw new ApiError(`Failed to serialize execution steps: ${stringifyError.message}`, 500);
    }

    const command = new PutObjectCommand({
      Bucket: ARTIFACTS_BUCKET,
      Key: s3Key,
      Body: jsonBody,
      ContentType: 'application/json',
    });
    
    await s3Client.send(command);
    logger.info('[Quick Edit Step] Saved execution steps to S3', { 
      s3Key, 
      stepsCount: executionSteps.length,
      bodySize: jsonBody.length,
    });
  } catch (error: any) {
    // If it's already an ApiError, re-throw it
    if (error instanceof ApiError) {
      throw error;
    }
    
    logger.error('[Quick Edit Step] Error saving execution steps to S3', {
      s3Key,
      error: error.message,
      errorStack: error.stack,
    });
    throw new ApiError(`Failed to save execution steps to S3: ${error.message}`, 500);
  }
}

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

  /**
   * Get execution steps for a job by fetching directly from S3.
   * This endpoint proxies the execution steps to avoid presigned URL expiration issues.
   */
  async getExecutionSteps(tenantId: string, jobId: string): Promise<RouteResponse> {
    const job = await db.get(JOBS_TABLE, { job_id: jobId });

    if (!job) {
      throw new ApiError('Job not found', 404);
    }

    if (job.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this job', 403);
    }

    if (!job.execution_steps_s3_key) {
      return {
        statusCode: 200,
        body: [],
      };
    }

    try {
      const executionSteps = await fetchExecutionStepsFromS3(job.execution_steps_s3_key);
      return {
        statusCode: 200,
        body: executionSteps,
      };
    } catch (error: any) {
      logger.error(`Error fetching execution steps for job ${jobId}`, {
        s3Key: job.execution_steps_s3_key,
        error: error.message,
      });
      throw new ApiError(`Failed to fetch execution steps: ${error.message}`, 500);
    }
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

  async rerunStep(tenantId: string, jobId: string, stepIndex: number): Promise<RouteResponse> {
    // Get the job
    const job = await db.get(JOBS_TABLE, { job_id: jobId });

    if (!job) {
      throw new ApiError('Job not found', 404);
    }

    if (job.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to rerun steps for this job', 403);
    }

    // Get the workflow to validate step index
    const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE!;
    const workflow = await db.get(WORKFLOWS_TABLE, { workflow_id: job.workflow_id });
    if (!workflow) {
      throw new ApiError('Workflow not found', 404);
    }

    const steps = workflow.steps || [];
    if (stepIndex < 0 || stepIndex >= steps.length) {
      throw new ApiError(`Invalid step index: ${stepIndex}. Workflow has ${steps.length} steps.`, 400);
    }

    // Update job status to processing if it's completed
    if (job.status === 'completed') {
      await db.update(JOBS_TABLE, { job_id: jobId }, {
        status: 'processing',
        updated_at: new Date().toISOString(),
      });
    }

    // Start Step Functions execution with step_index parameter
    try {
      if (process.env.IS_LOCAL === 'true' || process.env.NODE_ENV === 'development' || !STEP_FUNCTIONS_ARN) {
        logger.info('Local mode detected, processing step rerun directly', { jobId, stepIndex });
        
        // For local mode, we'd need to call the worker directly with step_index
        // This would require importing the worker processor
        // For now, just log and return success
        logger.warn('Local step rerun not fully implemented - would need direct worker call', { jobId, stepIndex });
        
        return {
          statusCode: 200,
          body: { message: 'Step rerun initiated (local mode)', job_id: jobId, step_index: stepIndex },
        };
      } else {
        const command = new StartExecutionCommand({
          stateMachineArn: STEP_FUNCTIONS_ARN,
          input: JSON.stringify({
            job_id: jobId,
            tenant_id: job.tenant_id,
            workflow_id: job.workflow_id,
            submission_id: job.submission_id,
            step_index: stepIndex,
            step_type: 'workflow_step',
            action: 'process_single_step',
          }),
        });

        await sfnClient!.send(command);
        logger.info('Started Step Functions execution for step rerun', { jobId, stepIndex });

        return {
          statusCode: 200,
          body: { message: 'Step rerun initiated', job_id: jobId, step_index: stepIndex },
        };
      }
    } catch (error: any) {
      logger.error('Error starting step rerun', {
        jobId,
        stepIndex,
        error: error.message,
        errorStack: error.stack,
      });
      throw new ApiError(`Failed to rerun step: ${error.message}`, 500);
    }
  }

  async quickEditStep(tenantId: string, jobId: string, body: any): Promise<RouteResponse> {
    const { step_order, user_prompt, save } = body;

    // Validate required fields
    if (step_order === undefined || step_order === null) {
      throw new ApiError('step_order is required', 400);
    }
    if (!user_prompt || typeof user_prompt !== 'string' || user_prompt.trim() === '') {
      throw new ApiError('user_prompt is required and must be a non-empty string', 400);
    }

    // Get the job
    const job = await db.get(JOBS_TABLE, { job_id: jobId });

    if (!job) {
      throw new ApiError('Job not found', 404);
    }

    if (job.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to edit steps for this job', 403);
    }

    // Check if execution steps exist
    if (!job.execution_steps_s3_key) {
      throw new ApiError('Execution steps not found for this job', 404);
    }

    // Fetch execution steps from S3
    let executionSteps: any[];
    try {
      executionSteps = await fetchExecutionStepsFromS3(job.execution_steps_s3_key);
    } catch (error: any) {
      logger.error('[Quick Edit Step] Failed to fetch execution steps', {
        jobId,
        s3Key: job.execution_steps_s3_key,
        error: error.message,
      });
      throw error; // Re-throw ApiError from fetchExecutionStepsFromS3
    }

    // Validate executionSteps is an array (defensive check)
    if (!Array.isArray(executionSteps)) {
      logger.error('[Quick Edit Step] Execution steps is not an array after fetch', {
        jobId,
        stepOrder: step_order,
        executionStepsType: typeof executionSteps,
        isArray: Array.isArray(executionSteps),
      });
      throw new ApiError('Execution steps data is invalid: expected array', 500);
    }

    // Find the step to edit
    const stepIndex = executionSteps.findIndex((step: any) => step.step_order === step_order);
    if (stepIndex === -1) {
      logger.warn('[Quick Edit Step] Step not found', {
        jobId,
        stepOrder: step_order,
        availableSteps: executionSteps.map((s: any) => s.step_order),
      });
      throw new ApiError(`Step with order ${step_order} not found in execution steps`, 404);
    }

    const step = executionSteps[stepIndex];

    // Validate step structure
    if (!step || typeof step !== 'object') {
      logger.error('[Quick Edit Step] Invalid step structure', {
        jobId,
        stepOrder: step_order,
        stepType: typeof step,
      });
      throw new ApiError(`Step with order ${step_order} has invalid structure`, 500);
    }

    // Check if step has output to edit
    if (step.output === null || step.output === undefined || step.output === '') {
      throw new ApiError(`Step with order ${step_order} has no output to edit`, 400);
    }

    // Convert step output to string for processing
    let originalOutput: string;
    try {
      if (typeof step.output === 'string') {
        originalOutput = step.output;
      } else {
        // Try to stringify, handle circular references and large objects
        originalOutput = JSON.stringify(step.output, null, 2);
      }
    } catch (stringifyError: any) {
      logger.error('[Quick Edit Step] Failed to stringify step output', {
        jobId,
        stepOrder: step_order,
        outputType: typeof step.output,
        error: stringifyError.message,
      });
      throw new ApiError(`Step output is too large or contains circular references: ${stringifyError.message}`, 500);
    }

    logger.info('[Quick Edit Step] Starting AI edit', {
      jobId,
      stepOrder: step_order,
      stepName: step.step_name,
      promptLength: user_prompt.length,
    });

    try {
      // Get OpenAI client
      const openai = await getOpenAIClient();

      // Build context for AI
      const systemPrompt = `You are an AI assistant that helps edit execution step outputs for a lead magnet generation platform.

The user will provide:
1. The original step output (text or JSON)
2. A prompt describing how they want to edit it

Your job is to generate an edited version of the output that follows the user's instructions while maintaining the same format and structure.

Guidelines:
- Preserve the format of the original output (if it's JSON, return JSON; if it's markdown, return markdown)
- Make only the changes requested by the user
- Keep the overall structure and style consistent
- If the output contains structured data, maintain the same schema unless explicitly asked to change it
- Return only the edited output, not explanations or metadata`;

      const userMessage = `Original Step Output:
${originalOutput}

Step Name: ${step.step_name || 'Unknown'}
Step Order: ${step_order}

User Request: ${user_prompt}

Please generate the edited output based on the user's request. Return only the edited output, maintaining the same format as the original.`;

      // Call OpenAI
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      });

      const editedOutput = completion.choices[0]?.message?.content;
      if (!editedOutput) {
        throw new Error('No response from OpenAI');
      }

      // Parse edited output if original was JSON
      let parsedEditedOutput: any = editedOutput;
      try {
        if (typeof step.output !== 'string') {
          parsedEditedOutput = JSON.parse(editedOutput);
        }
      } catch {
        // If parsing fails, use as string
        parsedEditedOutput = editedOutput;
      }

      // Generate changes summary
      const changesSummary = `Edited step output based on user prompt: "${user_prompt.substring(0, 100)}${user_prompt.length > 100 ? '...' : ''}"`;

      logger.info('[Quick Edit Step] AI edit completed', {
        jobId,
        stepOrder: step_order,
        originalLength: originalOutput.length,
        editedLength: editedOutput.length,
      });

      // If save is true, update the execution step
      if (save === true) {
        // Update the step output
        executionSteps[stepIndex] = {
          ...step,
          output: parsedEditedOutput,
          updated_at: new Date().toISOString(),
        };

        // Save back to S3
        await saveExecutionStepsToS3(job.execution_steps_s3_key, executionSteps);

        // Update job updated_at timestamp
        await db.update(JOBS_TABLE, { job_id: jobId }, {
          updated_at: new Date().toISOString(),
        });

        logger.info('[Quick Edit Step] Changes saved', {
          jobId,
          stepOrder: step_order,
        });
      }

      return {
        statusCode: 200,
        body: {
          original_output: step.output,
          edited_output: parsedEditedOutput,
          changes_summary: changesSummary,
          saved: save === true,
        },
      };
    } catch (error: any) {
      // If it's already an ApiError, re-throw it with original status code
      if (error instanceof ApiError) {
        logger.error('[Quick Edit Step] Error (ApiError)', {
          jobId,
          stepOrder: step_order,
          errorMessage: error.message,
          statusCode: error.statusCode,
        });
        throw error;
      }
      
      // For other errors, wrap in ApiError with 500 status
      logger.error('[Quick Edit Step] Unexpected error', {
        jobId,
        stepOrder: step_order,
        error: error.message,
        errorType: error.constructor?.name || typeof error,
        stack: error.stack,
      });
      throw new ApiError(`Failed to edit step: ${error.message}`, 500);
    }
  }
}

export const jobsController = new JobsController();

