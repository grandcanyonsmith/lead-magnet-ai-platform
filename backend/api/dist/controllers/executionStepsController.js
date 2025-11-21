"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executionStepsController = exports.ExecutionStepsController = void 0;
const db_1 = require("../utils/db");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const executionStepsService_1 = require("../services/executionStepsService");
const env_1 = require("../utils/env");
const JOBS_TABLE = env_1.env.jobsTable;
/**
 * Controller for execution steps operations.
 * Handles fetching and editing execution steps stored in S3.
 */
class ExecutionStepsController {
    /**
     * Get execution steps for a job by fetching directly from S3.
     * This endpoint proxies the execution steps to avoid presigned URL expiration issues.
     */
    async getExecutionSteps(tenantId, jobId) {
        const job = await db_1.db.get(JOBS_TABLE, { job_id: jobId });
        if (!job) {
            throw new errors_1.ApiError('Job not found', 404);
        }
        if (job.tenant_id !== tenantId) {
            throw new errors_1.ApiError('You don\'t have permission to access this job', 403);
        }
        if (!job.execution_steps_s3_key) {
            return {
                statusCode: 200,
                body: [],
            };
        }
        try {
            const executionSteps = await executionStepsService_1.executionStepsService.fetchFromS3(job.execution_steps_s3_key);
            return {
                statusCode: 200,
                body: executionSteps,
            };
        }
        catch (error) {
            logger_1.logger.error(`Error fetching execution steps for job ${jobId}`, {
                s3Key: job.execution_steps_s3_key,
                error: error.message,
            });
            throw new errors_1.ApiError(`Failed to fetch execution steps: ${error.message}`, 500);
        }
    }
    /**
     * Quick edit a step's output using AI.
     * Fetches execution steps from S3, edits the specified step, and optionally saves back.
     */
    async quickEditStep(tenantId, jobId, body) {
        const { step_order, user_prompt, save } = body;
        // Validate required fields
        if (step_order === undefined || step_order === null) {
            throw new errors_1.ApiError('step_order is required', 400);
        }
        if (!user_prompt || typeof user_prompt !== 'string' || user_prompt.trim() === '') {
            throw new errors_1.ApiError('user_prompt is required and must be a non-empty string', 400);
        }
        // Get the job
        const job = await db_1.db.get(JOBS_TABLE, { job_id: jobId });
        if (!job) {
            throw new errors_1.ApiError('Job not found', 404);
        }
        if (job.tenant_id !== tenantId) {
            throw new errors_1.ApiError('You don\'t have permission to edit steps for this job', 403);
        }
        // Check if execution steps exist
        if (!job.execution_steps_s3_key) {
            throw new errors_1.ApiError('Execution steps not found for this job', 404);
        }
        try {
            const result = await executionStepsService_1.executionStepsService.editStep(job.execution_steps_s3_key, step_order, user_prompt, save === true);
            // If save is true, update job updated_at timestamp
            if (save === true) {
                await db_1.db.update(JOBS_TABLE, { job_id: jobId }, {
                    updated_at: new Date().toISOString(),
                });
            }
            return {
                statusCode: 200,
                body: result,
            };
        }
        catch (error) {
            if (error instanceof errors_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('[Quick Edit Step] Unexpected error', {
                jobId,
                stepOrder: step_order,
                error: error.message,
                errorType: error.constructor?.name || typeof error,
                stack: error.stack,
            });
            throw new errors_1.ApiError(`Failed to edit step: ${error.message}`, 500);
        }
    }
}
exports.ExecutionStepsController = ExecutionStepsController;
exports.executionStepsController = new ExecutionStepsController();
//# sourceMappingURL=executionStepsController.js.map