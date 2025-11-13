import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { workflowsController } from '../controllers/workflows';
import { workflowAIController } from '../controllers/workflowAIController';
import { workflowValidationController } from '../controllers/workflowValidationController';
import { get, post, put, del } from './routeBuilder';
import { routeRegistry } from './routeRegistry';
import { logger } from '../utils/logger';

/**
 * Workflow-related admin routes.
 */
export function registerWorkflowRoutes(): void {
  // List workflows
  routeRegistry.register(
    get('/admin/workflows')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const queryParams = event.queryStringParameters || {};
        logger.info('[Router] Matched /admin/workflows GET route');
        const result = await workflowsController.list(tenantId!, queryParams);
        logger.info('[Router] Workflows list result', {
          statusCode: result.statusCode,
          hasBody: !!result.body,
          bodyKeys: result.body ? Object.keys(result.body) : null,
        });
        return result;
      })
      .priority(100)
      .build()
  );

  // Create workflow
  routeRegistry.register(
    post('/admin/workflows')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const body = event.body ? JSON.parse(event.body) : undefined;
        return await workflowsController.create(tenantId!, body);
      })
      .priority(100)
      .build()
  );

  // Generate workflow with AI
  routeRegistry.register(
    post('/admin/workflows/generate-with-ai')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const body = event.body ? JSON.parse(event.body) : undefined;
        logger.info('[Router] Matched /admin/workflows/generate-with-ai route');
        return await workflowAIController.generateWithAI(tenantId!, body);
      })
      .priority(50)
      .build()
  );

  // Get generation status
  routeRegistry.register(
    get('/admin/workflows/generation-status/:jobId')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const jobId = event.pathParameters?.jobId || event.rawPath.split('/')[4] || '';
        logger.info('[Router] Matched /admin/workflows/generation-status/:jobId route', { jobId });
        return await workflowAIController.getGenerationStatus(tenantId!, jobId);
      })
      .priority(50)
      .build()
  );

  // Manual job processing (local dev)
  routeRegistry.register(
    post('/admin/workflows/process-job/:jobId')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const jobId = event.pathParameters?.jobId || event.rawPath.split('/')[4] || '';
        logger.info('[Router] Matched /admin/workflows/process-job/:jobId route', { jobId });
        await workflowAIController.processWorkflowGenerationJob(
          jobId,
          tenantId!,
          '', // Will be loaded from job
          'gpt-5'
        );
        return {
          statusCode: 200,
          body: { message: 'Job processing started', job_id: jobId },
        };
      })
      .priority(50)
      .build()
  );

  // Refine instructions
  routeRegistry.register(
    post('/admin/workflows/refine-instructions')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const body = event.body ? JSON.parse(event.body) : undefined;
        logger.info('[Router] Matched /admin/workflows/refine-instructions route');
        return await workflowAIController.refineInstructions(tenantId!, body);
      })
      .priority(50)
      .build()
  );

  // Get execution plan
  routeRegistry.register(
    get('/admin/workflows/:id/execution-plan')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
        return await workflowValidationController.getExecutionPlan(tenantId!, id);
      })
      .priority(50)
      .build()
  );

  // Validate dependencies
  routeRegistry.register(
    post('/admin/workflows/:id/validate-dependencies')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
        const body = event.body ? JSON.parse(event.body) : undefined;
        return await workflowValidationController.validateDependencies(tenantId!, id, body);
      })
      .priority(50)
      .build()
  );

  // AI generate step
  routeRegistry.register(
    post('/admin/workflows/:id/ai-step')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
        const body = event.body ? JSON.parse(event.body) : undefined;
        logger.info('[Router] Matched /admin/workflows/:id/ai-step route', { id });
        return await workflowAIController.aiGenerateStep(tenantId!, id, body);
      })
      .priority(50)
      .build()
  );

  // AI edit workflow
  routeRegistry.register(
    post('/admin/workflows/:id/ai-edit')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
        const body = event.body ? JSON.parse(event.body) : undefined;
        logger.info('[Router] Matched /admin/workflows/:id/ai-edit route', { id });
        return await workflowAIController.aiEditWorkflow(tenantId!, id, body);
      })
      .priority(50)
      .build()
  );

  // Get workflow
  routeRegistry.register(
    get('/admin/workflows/:id')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
        return await workflowsController.get(tenantId!, id);
      })
      .priority(200)
      .build()
  );

  // Update workflow
  routeRegistry.register(
    put('/admin/workflows/:id')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
        const body = event.body ? JSON.parse(event.body) : undefined;
        return await workflowsController.update(tenantId!, id, body);
      })
      .priority(200)
      .build()
  );

  // Delete workflow
  routeRegistry.register(
    del('/admin/workflows/:id')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
        return await workflowsController.delete(tenantId!, id);
      })
      .priority(200)
      .build()
  );
}
