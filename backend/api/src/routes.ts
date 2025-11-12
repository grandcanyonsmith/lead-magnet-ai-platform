import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { workflowsController } from './controllers/workflows';
import { formsController } from './controllers/forms';
import { templatesController } from './controllers/templates';
import { jobsController } from './controllers/jobs';
import { submissionsController } from './controllers/submissions';
import { artifactsController } from './controllers/artifacts';
import { settingsController } from './controllers/settings';
import { analyticsController } from './controllers/analytics';
import { billingController } from './controllers/billing';
import { notificationsController } from './controllers/notifications';
import { webhooksController } from './controllers/webhooks';
import { ApiError } from './utils/errors';
import { logger } from './utils/logger';

export interface RouteResponse {
  statusCode: number;
  body: any;
}

export const router = async (
  event: APIGatewayProxyEventV2,
  tenantId?: string
): Promise<RouteResponse> => {
  const method = event.requestContext.http.method;
  const path = event.rawPath;
  const body = event.body ? JSON.parse(event.body) : undefined;
  const queryParams = event.queryStringParameters || {};

  // Debug logging for route matching
  logger.info('[Router] Request received', {
    method,
    path,
    rawPath: event.rawPath,
    pathParameters: event.pathParameters,
    tenantId,
  });

  // Extract path segments for catch-all routing
  const pathSegments = path.split('/').filter(s => s);

  // Handle OPTIONS requests for CORS preflight (must be before other route checks)
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      body: {},
    };
  }

  // Public routes (form rendering and submission)
  if (path.match(/^\/v1\/forms\/[^/]+$/) && method === 'GET') {
    const slug = pathSegments[2]; // /v1/forms/{slug}
    return await formsController.getPublicForm(slug);
  }

  if (path.match(/^\/v1\/forms\/[^/]+\/submit$/) && method === 'POST') {
    const slug = pathSegments[2]; // /v1/forms/{slug}/submit
    return await formsController.submitForm(slug, body, event.requestContext.http.sourceIp);
  }

  // Public job status endpoint (for form submissions)
  if (path.match(/^\/v1\/jobs\/[^/]+\/status$/) && method === 'GET') {
    const jobId = pathSegments[2]; // /v1/jobs/{jobId}/status
    logger.info('[Router] Matched /v1/jobs/:jobId/status route', { jobId, pathSegments });
    return await jobsController.getPublicStatus(jobId);
  }

  // Public webhook endpoint
  if (path.match(/^\/v1\/webhooks\/[^/]+$/) && method === 'POST') {
    const token = pathSegments[2]; // /v1/webhooks/{token}
    logger.info('[Router] Matched /v1/webhooks/:token route', { token, pathSegments });
    return await webhooksController.handleWebhook(token, body, event.requestContext.http.sourceIp);
  }

  // All admin routes require tenantId
  if (!tenantId) {
    throw new ApiError('Please sign in to access this page', 401);
  }

  // Admin routes - Workflows
  if (path === '/admin/workflows' && method === 'GET') {
    logger.info('[Router] Matched /admin/workflows GET route');
    const result = await workflowsController.list(tenantId, queryParams);
    logger.info('[Router] Workflows list result', {
      statusCode: result.statusCode,
      hasBody: !!result.body,
      bodyKeys: result.body ? Object.keys(result.body) : null,
    });
    return result;
  }

  if (path === '/admin/workflows' && method === 'POST') {
    return await workflowsController.create(tenantId, body);
  }

  if (path === '/admin/workflows/generate-with-ai' && method === 'POST') {
    logger.info('[Router] Matched /admin/workflows/generate-with-ai route');
    return await workflowsController.generateWithAI(tenantId, body);
  }

  if (path.match(/^\/admin\/workflows\/generation-status\/[^/]+$/) && method === 'GET') {
    const jobId = pathSegments[3];
    logger.info('[Router] Matched /admin/workflows/generation-status/:jobId route', { jobId });
    return await workflowsController.getGenerationStatus(tenantId, jobId);
  }

  // Manual job processing endpoint (for local development)
  if (path.match(/^\/admin\/workflows\/process-job\/[^/]+$/) && method === 'POST') {
    const jobId = pathSegments[3];
    logger.info('[Router] Matched /admin/workflows/process-job/:jobId route', { jobId });
    // Process the job synchronously (for local dev)
    await workflowsController.processWorkflowGenerationJob(
      jobId,
      tenantId,
      '', // Will be loaded from job
      'gpt-5'
    );
    return {
      statusCode: 200,
      body: { message: 'Job processing started', job_id: jobId },
    };
  }

  if (path === '/admin/workflows/refine-instructions' && method === 'POST') {
    logger.info('[Router] Matched /admin/workflows/refine-instructions route');
    return await workflowsController.refineInstructions(tenantId, body);
  }

  if (path.match(/^\/admin\/workflows\/[^/]+\/execution-plan$/) && method === 'GET') {
    const id = pathSegments[2];
    return await workflowsController.getExecutionPlan(tenantId, id);
  }

  if (path.match(/^\/admin\/workflows\/[^/]+\/validate-dependencies$/) && method === 'POST') {
    const id = pathSegments[2];
    return await workflowsController.validateDependencies(tenantId, id, body);
  }

  if (path.match(/^\/admin\/workflows\/[^/]+\/ai-step$/) && method === 'POST') {
    const id = pathSegments[2];
    logger.info('[Router] Matched /admin/workflows/:id/ai-step route', { id });
    return await workflowsController.aiGenerateStep(tenantId, id, body);
  }

  if (path.match(/^\/admin\/workflows\/[^/]+\/ai-edit$/) && method === 'POST') {
    const id = pathSegments[2];
    logger.info('[Router] Matched /admin/workflows/:id/ai-edit route', { id });
    return await workflowsController.aiEditWorkflow(tenantId, id, body);
  }

  if (path.match(/^\/admin\/workflows\/[^/]+$/) && method === 'GET') {
    const id = pathSegments[2];
    return await workflowsController.get(tenantId, id);
  }

  if (path.match(/^\/admin\/workflows\/[^/]+$/) && method === 'PUT') {
    const id = pathSegments[2];
    return await workflowsController.update(tenantId, id, body);
  }

  if (path.match(/^\/admin\/workflows\/[^/]+$/) && method === 'DELETE') {
    const id = pathSegments[2];
    return await workflowsController.delete(tenantId, id);
  }

  // Admin routes - Forms
  if (path === '/admin/forms' && method === 'GET') {
    return await formsController.list(tenantId, queryParams);
  }

  if (path === '/admin/forms' && method === 'POST') {
    return await formsController.create(tenantId, body);
  }

  if (path === '/admin/forms/generate-css' && method === 'POST') {
    logger.info('[Router] Matched /admin/forms/generate-css route');
    return await formsController.generateCSS(tenantId, body);
  }

  if (path === '/admin/forms/refine-css' && method === 'POST') {
    logger.info('[Router] Matched /admin/forms/refine-css route');
    return await formsController.refineCSS(tenantId, body);
  }

  if (path.match(/^\/admin\/forms\/[^/]+$/) && method === 'GET') {
    const id = pathSegments[2];
    return await formsController.get(tenantId, id);
  }

  if (path.match(/^\/admin\/forms\/[^/]+$/) && method === 'PUT') {
    const id = pathSegments[2];
    return await formsController.update(tenantId, id, body);
  }

  if (path.match(/^\/admin\/forms\/[^/]+$/) && method === 'DELETE') {
    const id = pathSegments[2];
    return await formsController.delete(tenantId, id);
  }

  // Admin routes - Templates
  if (path === '/admin/templates' && method === 'GET') {
    return await templatesController.list(tenantId, queryParams);
  }

  if (path === '/admin/templates' && method === 'POST') {
    return await templatesController.create(tenantId, body);
  }

  if (path === '/admin/templates/generate' && method === 'POST') {
    logger.info('[Router] Matched /admin/templates/generate route');
    return await templatesController.generateWithAI(tenantId, body);
  }

  if (path === '/admin/templates/refine' && method === 'POST') {
    logger.info('[Router] Matched /admin/templates/refine route');
    return await templatesController.refineWithAI(tenantId, body);
  }

  if (path.match(/^\/admin\/templates\/[^/]+$/) && method === 'GET') {
    const id = pathSegments[2];
    return await templatesController.get(tenantId, id);
  }

  if (path.match(/^\/admin\/templates\/[^/]+$/) && method === 'PUT') {
    const id = pathSegments[2];
    return await templatesController.update(tenantId, id, body);
  }

  if (path.match(/^\/admin\/templates\/[^/]+$/) && method === 'DELETE') {
    const id = pathSegments[2];
    return await templatesController.delete(tenantId, id);
  }

  // Admin routes - Jobs
  if (path === '/admin/jobs' && method === 'GET') {
    return await jobsController.list(tenantId, queryParams);
  }

  if (path.match(/^\/admin\/jobs\/[^/]+\/resubmit$/) && method === 'POST') {
    const id = pathSegments[2];
    logger.info('[Router] Matched /admin/jobs/:id/resubmit route', { id, pathSegments });
    return await jobsController.resubmit(tenantId, id);
  }

  // Debug logging for rerun-step route
  const rerunStepMatch = path.match(/^\/admin\/jobs\/[^/]+\/rerun-step\/?$/);
  logger.info('[Router] Checking rerun-step route', {
    path,
    method,
    rerunStepMatch: !!rerunStepMatch,
    pathSegments,
    pathSegmentsLength: pathSegments.length,
    bodyKeys: body ? Object.keys(body) : null,
    stepIndex: body?.step_index,
    bodyType: typeof body,
  });

  if (rerunStepMatch && method === 'POST') {
    const id = pathSegments[2];
    logger.info('[Router] Matched /admin/jobs/:id/rerun-step route', { id, stepIndex: body?.step_index, pathSegments });
    const stepIndex = body?.step_index;
    if (stepIndex === undefined || stepIndex === null) {
      throw new ApiError('step_index is required in request body', 400);
    }
    return await jobsController.rerunStep(tenantId, id, stepIndex);
  }

  if (path.match(/^\/admin\/jobs\/[^/]+$/) && method === 'GET') {
    const id = pathSegments[2];
    return await jobsController.get(tenantId, id);
  }

  // Admin routes - Submissions
  if (path === '/admin/submissions' && method === 'GET') {
    return await submissionsController.list(tenantId, queryParams);
  }

  if (path.match(/^\/admin\/submissions\/[^/]+$/) && method === 'GET') {
    const id = pathSegments[2];
    return await submissionsController.get(tenantId, id);
  }

  // Admin routes - Artifacts
  if (path === '/admin/artifacts' && method === 'GET') {
    return await artifactsController.list(tenantId, queryParams);
  }

  if (path.match(/^\/admin\/artifacts\/[^/]+$/) && method === 'GET') {
    const id = pathSegments[2];
    return await artifactsController.get(tenantId, id);
  }

  // Admin routes - Settings
  if (path === '/admin/settings' && method === 'GET') {
    return await settingsController.get(tenantId);
  }

  if (path === '/admin/settings' && method === 'PUT') {
    return await settingsController.update(tenantId, body);
  }

  if (path === '/admin/settings/webhook' && method === 'GET') {
    return await settingsController.getWebhookUrl(tenantId);
  }

  if (path === '/admin/settings/webhook/regenerate' && method === 'POST') {
    return await settingsController.regenerateWebhookToken(tenantId);
  }

  // Admin routes - Billing
  if (path === '/admin/billing/usage' && method === 'GET') {
    return await billingController.getUsage(tenantId, queryParams);
  }

  // Admin routes - Analytics
  if (path === '/admin/analytics' && method === 'GET') {
    logger.info('[Router] Matched /admin/analytics GET route');
    const result = await analyticsController.getAnalytics(tenantId, queryParams);
    logger.info('[Router] Analytics result', {
      statusCode: result.statusCode,
      hasBody: !!result.body,
      bodyKeys: result.body ? Object.keys(result.body) : null,
    });
    return result;
  }

  // Admin routes - Notifications
  if (path === '/admin/notifications' && method === 'GET') {
    return await notificationsController.list(tenantId, queryParams);
  }

  if (path.match(/^\/admin\/notifications\/[^/]+\/read$/) && method === 'PUT') {
    const notificationId = pathSegments[2];
    return await notificationsController.markAsRead(tenantId, notificationId);
  }

  if (path === '/admin/notifications/read-all' && method === 'PUT') {
    return await notificationsController.markAllAsRead(tenantId);
  }

  // Route not found
  throw new ApiError('This page doesn\'t exist', 404);
};

