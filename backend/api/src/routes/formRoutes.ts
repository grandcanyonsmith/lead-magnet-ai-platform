import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { formsController } from '../controllers/forms';
import { formAIController } from '../controllers/formAIController';
import { get, post, put, del } from './routeBuilder';
import { routeRegistry } from './routeRegistry';
import { logger } from '../utils/logger';

/**
 * Form-related admin routes.
 */
export function registerFormRoutes(): void {
  // List forms
  routeRegistry.register(
    get('/admin/forms')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const queryParams = event.queryStringParameters || {};
        return await formsController.list(tenantId!, queryParams);
      })
      .priority(100)
      .build()
  );

  // Create form
  routeRegistry.register(
    post('/admin/forms')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const body = event.body ? JSON.parse(event.body) : undefined;
        return await formsController.create(tenantId!, body);
      })
      .priority(100)
      .build()
  );

  // Generate CSS
  routeRegistry.register(
    post('/admin/forms/generate-css')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const body = event.body ? JSON.parse(event.body) : undefined;
        logger.info('[Router] Matched /admin/forms/generate-css route');
        return await formAIController.generateCSS(tenantId!, body);
      })
      .priority(50)
      .build()
  );

  // Refine CSS
  routeRegistry.register(
    post('/admin/forms/refine-css')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const body = event.body ? JSON.parse(event.body) : undefined;
        logger.info('[Router] Matched /admin/forms/refine-css route');
        return await formAIController.refineCSS(tenantId!, body);
      })
      .priority(50)
      .build()
  );

  // Get form
  routeRegistry.register(
    get('/admin/forms/:id')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
        return await formsController.get(tenantId!, id);
      })
      .priority(200)
      .build()
  );

  // Update form
  routeRegistry.register(
    put('/admin/forms/:id')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
        const body = event.body ? JSON.parse(event.body) : undefined;
        return await formsController.update(tenantId!, id, body);
      })
      .priority(200)
      .build()
  );

  // Delete form
  routeRegistry.register(
    del('/admin/forms/:id')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
        return await formsController.delete(tenantId!, id);
      })
      .priority(200)
      .build()
  );
}
