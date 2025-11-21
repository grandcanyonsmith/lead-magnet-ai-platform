"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhooksController = void 0;
const ulid_1 = require("ulid");
const client_sfn_1 = require("@aws-sdk/client-sfn");
const db_1 = require("../utils/db");
const validation_1 = require("../utils/validation");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const jobProcessor_1 = require("../services/jobProcessor");
const env_1 = require("../utils/env");
const USER_SETTINGS_TABLE = env_1.env.userSettingsTable;
const WORKFLOWS_TABLE = env_1.env.workflowsTable;
const SUBMISSIONS_TABLE = env_1.env.submissionsTable;
const JOBS_TABLE = env_1.env.jobsTable;
const STEP_FUNCTIONS_ARN = env_1.env.stepFunctionsArn;
const sfnClient = new client_sfn_1.SFNClient({ region: env_1.env.awsRegion });
class WebhooksController {
    /**
     * Handle incoming webhook POST request
     * Looks up user by token, finds workflow, creates submission/job, and triggers execution
     */
    async handleWebhook(token, body, sourceIp) {
        logger_1.logger.info('[Webhooks] Handling webhook request', { token, hasBody: !!body });
        // Look up user_settings by webhook_token
        // Since we don't have a GSI on webhook_token, we'll need to scan or query
        // For MVP, we'll scan the user_settings table (acceptable for low volume)
        const userSettings = await this.findUserByWebhookToken(token);
        if (!userSettings) {
            throw new errors_1.ApiError('Invalid webhook token', 404);
        }
        const tenantId = userSettings.tenant_id;
        logger_1.logger.info('[Webhooks] Found user for token', { tenantId });
        // Validate request body
        const validatedBody = (0, validation_1.validate)(validation_1.webhookRequestSchema, body);
        // Find workflow by workflow_id or workflow_name
        let workflow;
        if (validatedBody.workflow_id) {
            workflow = await db_1.db.get(WORKFLOWS_TABLE, { workflow_id: validatedBody.workflow_id });
            if (!workflow || workflow.deleted_at) {
                throw new errors_1.ApiError('Workflow not found', 404);
            }
            if (workflow.tenant_id !== tenantId) {
                throw new errors_1.ApiError('You don\'t have permission to access this workflow', 403);
            }
        }
        else if (validatedBody.workflow_name) {
            // Query workflows by tenant_id and workflow_name
            const workflowsResult = await db_1.db.query(WORKFLOWS_TABLE, 'gsi_tenant_status', 'tenant_id = :tenant_id', { ':tenant_id': tenantId });
            const workflows = (0, db_1.normalizeQueryResult)(workflowsResult);
            workflow = workflows.find((w) => w.workflow_name === validatedBody.workflow_name && !w.deleted_at);
            if (!workflow) {
                throw new errors_1.ApiError('Workflow not found', 404);
            }
        }
        else {
            throw new errors_1.ApiError('Either workflow_id or workflow_name is required', 400);
        }
        logger_1.logger.info('[Webhooks] Found workflow', { workflowId: workflow.workflow_id });
        // Extract form data (accept any structure)
        const formData = validatedBody.form_data || validatedBody.submission_data || {};
        // Ensure name, email, and phone are present (required by submission schema)
        // If not provided, use defaults
        const submissionData = {
            name: formData.name || 'Webhook Submission',
            email: formData.email || 'webhook@example.com',
            phone: formData.phone || '',
            ...formData, // Include all other form data
        };
        // Create submission record
        const submissionId = `sub_${(0, ulid_1.ulid)()}`;
        const submission = {
            submission_id: submissionId,
            tenant_id: tenantId,
            workflow_id: workflow.workflow_id,
            submission_data: submissionData,
            submitter_ip: sourceIp,
            submitter_email: submissionData.email || null,
            submitter_phone: submissionData.phone || null,
            submitter_name: submissionData.name || null,
            created_at: new Date().toISOString(),
            ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90 days
        };
        // Only include form_id if it exists (DynamoDB GSI doesn't allow null for index keys)
        if (workflow.form_id) {
            submission.form_id = workflow.form_id;
        }
        await db_1.db.put(SUBMISSIONS_TABLE, submission);
        // Create job record
        const jobId = `job_${(0, ulid_1.ulid)()}`;
        const job = {
            job_id: jobId,
            tenant_id: tenantId,
            workflow_id: workflow.workflow_id,
            submission_id: submissionId,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        await db_1.db.put(JOBS_TABLE, job);
        // Update submission with job_id
        await db_1.db.update(SUBMISSIONS_TABLE, { submission_id: submissionId }, { job_id: jobId });
        // Trigger workflow execution (same logic as form submission)
        try {
            if (env_1.env.isDevelopment() || !STEP_FUNCTIONS_ARN) {
                logger_1.logger.info('[Webhooks] Local mode detected, processing job directly', { jobId });
                setImmediate(async () => {
                    try {
                        await (0, jobProcessor_1.processJobLocally)(jobId, tenantId, workflow.workflow_id, submissionId);
                    }
                    catch (error) {
                        logger_1.logger.error('[Webhooks] Error processing job in local mode', {
                            jobId,
                            error: error.message,
                            errorStack: error.stack,
                        });
                        await db_1.db.update(JOBS_TABLE, { job_id: jobId }, {
                            status: 'failed',
                            error_message: `Processing failed: ${error.message}`,
                            updated_at: new Date().toISOString(),
                        });
                    }
                });
            }
            else {
                const command = new client_sfn_1.StartExecutionCommand({
                    stateMachineArn: STEP_FUNCTIONS_ARN,
                    input: JSON.stringify({
                        job_id: jobId,
                        workflow_id: workflow.workflow_id,
                        submission_id: submissionId,
                        tenant_id: tenantId,
                    }),
                });
                await sfnClient.send(command);
                logger_1.logger.info('[Webhooks] Started Step Functions execution', { jobId, workflowId: workflow.workflow_id });
            }
        }
        catch (error) {
            logger_1.logger.error('[Webhooks] Failed to start job processing', {
                error: error.message,
                errorStack: error.stack,
                jobId,
            });
            await db_1.db.update(JOBS_TABLE, { job_id: jobId }, {
                status: 'failed',
                error_message: `Failed to start processing: ${error.message}`,
                updated_at: new Date().toISOString(),
            });
            throw new errors_1.ApiError(`Failed to start job processing: ${error.message}`, 500);
        }
        return {
            statusCode: 202,
            body: {
                message: 'Webhook received and job processing started',
                job_id: jobId,
                status: 'pending',
            },
        };
    }
    /**
     * Find user_settings by webhook_token
     * Scans the user_settings table to find matching token
     */
    async findUserByWebhookToken(token) {
        // Scan user_settings table for matching webhook_token
        // Note: This is acceptable for MVP with low volume
        // For production at scale, consider adding a GSI on webhook_token
        const items = await db_1.db.scan(USER_SETTINGS_TABLE);
        return items.find((item) => item.webhook_token === token);
    }
}
exports.webhooksController = new WebhooksController();
//# sourceMappingURL=webhooks.js.map