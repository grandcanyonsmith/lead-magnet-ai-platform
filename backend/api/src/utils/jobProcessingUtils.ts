/**
 * Job processing utilities.
 * 
 * Provides utilities for triggering and managing async job processing,
 * supporting both Lambda-based (production) and local (development) execution.
 * 
 * @module jobProcessingUtils
 */

import { db } from './db';
import { logger } from './logger';
import { env } from './env';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { validateNonEmptyString, validateCustomerId } from './validators';
import { ValidationError } from './errors';

const JOBS_TABLE = env.jobsTable;
const lambdaClient = new LambdaClient({ region: env.awsRegion });

/**
 * Job status values.
 */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Payload for job processing.
 */
export interface JobProcessingPayload {
  [key: string]: unknown;
}

/**
 * Processor function type for local job processing.
 */
export type JobProcessorFunction = (
  jobId: string,
  tenantId: string,
  ...args: unknown[]
) => Promise<void>;

/**
 * Utility functions for job processing operations.
 */
export class JobProcessingUtils {
  /**
   * Trigger async job processing via Lambda or local processing.
   * 
   * In production, invokes a Lambda function asynchronously. In development,
   * processes the job locally using the provided processor function.
   * 
   * @param jobId - Job ID to process
   * @param tenantId - Tenant ID (customer ID)
   * @param payload - Payload to send to processor
   * @param processorFunction - Function to call for local processing (development only)
   * @throws {ValidationError} If jobId or tenantId are invalid
   * @throws {Error} If Lambda invocation fails or processor function is missing in local mode
   * 
   * @example
   * ```typescript
   * await JobProcessingUtils.triggerAsyncProcessing(
   *   'job-123',
   *   'customer-456',
   *   { workflow_id: 'workflow-789' },
   *   async (jobId, tenantId, ...args) => {
   *     // Local processing logic
   *   }
   * );
   * ```
   */
  static async triggerAsyncProcessing(
    jobId: string,
    tenantId: string,
    payload: JobProcessingPayload,
    processorFunction?: JobProcessorFunction
  ): Promise<void> {
    // Validate inputs
    try {
      validateNonEmptyString(jobId, 'jobId');
      validateCustomerId(tenantId);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('Invalid job processing parameters');
    }

    if (!payload || typeof payload !== 'object') {
      throw new ValidationError('Payload must be an object');
    }
    try {
      // Check if we're in local development - process synchronously
      if (env.isDevelopment()) {
        logger.info('[Job Processing] Local mode detected, processing synchronously', { jobId });
        // Process the job synchronously in local dev (fire and forget, but with error handling)
        setImmediate(async () => {
          try {
            if (processorFunction) {
              await processorFunction(jobId, tenantId, ...Object.values(payload));
            } else {
              logger.warn('[Job Processing] No processor function provided for local mode', { jobId });
            }
          } catch (error: any) {
            logger.error('[Job Processing] Error processing job in local mode', {
              jobId,
              error: error.message,
              errorStack: error.stack,
            });
            // Update job status to failed
            await db.update(JOBS_TABLE, { job_id: jobId }, {
              status: 'failed',
              error_message: `Processing failed: ${error.message}`,
              updated_at: new Date().toISOString(),
            });
          }
        });
      } else {
        // Use Lambda for production
        const functionArn = env.getLambdaFunctionArn();
        
        const invokeCommand = new InvokeCommand({
          FunctionName: functionArn,
          InvocationType: 'Event', // Async invocation
          Payload: JSON.stringify({
            ...payload,
            job_id: jobId,
            tenant_id: tenantId,
          }),
        });

        const invokeResponse = await lambdaClient.send(invokeCommand);
        logger.info('[Job Processing] Triggered async processing', { 
          jobId, 
          functionArn,
          statusCode: invokeResponse.StatusCode,
          requestId: invokeResponse.$metadata.requestId,
        });
        
        // Check if invocation was successful
        if (invokeResponse.StatusCode !== 202 && invokeResponse.StatusCode !== 200) {
          throw new Error(`Lambda invocation returned status ${invokeResponse.StatusCode}`);
        }
      }
    } catch (error: any) {
      logger.error('[Job Processing] Failed to trigger async processing', {
        error: error.message,
        errorStack: error.stack,
        jobId,
        isLocal: env.isDevelopment(),
      });
      // Update job status to failed
      await db.update(JOBS_TABLE, { job_id: jobId }, {
        status: 'failed',
        error_message: `Failed to start processing: ${error.message}`,
        updated_at: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Update job status in the database.
   * 
   * Updates the job record with the new status and optional error message.
   * Automatically sets timestamps (started_at for processing, completed_at for completed).
   * 
   * @param jobId - Job ID to update
   * @param status - New job status
   * @param errorMessage - Optional error message (for failed jobs)
   * @throws {ValidationError} If jobId is invalid
   * @throws {Error} If database update fails
   * 
   * @example
   * ```typescript
   * await JobProcessingUtils.updateJobStatus('job-123', 'processing');
   * await JobProcessingUtils.updateJobStatus('job-123', 'failed', 'Processing error');
   * ```
   */
  static async updateJobStatus(
    jobId: string,
    status: JobStatus,
    errorMessage?: string
  ): Promise<void> {
    validateNonEmptyString(jobId, 'jobId');
    await db.update(JOBS_TABLE, { job_id: jobId }, {
      status,
      error_message: errorMessage || null,
      updated_at: new Date().toISOString(),
      ...(status === 'processing' ? { started_at: new Date().toISOString() } : {}),
      ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
    });
  }
}

