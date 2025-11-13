import { workflowsController } from '../controllers/workflows';
import { workflowAIController } from '../controllers/workflowAIController';
import { workflowValidationController } from '../controllers/workflowValidationController';
import { router } from './router';
import { logger } from '../utils/logger';

/**
 * Workflow-related admin routes.
 */
export function registerWorkflowRoutes(): void {
  // List workflows
  router.register('GET', '/admin/workflows', async (_params, _body, query, tenantId) => {
    logger.info('[Router] Matched /admin/workflows GET route');
    const result = await workflowsController.list(tenantId!, query);
    logger.info('[Router] Workflows list result', {
      statusCode: result.statusCode,
      hasBody: !!result.body,
      bodyKeys: result.body ? Object.keys(result.body) : null,
    });
    return result;
  });

  // Create workflow
  router.register('POST', '/admin/workflows', async (_params, body, _query, tenantId) => {
    return await workflowsController.create(tenantId!, body);
  });

  // Generate workflow with AI
  router.register('POST', '/admin/workflows/generate-with-ai', async (_params, body, _query, tenantId) => {
    logger.info('[Router] Matched /admin/workflows/generate-with-ai route');
    return await workflowAIController.generateWithAI(tenantId!, body);
  });

  // Get generation status
  router.register('GET', '/admin/workflows/generation-status/:jobId', async (params, _body, _query, tenantId) => {
    logger.info('[Router] Matched /admin/workflows/generation-status/:jobId route', { jobId: params.jobId });
    return await workflowAIController.getGenerationStatus(tenantId!, params.jobId);
  });

  // Manual job processing (local dev)
  router.register('POST', '/admin/workflows/process-job/:jobId', async (params, _body, _query, tenantId) => {
    logger.info('[Router] Matched /admin/workflows/process-job/:jobId route', { jobId: params.jobId });
    await workflowAIController.processWorkflowGenerationJob(
      params.jobId,
      tenantId!,
      '', // Will be loaded from job
      'gpt-5'
    );
    return {
      statusCode: 200,
      body: { message: 'Job processing started', job_id: params.jobId },
    };
  });

  // Refine instructions
  router.register('POST', '/admin/workflows/refine-instructions', async (_params, body, _query, tenantId) => {
    logger.info('[Router] Matched /admin/workflows/refine-instructions route');
    return await workflowAIController.refineInstructions(tenantId!, body);
  });

  // Get execution plan
  router.register('GET', '/admin/workflows/:id/execution-plan', async (params, _body, _query, tenantId) => {
    return await workflowValidationController.getExecutionPlan(tenantId!, params.id);
  });

  // Validate dependencies
  router.register('POST', '/admin/workflows/:id/validate-dependencies', async (params, body, _query, tenantId) => {
    return await workflowValidationController.validateDependencies(tenantId!, params.id, body);
  });

  // AI generate step
  router.register('POST', '/admin/workflows/:id/ai-step', async (params, body, _query, tenantId) => {
    logger.info('[Router] Matched /admin/workflows/:id/ai-step route', { id: params.id });
    return await workflowAIController.aiGenerateStep(tenantId!, params.id, body);
  });

  // AI edit workflow
  router.register('POST', '/admin/workflows/:id/ai-edit', async (params, body, _query, tenantId) => {
    logger.info('[Router] Matched /admin/workflows/:id/ai-edit route', { id: params.id });
    return await workflowAIController.aiEditWorkflow(tenantId!, params.id, body);
  });

  // Get workflow
  router.register('GET', '/admin/workflows/:id', async (params, _body, _query, tenantId) => {
    return await workflowsController.get(tenantId!, params.id);
  });

  // Update workflow
  router.register('PUT', '/admin/workflows/:id', async (params, body, _query, tenantId) => {
    return await workflowsController.update(tenantId!, params.id, body);
  });

  // Delete workflow
  router.register('DELETE', '/admin/workflows/:id', async (params, _body, _query, tenantId) => {
    return await workflowsController.delete(tenantId!, params.id);
  });
}
