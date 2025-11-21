"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWorkflowGenerationJob = handleWorkflowGenerationJob;
const workflowAIController_1 = require("../controllers/workflowAIController");
const db_1 = require("../utils/db");
const env_1 = require("../utils/env");
const JOBS_TABLE = env_1.env.jobsTable;
/**
 * Handle workflow generation job (async Lambda invocation).
 * This is separate from normal API Gateway requests.
 */
async function handleWorkflowGenerationJob(event) {
    const { job_id, tenant_id, description, model } = event;
    // Load job data if description/model/tenant_id are missing
    let finalDescription = description;
    let finalModel = model || 'gpt-5';
    let finalTenantId = tenant_id;
    if (!finalDescription || !finalTenantId) {
        const job = await db_1.db.get(JOBS_TABLE, { job_id });
        if (!job) {
            throw new Error(`Job ${job_id} not found`);
        }
        finalDescription = finalDescription || job.description;
        finalModel = finalModel || job.model || 'gpt-5';
        finalTenantId = finalTenantId || job.tenant_id;
    }
    await workflowAIController_1.workflowAIController.processWorkflowGenerationJob(job_id, finalTenantId, finalDescription, finalModel);
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Workflow generation job processed' }),
    };
}
//# sourceMappingURL=workflowGenerationHandler.js.map