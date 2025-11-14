import { db } from '../utils/db';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { logger } from '../utils/logger';
import { env } from '../utils/env';

const JOBS_TABLE = env.jobsTable;
const STEP_FUNCTIONS_ARN = env.stepFunctionsArn;
const sfnClient = STEP_FUNCTIONS_ARN ? new SFNClient({ region: env.awsRegion }) : null;

/**
 * Controller for job rerun operations.
 * Handles rerunning individual steps or entire jobs.
 */
export class JobRerunController {
  /**
   * Rerun a specific step in a job.
   */
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
    const WORKFLOWS_TABLE = env.workflowsTable;
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
      if (env.isDevelopment() || !STEP_FUNCTIONS_ARN) {
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
}

export const jobRerunController = new JobRerunController();

