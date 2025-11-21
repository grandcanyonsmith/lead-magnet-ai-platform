"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWorkflowRoutes = registerWorkflowRoutes;
const workflows_1 = require("../controllers/workflows");
const workflowAIController_1 = require("../controllers/workflowAIController");
const workflowValidationController_1 = require("../controllers/workflowValidationController");
const router_1 = require("./router");
const logger_1 = require("../utils/logger");
/**
 * Workflow-related admin routes.
 */
function registerWorkflowRoutes() {
    // List workflows
    router_1.router.register('GET', '/admin/workflows', async (_params, _body, query, tenantId) => {
        logger_1.logger.info('[Router] Matched /admin/workflows GET route');
        const result = await workflows_1.workflowsController.list(tenantId, query);
        logger_1.logger.info('[Router] Workflows list result', {
            statusCode: result.statusCode,
            hasBody: !!result.body,
            bodyKeys: result.body ? Object.keys(result.body) : null,
        });
        return result;
    });
    // Create workflow
    router_1.router.register('POST', '/admin/workflows', async (_params, body, _query, tenantId) => {
        return await workflows_1.workflowsController.create(tenantId, body);
    });
    // Generate workflow with AI
    router_1.router.register('POST', '/admin/workflows/generate-with-ai', async (_params, body, _query, tenantId) => {
        logger_1.logger.info('[Router] Matched /admin/workflows/generate-with-ai route');
        return await workflowAIController_1.workflowAIController.generateWithAI(tenantId, body);
    });
    // Get generation status
    router_1.router.register('GET', '/admin/workflows/generation-status/:jobId', async (params, _body, _query, tenantId) => {
        logger_1.logger.info('[Router] Matched /admin/workflows/generation-status/:jobId route', { jobId: params.jobId });
        return await workflowAIController_1.workflowAIController.getGenerationStatus(tenantId, params.jobId);
    });
    // Manual job processing (local dev)
    router_1.router.register('POST', '/admin/workflows/process-job/:jobId', async (params, _body, _query, tenantId) => {
        logger_1.logger.info('[Router] Matched /admin/workflows/process-job/:jobId route', { jobId: params.jobId });
        await workflowAIController_1.workflowAIController.processWorkflowGenerationJob(params.jobId, tenantId, '', // Will be loaded from job
        'gpt-5');
        return {
            statusCode: 200,
            body: { message: 'Job processing started', job_id: params.jobId },
        };
    });
    // Refine instructions
    router_1.router.register('POST', '/admin/workflows/refine-instructions', async (_params, body, _query, tenantId) => {
        logger_1.logger.info('[Router] Matched /admin/workflows/refine-instructions route');
        return await workflowAIController_1.workflowAIController.refineInstructions(tenantId, body);
    });
    // Get execution plan
    router_1.router.register('GET', '/admin/workflows/:id/execution-plan', async (params, _body, _query, tenantId) => {
        return await workflowValidationController_1.workflowValidationController.getExecutionPlan(tenantId, params.id);
    });
    // Validate dependencies
    router_1.router.register('POST', '/admin/workflows/:id/validate-dependencies', async (params, body, _query, tenantId) => {
        return await workflowValidationController_1.workflowValidationController.validateDependencies(tenantId, params.id, body);
    });
    // AI generate step
    router_1.router.register('POST', '/admin/workflows/:id/ai-step', async (params, body, _query, tenantId) => {
        logger_1.logger.info('[Router] Matched /admin/workflows/:id/ai-step route', { id: params.id });
        return await workflowAIController_1.workflowAIController.aiGenerateStep(tenantId, params.id, body);
    });
    // AI edit workflow
    router_1.router.register('POST', '/admin/workflows/:id/ai-edit', async (params, body, _query, tenantId) => {
        logger_1.logger.info('[Router] Matched /admin/workflows/:id/ai-edit route', { id: params.id });
        return await workflowAIController_1.workflowAIController.aiEditWorkflow(tenantId, params.id, body);
    });
    // Get workflow
    router_1.router.register('GET', '/admin/workflows/:id', async (params, _body, _query, tenantId) => {
        return await workflows_1.workflowsController.get(tenantId, params.id);
    });
    // Update workflow
    router_1.router.register('PUT', '/admin/workflows/:id', async (params, body, _query, tenantId) => {
        return await workflows_1.workflowsController.update(tenantId, params.id, body);
    });
    // Delete workflow
    router_1.router.register('DELETE', '/admin/workflows/:id', async (params, _body, _query, tenantId) => {
        return await workflows_1.workflowsController.delete(tenantId, params.id);
    });
}
//# sourceMappingURL=workflowRoutes.js.map