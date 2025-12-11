import { ulid } from 'ulid';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { db } from '@utils/db';
import { logger } from '@utils/logger';
import { ApiError } from '@utils/errors';
import { processJobLocally } from '@services/jobProcessor';
import { env } from '@utils/env';

const SUBMISSIONS_TABLE = env.submissionsTable;
const JOBS_TABLE = env.jobsTable;
const STEP_FUNCTIONS_ARN = env.stepFunctionsArn;
const USER_SETTINGS_TABLE = env.userSettingsTable;

const sfnClient = STEP_FUNCTIONS_ARN ? new SFNClient({ region: env.awsRegion }) : null;

export interface FormSubmissionData extends Record<string, any> {
  name: string;
  email: string;
  phone: string;
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
    // Ensure name/email are present (phone is normalized below)
    if (!submissionData.name || !submissionData.email) {
      throw new ApiError('Form submission must include name and email fields', 400);
    }

    // Normalize phone number (supports custom phone field names)
    const { phoneNumber, fieldUsed } = await this.normalizePhoneNumber(submissionData, form.tenant_id);
    if (!phoneNumber) {
      throw new ApiError('Form submission must include a phone number', 400);
    }

    submissionData.phone = phoneNumber;

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
      submitter_phone: phoneNumber,
      submitter_name: submissionData.name || null,
      phone_field_used: fieldUsed,
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

    // Create shared job copies for shared workflows (non-blocking)
    const { createSharedJobCopies } = await import('@services/workflowSharingService');
    createSharedJobCopies(jobId, form.workflow_id, form.tenant_id, submissionId).catch((error: any) => {
      logger.error('[FormSubmission] Error creating shared job copies', {
        error: error.message,
        jobId,
        workflowId: form.workflow_id,
      });
    });

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
   * Normalize phone number from submission data using tenant settings.
   * Falls back to any field containing "phone" or "mobile".
   */
  private async normalizePhoneNumber(
    submissionData: Record<string, any>,
    tenantId: string
  ): Promise<{ phoneNumber: string | null; fieldUsed?: string }> {
    // Prefer explicit phone-related fields
    const preferredFields = ['phone', 'phone_number', 'phoneNumber', 'mobile', 'mobile_phone', 'contact_phone'];
    let settingsPhoneField: string | undefined;

    if (USER_SETTINGS_TABLE) {
      try {
        const settings = await db.get(USER_SETTINGS_TABLE, { tenant_id: tenantId });
        if (settings?.lead_phone_field) {
          settingsPhoneField = String(settings.lead_phone_field);
        }
      } catch (error) {
        logger.warn('[FormSubmission] Failed to load settings for phone normalization', {
          error: error instanceof Error ? error.message : String(error),
          tenantId,
        });
      }
    }

    const candidates: Array<{ value: any; field: string }> = [];

    if (settingsPhoneField && submissionData[settingsPhoneField]) {
      candidates.push({ value: submissionData[settingsPhoneField], field: settingsPhoneField });
    }

    for (const field of preferredFields) {
      if (submissionData[field]) {
        candidates.push({ value: submissionData[field], field });
      }
    }

    if (candidates.length === 0) {
      // Fallback: any field containing "phone" or "mobile"
      for (const [key, value] of Object.entries(submissionData)) {
        const lower = key.toLowerCase();
        if ((lower.includes('phone') || lower.includes('mobile')) && value) {
          candidates.push({ value, field: key });
          break;
        }
      }
    }

    const selected = candidates.find((c) => !!c.value);
    if (!selected) {
      return { phoneNumber: null };
    }

    const raw = String(selected.value).trim();
    if (!raw) {
      return { phoneNumber: null };
    }

    return { phoneNumber: raw, fieldUsed: selected.field };
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

export const formSubmissionService = new FormSubmissionService();

