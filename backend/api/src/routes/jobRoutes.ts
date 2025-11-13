import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { jobsController } from '../controllers/jobs';
import { get, post } from './routeBuilder';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Job-related admin routes.
 */
export function registerJobRoutes(): void {
  // List jobs
  get('/admin/jobs')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const queryParams = event.queryStringParameters || {};
      return await jobsController.list(tenantId!, queryParams);
    })
    .priority(100)
    .build();

  // Resubmit job
  post('/admin/jobs/:id/resubmit')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
      logger.info('[Router] Matched /admin/jobs/:id/resubmit route', { id });
      return await jobsController.resubmit(tenantId!, id);
    })
    .priority(50)
    .build();

  // Rerun step
  post('/admin/jobs/:id/rerun-step')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
      const body = event.body ? JSON.parse(event.body) : undefined;
      logger.info('[Router] Matched /admin/jobs/:id/rerun-step route', { id, stepIndex: body?.step_index });
      const stepIndex = body?.step_index;
      if (stepIndex === undefined || stepIndex === null) {
        throw new ApiError('step_index is required in request body', 400);
      }
      return await jobsController.rerunStep(tenantId!, id, stepIndex);
    })
    .priority(50)
    .build();

  // Quick edit step
  post('/admin/jobs/:id/quick-edit-step')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
      const body = event.body ? JSON.parse(event.body) : undefined;
      logger.info('[Router] Matched /admin/jobs/:id/quick-edit-step route', { id });
      return await jobsController.quickEditStep(tenantId!, id, body);
    })
    .priority(50)
    .build();

  // Get job document
  get('/admin/jobs/:id/document')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
      return await jobsController.getDocument(tenantId!, id);
    })
    .priority(50)
    .build();

  // Get execution steps
  get('/admin/jobs/:id/execution-steps')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
      return await jobsController.getExecutionSteps(tenantId!, id);
    })
    .priority(50)
    .build();

  // Get job
  get('/admin/jobs/:id')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
      return await jobsController.get(tenantId!, id);
    })
    .priority(200)
    .build();
}

