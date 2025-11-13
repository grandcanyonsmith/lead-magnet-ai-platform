import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { workflowsController } from '../controllers/workflows';
import { get, post, put, del } from './routeBuilder';
import { logger } from '../utils/logger';

/**
 * Workflow-related admin routes.
 */
export function registerWorkflowRoutes(): void {
  // List workflows
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
    .build();

  // Create workflow
  post('/admin/workflows')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const body = event.body ? JSON.parse(event.body) : undefined;
      return await workflowsController.create(tenantId!, body);
    })
    .priority(100)
    .build();

  // Generate workflow with AI
  post('/admin/workflows/generate-with-ai')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const body = event.body ? JSON.parse(event.body) : undefined;
      logger.info('[Router] Matched /admin/workflows/generate-with-ai route');
      return await workflowsController.generateWithAI(tenantId!, body);
    })
    .priority(50)
    .build();

  // Get generation status
  get('/admin/workflows/generation-status/:jobId')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const jobId = event.pathParameters?.jobId || event.rawPath.split('/')[4] || '';
      logger.info('[Router] Matched /admin/workflows/generation-status/:jobId route', { jobId });
      return await workflowsController.getGenerationStatus(tenantId!, jobId);
    })
    .priority(50)
    .build();

  // Manual job processing (local dev)
  post('/admin/workflows/process-job/:jobId')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const jobId = event.pathParameters?.jobId || event.rawPath.split('/')[4] || '';
      logger.info('[Router] Matched /admin/workflows/process-job/:jobId route', { jobId });
      await workflowsController.processWorkflowGenerationJob(
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
    .build();

  // Refine instructions
  post('/admin/workflows/refine-instructions')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const body = event.body ? JSON.parse(event.body) : undefined;
      logger.info('[Router] Matched /admin/workflows/refine-instructions route');
      return await workflowsController.refineInstructions(tenantId!, body);
    })
    .priority(50)
    .build();

  // Get execution plan
  get('/admin/workflows/:id/execution-plan')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
      return await workflowsController.getExecutionPlan(tenantId!, id);
    })
    .priority(50)
    .build();

  // Validate dependencies
  post('/admin/workflows/:id/validate-dependencies')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
      const body = event.body ? JSON.parse(event.body) : undefined;
      return await workflowsController.validateDependencies(tenantId!, id, body);
    })
    .priority(50)
    .build();

  // AI generate step
  post('/admin/workflows/:id/ai-step')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
      const body = event.body ? JSON.parse(event.body) : undefined;
      logger.info('[Router] Matched /admin/workflows/:id/ai-step route', { id });
      return await workflowsController.aiGenerateStep(tenantId!, id, body);
    })
    .priority(50)
    .build();

  // AI edit workflow
  post('/admin/workflows/:id/ai-edit')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
      const body = event.body ? JSON.parse(event.body) : undefined;
      logger.info('[Router] Matched /admin/workflows/:id/ai-edit route', { id });
      return await workflowsController.aiEditWorkflow(tenantId!, id, body);
    })
    .priority(50)
    .build();

  // Get workflow
  get('/admin/workflows/:id')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
      return await workflowsController.get(tenantId!, id);
    })
    .priority(200)
    .build();

  // Update workflow
  put('/admin/workflows/:id')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
      const body = event.body ? JSON.parse(event.body) : undefined;
      return await workflowsController.update(tenantId!, id, body);
    })
    .priority(200)
    .build();

  // Delete workflow
  del('/admin/workflows/:id')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
      return await workflowsController.delete(tenantId!, id);
    })
    .priority(200)
    .build();
}

