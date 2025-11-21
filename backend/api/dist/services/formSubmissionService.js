"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formSubmissionService = exports.FormSubmissionService = void 0;
const ulid_1 = require("ulid");
const client_sfn_1 = require("@aws-sdk/client-sfn");
const db_1 = require("../utils/db");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
const jobProcessor_1 = require("./jobProcessor");
const env_1 = require("../utils/env");
const SUBMISSIONS_TABLE = env_1.env.submissionsTable;
const JOBS_TABLE = env_1.env.jobsTable;
const STEP_FUNCTIONS_ARN = env_1.env.stepFunctionsArn;
const sfnClient = STEP_FUNCTIONS_ARN ? new client_sfn_1.SFNClient({ region: env_1.env.awsRegion }) : null;
/**
 * Service for handling form submissions and job creation.
 */
class FormSubmissionService {
    /**
     * Create a submission and start job processing.
     *
     * Execution Path Selection:
     * - Step Functions (Production): When STEP_FUNCTIONS_ARN is set and not in local/dev mode
     * - Direct Processing (Local): When IS_LOCAL=true OR NODE_ENV=development OR STEP_FUNCTIONS_ARN not set
     *
     * See docs/EXECUTION_PATHS.md for detailed explanation.
     */
    async submitFormAndStartJob(form, submissionData, sourceIp, thankYouMessage, redirectUrl) {
        // Ensure name, email, and phone are present
        if (!submissionData.name || !submissionData.email || !submissionData.phone) {
            throw new errors_1.ApiError('Form submission must include name, email, and phone fields', 400);
        }
        // Create submission record
        const submissionId = `sub_${(0, ulid_1.ulid)()}`;
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
        await db_1.db.put(SUBMISSIONS_TABLE, submission);
        // Create job record
        const jobId = `job_${(0, ulid_1.ulid)()}`;
        const job = {
            job_id: jobId,
            tenant_id: form.tenant_id,
            workflow_id: form.workflow_id,
            submission_id: submissionId,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        await db_1.db.put(JOBS_TABLE, job);
        // Update submission with job_id
        await db_1.db.update(SUBMISSIONS_TABLE, { submission_id: submissionId }, { job_id: jobId });
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
    async startJobProcessing(jobId, tenantId, workflowId, submissionId) {
        try {
            // Check if we're in local development - process job directly
            if (env_1.env.isDevelopment() || !STEP_FUNCTIONS_ARN) {
                logger_1.logger.info('Local mode detected, processing job directly', { jobId });
                // Import worker processor for local processing
                setImmediate(async () => {
                    try {
                        await (0, jobProcessor_1.processJobLocally)(jobId, tenantId, workflowId, submissionId);
                    }
                    catch (error) {
                        logger_1.logger.error('Error processing job in local mode', {
                            jobId,
                            error: error.message,
                            errorStack: error.stack,
                        });
                        // Update job status to failed
                        await db_1.db.update(JOBS_TABLE, { job_id: jobId }, {
                            status: 'failed',
                            error_message: `Processing failed: ${error.message}`,
                            updated_at: new Date().toISOString(),
                        });
                    }
                });
            }
            else {
                // Use Step Functions for production
                const command = new client_sfn_1.StartExecutionCommand({
                    stateMachineArn: STEP_FUNCTIONS_ARN,
                    input: JSON.stringify({
                        job_id: jobId,
                        workflow_id: workflowId,
                        submission_id: submissionId,
                        tenant_id: tenantId,
                    }),
                });
                await sfnClient.send(command);
                logger_1.logger.info('Started Step Functions execution', { jobId, workflowId });
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to start job processing', {
                error: error.message,
                errorStack: error.stack,
                jobId,
                isLocal: env_1.env.isDevelopment(),
            });
            // Update job status to failed
            await db_1.db.update(JOBS_TABLE, { job_id: jobId }, {
                status: 'failed',
                error_message: `Failed to start processing: ${error.message}`,
                updated_at: new Date().toISOString(),
            });
            throw new errors_1.ApiError(`Failed to start job processing: ${error.message}`, 500);
        }
    }
}
exports.FormSubmissionService = FormSubmissionService;
exports.formSubmissionService = new FormSubmissionService();
//# sourceMappingURL=formSubmissionService.js.map