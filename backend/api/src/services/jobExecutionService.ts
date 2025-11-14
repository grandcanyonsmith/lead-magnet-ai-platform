import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { db } from '../utils/db';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/errors';
import { processJobLocally } from './jobProcessor';
import { env } from '../utils/env';

const JOBS_TABLE = env.jobsTable;
const STEP_FUNCTIONS_ARN = env.stepFunctionsArn;

const sfnClient = STEP_FUNCTIONS_ARN ? new SFNClient({ region: env.awsRegion }) : null;

export interface JobExecutionParams {
  jobId: string;
  tenantId: string;
  workflowId: string;
  submissionId: string;
}

/**
 * Service for handling job execution via Step Functions or local processing.
 * 
 * Execution Path Selection:
 * - Step Functions (Production): When STEP_FUNCTIONS_ARN is set and not in local/dev mode
 * - Direct Processing (Local): When IS_LOCAL=true OR NODE_ENV=development OR STEP_FUNCTIONS_ARN not set
 * 
 * See docs/EXECUTION_PATHS.md for detailed explanation.
 */
export class JobExecutionService {
  /**
   * Start job processing using either Step Functions or local processing.
   */
  async startJobProcessing(params: JobExecutionParams): Promise<void> {
    const { jobId, tenantId, workflowId, submissionId } = params;

    try {
      // Check if we're in local development - process job directly
      if (env.isDevelopment() || !STEP_FUNCTIONS_ARN) {
        logger.info('Local mode detected, processing job directly', { jobId });
        
        // Import worker processor for local processing
        setImmediate(async () => {
          try {
            await processJobLocally(jobId, tenantId, workflowId, submissionId);
          } catch (error: any) {
            logger.error('Error processing job in local mode', {
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
        // Use Step Functions for production
        const command = new StartExecutionCommand({
          stateMachineArn: STEP_FUNCTIONS_ARN,
          input: JSON.stringify({
            job_id: jobId,
            workflow_id: workflowId,
            submission_id: submissionId,
            tenant_id: tenantId,
          }),
        });

        await sfnClient!.send(command);
        logger.info('Started Step Functions execution', { jobId, workflowId });
      }
    } catch (error: any) {
      logger.error('Failed to start job processing', { 
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
      throw new ApiError(`Failed to start job processing: ${error.message}`, 500);
    }
  }
}

export const jobExecutionService = new JobExecutionService();

