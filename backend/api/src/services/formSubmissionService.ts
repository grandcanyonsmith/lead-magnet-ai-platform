import { ulid } from 'ulid';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { db } from '../utils/db';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/errors';
import { processJobLocally } from './jobProcessor';

const SUBMISSIONS_TABLE = process.env.SUBMISSIONS_TABLE!;
const JOBS_TABLE = process.env.JOBS_TABLE!;
const STEP_FUNCTIONS_ARN = process.env.STEP_FUNCTIONS_ARN!;

const sfnClient = STEP_FUNCTIONS_ARN ? new SFNClient({ region: process.env.AWS_REGION || 'us-east-1' }) : null;

export interface FormSubmissionData {
  name: string;
  email: string;
  phone: string;
  [key: string]: any;
}

export interface SubmissionResult {
  submissionId: string;
  jobId: string;
  message: string;
  redirectUrl?: string;
}

/**
 * Service for handling form submissions and job creation.
 */
export class FormSubmissionService {
  /**
   * Create a submission and start job processing.
   * 
   * Execution Path Selection:
   * - Step Functions (Production): When STEP_FUNCTIONS_ARN is set and not in local/dev mode
   * - Direct Processing (Local): When IS_LOCAL=true OR NODE_ENV=development OR STEP_FUNCTIONS_ARN not set
   * 
   * See docs/EXECUTION_PATHS.md for detailed explanation.
   */
  async submitFormAndStartJob(
    form: any,
    submissionData: FormSubmissionData,
    sourceIp: string,
    thankYouMessage?: string,
    redirectUrl?: string
  ): Promise<SubmissionResult> {
    // Ensure name, email, and phone are present
    if (!submissionData.name || !submissionData.email || !submissionData.phone) {
      throw new ApiError('Form submission must include name, email, and phone fields', 400);
    }

    // Create submission record
    const submissionId = `sub_${ulid()}`;
    const submission = {
      submission_id: submissionId,
      tenant_id: form.tenant_id,
      form_id: form.form_id,
      workflow_id: form.workflow_id,
      submission_data: submissionData,
      submitter_ip: sourceIp,
      submitter_email: submissionData.email || null,
      submitter_phone: submissionData.phone || null,
      submitter_name: submissionData.name || null,
      created_at: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90 days
    };

    await db.put(SUBMISSIONS_TABLE, submission);

    // Create job record
    const jobId = `job_${ulid()}`;
    const job = {
      job_id: jobId,
      tenant_id: form.tenant_id,
      workflow_id: form.workflow_id,
      submission_id: submissionId,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.put(JOBS_TABLE, job);

    // Update submission with job_id
    await db.update(SUBMISSIONS_TABLE, { submission_id: submissionId }, { job_id: jobId });

    // Start job processing
    await this.startJobProcessing(jobId, form.tenant_id, form.workflow_id, submissionId);

    return {
      submissionId,
      jobId,
      message: thankYouMessage || 'Thank you! Your submission is being processed.',
      redirectUrl,
    };
  }

  /**
   * Start job processing using either Step Functions or local processing.
   */
  private async startJobProcessing(
    jobId: string,
    tenantId: string,
    workflowId: string,
    submissionId: string
  ): Promise<void> {
    try {
      // Check if we're in local development - process job directly
      if (process.env.IS_LOCAL === 'true' || process.env.NODE_ENV === 'development' || !STEP_FUNCTIONS_ARN) {
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
        isLocal: process.env.IS_LOCAL === 'true' || process.env.NODE_ENV === 'development',
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

export const formSubmissionService = new FormSubmissionService();

