import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { templatesController } from '../controllers/templates';
import { get, post, put, del } from './routeBuilder';
import { logger } from '../utils/logger';

/**
 * Template-related admin routes.
 */
export function registerTemplateRoutes(): void {
  // List templates
  get('/admin/templates')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const queryParams = event.queryStringParameters || {};
      return await templatesController.list(tenantId!, queryParams);
    })
    .priority(100)
    .build();

  // Create template
  post('/admin/templates')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const body = event.body ? JSON.parse(event.body) : undefined;
      return await templatesController.create(tenantId!, body);
    })
    .priority(100)
    .build();

  // Generate template with AI
  post('/admin/templates/generate')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const body = event.body ? JSON.parse(event.body) : undefined;
      logger.info('[Router] Matched /admin/templates/generate route');
      return await templatesController.generateWithAI(tenantId!, body);
    })
    .priority(50)
    .build();

  // Refine template with AI
  post('/admin/templates/refine')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const body = event.body ? JSON.parse(event.body) : undefined;
      logger.info('[Router] Matched /admin/templates/refine route');
      return await templatesController.refineWithAI(tenantId!, body);
    })
    .priority(50)
    .build();

  // Get template
  get('/admin/templates/:id')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
      return await templatesController.get(tenantId!, id);
    })
    .priority(200)
    .build();

  // Update template
  put('/admin/templates/:id')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
      const body = event.body ? JSON.parse(event.body) : undefined;
      return await templatesController.update(tenantId!, id, body);
    })
    .priority(200)
    .build();

  // Delete template
  del('/admin/templates/:id')
    .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
      const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
      return await templatesController.delete(tenantId!, id);
    })
    .priority(200)
    .build();
}

