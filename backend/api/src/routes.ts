import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { workflowsController } from './controllers/workflows';
import { formsController } from './controllers/forms';
import { templatesController } from './controllers/templates';
import { jobsController } from './controllers/jobs';
import { submissionsController } from './controllers/submissions';
import { artifactsController } from './controllers/artifacts';
import { settingsController } from './controllers/settings';
import { analyticsController } from './controllers/analytics';
import { ApiError } from './utils/errors';

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
  const pathParams = event.pathParameters || {};
  const queryParams = event.queryStringParameters || {};

  // Extract path segments for catch-all routing
  const pathSegments = path.split('/').filter(s => s);

  // Public routes (form rendering and submission)
  if (path.match(/^\/v1\/forms\/[^/]+$/) && method === 'GET') {
    const slug = pathSegments[2]; // /v1/forms/{slug}
    return await formsController.getPublicForm(slug);
  }

  if (path.match(/^\/v1\/forms\/[^/]+\/submit$/) && method === 'POST') {
    const slug = pathSegments[2]; // /v1/forms/{slug}/submit
    return await formsController.submitForm(slug, body, event.requestContext.http.sourceIp);
  }

  // All admin routes require tenantId
  if (!tenantId) {
    throw new ApiError('Unauthorized', 401);
  }

  // Admin routes - Workflows
  if (path === '/admin/workflows' && method === 'GET') {
    return await workflowsController.list(tenantId, queryParams);
  }

  if (path === '/admin/workflows' && method === 'POST') {
    return await workflowsController.create(tenantId, body);
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

  // Admin routes - Analytics
  if (path === '/admin/analytics' && method === 'GET') {
    return await analyticsController.getAnalytics(tenantId, queryParams);
  }

  // Route not found
  throw new ApiError('Route not found', 404);
};

