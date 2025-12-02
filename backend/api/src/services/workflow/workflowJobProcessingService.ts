import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { db } from '../../utils/db';
import { logger } from '../../utils/logger';
import { env } from '../../utils/env';
import { validateNonEmptyString, validateCustomerId } from '../../utils/validators';
import { ValidationError } from '../../utils/errors';

const JOBS_TABLE = env.jobsTable;
const lambdaClient = new LambdaClient({ region: env.awsRegion });

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface JobProcessingPayload {
  [key: string]: unknown;
}

export type JobProcessorFunction = (
  jobId: string,
  tenantId: string,
  ...args: unknown[]
) => Promise<void>;

export class JobProcessingUtils {
  static async triggerAsyncProcessing(
    jobId: string,
    tenantId: string,
    payload: JobProcessingPayload,
    processorFunction?: JobProcessorFunction
  ): Promise<void> {
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
      if (env.isDevelopment()) {
        logger.info('[Job Processing] Local mode detected, processing synchronously', { jobId });
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
            await db.update(JOBS_TABLE, { job_id: jobId }, {
              status: 'failed',
              error_message: `Processing failed: ${error.message}`,
              updated_at: new Date().toISOString(),
            });
          }
        });
      } else {
        const functionArn = env.getLambdaFunctionArn();

        const invokeCommand = new InvokeCommand({
          FunctionName: functionArn,
          InvocationType: 'Event',
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
      await db.update(JOBS_TABLE, { job_id: jobId }, {
        status: 'failed',
        error_message: `Failed to start processing: ${error.message}`,
        updated_at: new Date().toISOString(),
      });
      throw error;
    }
  }

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
