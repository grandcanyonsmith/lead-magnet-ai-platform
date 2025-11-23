import { db } from '../utils/db';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';
import { logger } from '../utils/logger';
import { executionStepsService } from '../services/executionStepsService';
import { env } from '../utils/env';

const JOBS_TABLE = env.jobsTable;

/**
 * Controller for execution steps operations.
 * Handles fetching and editing execution steps stored in S3.
 */
export class ExecutionStepsController {
  /**
   * Get execution steps for a job by fetching directly from S3.
   * This endpoint proxies the execution steps to avoid presigned URL expiration issues.
   */
  async getExecutionSteps(_tenantId: string, jobId: string): Promise<RouteResponse> {
    const job = await db.get(JOBS_TABLE, { job_id: jobId });

    if (!job) {
      throw new ApiError('Job not found', 404);
    }

    // Removed tenant_id check - allow access to all jobs from all accounts (matching jobs.get() behavior)

    if (!job.execution_steps_s3_key) {
      return {
        statusCode: 200,
        body: [],
      };
    }

    try {
      const executionSteps = await executionStepsService.fetchFromS3(job.execution_steps_s3_key);
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

  /**
   * Quick edit a step's output using AI.
   * Fetches execution steps from S3, edits the specified step, and optionally saves back.
   */
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

    try {
      const result = await executionStepsService.editStep(
        job.execution_steps_s3_key,
        step_order,
        user_prompt,
        save === true
      );

      // If save is true, update job updated_at timestamp
      if (save === true) {
        await db.update(JOBS_TABLE, { job_id: jobId }, {
          updated_at: new Date().toISOString(),
        });
      }

      return {
        statusCode: 200,
        body: result,
      };
    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error;
      }
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

export const executionStepsController = new ExecutionStepsController();

