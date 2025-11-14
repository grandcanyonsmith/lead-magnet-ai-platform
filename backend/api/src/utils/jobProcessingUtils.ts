import { db } from './db';
import { logger } from './logger';
import { env } from './env';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const JOBS_TABLE = env.jobsTable;
const lambdaClient = new LambdaClient({ region: env.awsRegion });

/**
 * Utility functions for job processing operations.
 */
export class JobProcessingUtils {
  /**
   * Trigger async job processing via Lambda or local processing.
   * 
   * @param jobId - Job ID to process
   * @param tenantId - Tenant ID
   * @param payload - Payload to send to processor
   * @param processorFunction - Function to call for local processing
   */
  static async triggerAsyncProcessing(
    jobId: string,
    tenantId: string,
    payload: any,
    processorFunction?: (jobId: string, tenantId: string, ...args: any[]) => Promise<void>
  ): Promise<void> {
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
   * Update job status.
   */
  static async updateJobStatus(
    jobId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    await db.update(JOBS_TABLE, { job_id: jobId }, {
      status,
      error_message: errorMessage || null,
      updated_at: new Date().toISOString(),
      ...(status === 'processing' ? { started_at: new Date().toISOString() } : {}),
      ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
    });
  }
}

