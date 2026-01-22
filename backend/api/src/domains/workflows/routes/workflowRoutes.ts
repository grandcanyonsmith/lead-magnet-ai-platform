import { workflowsController } from '../controllers/workflows.controller';
import { workflowAIController } from '../controllers/workflowAIController';
import { workflowValidationController } from '../controllers/workflowValidationController';
import { workflowVersionsController } from '../controllers/workflowVersionsController';
import { router } from '@routes/router';
import { logger } from '@utils/logger';
import { workflowGenerationJobService } from '../services/workflowGenerationJobService';

/**
 * Workflow-related admin routes.
 */
export function registerWorkflowRoutes(): void {
  // Get available models
  router.register('GET', '/admin/workflows/models', async (_params, _body, _query, tenantId) => {
    logger.info('[Router] Matched /admin/workflows/models route');
    return await workflowAIController.getModels(tenantId!);
  });

  // Ideate workflow deliverables via chat
  router.register('POST', '/admin/workflows/ideate', async (_params, body, _query, tenantId) => {
    logger.info('[Router] Matched /admin/workflows/ideate route');
    return await workflowAIController.ideateWorkflow(tenantId!, body);
  });

  // Ideate workflow deliverables via chat (streamed)
  router.register('POST', '/admin/workflows/ideate/stream', async (_params, body, _query, tenantId, context) => {
    logger.info('[Router] Matched /admin/workflows/ideate/stream route');
    return await workflowAIController.ideateWorkflowStream(tenantId!, body, context);
  });

  // Generate deliverable mockups
  router.register('POST', '/admin/workflows/ideate/mockups', async (_params, body, _query, tenantId) => {
    logger.info('[Router] Matched /admin/workflows/ideate/mockups route');
    return await workflowAIController.generateIdeationMockups(tenantId!, body);
  });

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

  // Get workflow AI edit status
  router.register('GET', '/admin/workflows/ai-edit-status/:jobId', async (params, _body, _query, tenantId) => {
    logger.info('[Router] Matched /admin/workflows/ai-edit-status/:jobId route', { jobId: params.jobId });
    return await workflowAIController.getAIEditStatus(tenantId!, params.jobId);
  });

  // List workflow AI improvements
  router.register('GET', '/admin/workflows/:id/ai-improvements', async (params, _body, _query, tenantId) => {
    logger.info('[Router] Matched /admin/workflows/:id/ai-improvements route', { id: params.id });
    return await workflowAIController.listAIImprovements(tenantId!, params.id);
  });

  // Review workflow AI improvement (approve/deny)
  router.register('POST', '/admin/workflows/ai-improvements/:jobId/review', async (params, body, _query, tenantId) => {
    logger.info('[Router] Matched /admin/workflows/ai-improvements/:jobId/review route', { jobId: params.jobId });
    return await workflowAIController.reviewAIImprovement(tenantId!, params.jobId, body);
  });

  // Manual job processing (local dev)
  router.register('POST', '/admin/workflows/process-job/:jobId', async (params, _body, _query, tenantId) => {
    logger.info('[Router] Matched /admin/workflows/process-job/:jobId route', { jobId: params.jobId });
    await workflowGenerationJobService.processWorkflowGenerationJob(
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

  // AI edit workflow (streamed)
  router.register('POST', '/admin/workflows/:id/ai-edit/stream', async (params, body, _query, tenantId, context) => {
    logger.info('[Router] Matched /admin/workflows/:id/ai-edit/stream route', { id: params.id });
    return await workflowAIController.aiEditWorkflowStream(
      tenantId!,
      params.id,
      body,
      context,
    );
  });

  // AI edit workflow
  router.register('POST', '/admin/workflows/:id/ai-edit', async (params, body, _query, tenantId, context) => {
    logger.info('[Router] Matched /admin/workflows/:id/ai-edit route', { id: params.id });
    return await workflowAIController.aiEditWorkflow(
      tenantId!,
      params.id,
      body,
      context,
    );
  });

  // Test workflow step
  router.register('POST', '/admin/workflows/test-step', async (_params, body, _query, tenantId, context) => {
    logger.info('[Router] Matched /admin/workflows/test-step route');
    return await workflowAIController.testStep(tenantId!, body, context);
  });

  // Test full workflow (Playground)
  router.register('POST', '/admin/workflows/test-workflow', async (_params, body, _query, tenantId, context) => {
    logger.info('[Router] Matched /admin/workflows/test-workflow route');
    return await workflowAIController.testWorkflow(tenantId!, body, context);
  });

  // List workflow versions
  router.register('GET', '/admin/workflows/:id/versions', async (params, _body, query, tenantId) => {
    return await workflowVersionsController.list(tenantId!, params.id, query);
  });

  // Get specific workflow version
  router.register('GET', '/admin/workflows/:id/versions/:version', async (params, _body, _query, tenantId) => {
    return await workflowVersionsController.get(tenantId!, params.id, params.version);
  });

  // Restore workflow version
  router.register('POST', '/admin/workflows/:id/versions/:version/restore', async (params, _body, _query, tenantId) => {
    return await workflowVersionsController.restore(tenantId!, params.id, params.version);
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
