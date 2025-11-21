"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processJobLocally = processJobLocally;
const child_process_1 = require("child_process");
const util_1 = require("util");
const db_1 = require("../utils/db");
const logger_1 = require("../utils/logger");
const env_1 = require("../utils/env");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const JOBS_TABLE = env_1.env.jobsTable;
/**
 * Process a job locally by calling the Python worker script
 */
async function processJobLocally(jobId, _tenantId, _workflowId, _submissionId) {
    logger_1.logger.info('[Local Job Processor] Starting local job processing', { jobId });
    try {
        // Update job status to processing
        await db_1.db.update(JOBS_TABLE, { job_id: jobId }, {
            status: 'processing',
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        // Try to call Python worker script if it exists
        const workerPath = env_1.env.workerScriptPath;
        try {
            // Set JOB_ID environment variable and run worker
            const { stdout, stderr } = await execAsync(`JOB_ID=${jobId} python3 ${workerPath}`, {
                cwd: process.cwd(),
                env: { ...process.env, JOB_ID: jobId },
                timeout: 300000, // 5 minute timeout
            });
            logger_1.logger.info('[Local Job Processor] Worker completed', { jobId, stdout, stderr });
        }
        catch (execError) {
            // If Python worker fails, log and mark as failed
            logger_1.logger.error('[Local Job Processor] Worker execution failed', {
                jobId,
                error: execError.message,
                stderr: execError.stderr,
            });
            await db_1.db.update(JOBS_TABLE, { job_id: jobId }, {
                status: 'failed',
                error_message: `Worker execution failed: ${execError.message}`,
                updated_at: new Date().toISOString(),
            });
            throw execError;
        }
    }
    catch (error) {
        logger_1.logger.error('[Local Job Processor] Error processing job', {
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
        throw error;
    }
}
//# sourceMappingURL=jobProcessor.js.map