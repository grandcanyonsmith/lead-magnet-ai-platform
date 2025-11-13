import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { RouteResponse } from '../routes';
import { formsController } from '../controllers/forms';
import { jobsController } from '../controllers/jobs';
import { webhooksController } from '../controllers/webhooks';
import { route, get, post } from './routeBuilder';
import { logger } from '../utils/logger';

/**
 * Public routes that don't require authentication.
 * These routes are accessible without tenant authentication.
 */
export function registerPublicRoutes(): void {
  // Public form rendering
  get('/v1/forms/:slug')
    .handler(async (event: APIGatewayProxyEventV2) => {
      const slug = event.pathParameters?.slug || event.rawPath.split('/').pop() || '';
      logger.info('[Public Routes] GET /v1/forms/:slug', { slug });
      return await formsController.getPublicForm(slug);
    })
    .requiresAuth(false)
    .priority(100)
    .build();

  // Public form submission
  post('/v1/forms/:slug/submit')
    .handler(async (event: APIGatewayProxyEventV2) => {
      const slug = event.pathParameters?.slug || event.rawPath.split('/')[2] || '';
      const body = event.body ? JSON.parse(event.body) : undefined;
      const sourceIp = event.requestContext.http.sourceIp;
      logger.info('[Public Routes] POST /v1/forms/:slug/submit', { slug });
      return await formsController.submitForm(slug, body, sourceIp);
    })
    .requiresAuth(false)
    .priority(100)
    .build();

  // Public job status endpoint (for form submissions)
  get('/v1/jobs/:jobId/status')
    .handler(async (event: APIGatewayProxyEventV2) => {
      const jobId = event.pathParameters?.jobId || event.rawPath.split('/')[3] || '';
      logger.info('[Public Routes] GET /v1/jobs/:jobId/status', { jobId });
      return await jobsController.getPublicStatus(jobId);
    })
    .requiresAuth(false)
    .priority(100)
    .build();

  // Public webhook endpoint
  post('/v1/webhooks/:token')
    .handler(async (event: APIGatewayProxyEventV2) => {
      const token = event.pathParameters?.token || event.rawPath.split('/')[2] || '';
      const body = event.body ? JSON.parse(event.body) : undefined;
      const sourceIp = event.requestContext.http.sourceIp;
      logger.info('[Public Routes] POST /v1/webhooks/:token', { token });
      return await webhooksController.handleWebhook(token, body, sourceIp);
    })
    .requiresAuth(false)
    .priority(100)
    .build();
}

