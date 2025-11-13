import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { submissionsController } from '../controllers/submissions';
import { artifactsController } from '../controllers/artifacts';
import { settingsController } from '../controllers/settings';
import { billingController } from '../controllers/billing';
import { analyticsController } from '../controllers/analytics';
import { notificationsController } from '../controllers/notifications';
import { get, post, put } from './routeBuilder';
import { routeRegistry } from './routeRegistry';
import { logger } from '../utils/logger';

/**
 * Other admin routes (submissions, artifacts, settings, billing, analytics, notifications).
 */
export function registerAdminRoutes(): void {
  // Submissions
  routeRegistry.register(
    get('/admin/submissions')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const queryParams = event.queryStringParameters || {};
        return await submissionsController.list(tenantId!, queryParams);
      })
      .priority(100)
      .build()
  );

  routeRegistry.register(
    get('/admin/submissions/:id')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
        return await submissionsController.get(tenantId!, id);
      })
      .priority(200)
      .build()
  );

  // Artifacts
  routeRegistry.register(
    get('/admin/artifacts')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const queryParams = event.queryStringParameters || {};
        return await artifactsController.list(tenantId!, queryParams);
      })
      .priority(100)
      .build()
  );

  routeRegistry.register(
    get('/admin/artifacts/:id/content')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
        return await artifactsController.getContent(tenantId!, id);
      })
      .priority(50)
      .build()
  );

  routeRegistry.register(
    get('/admin/artifacts/:id')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const id = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
        return await artifactsController.get(tenantId!, id);
      })
      .priority(200)
      .build()
  );

  // Settings
  routeRegistry.register(
    get('/admin/settings')
      .handler(async (_event: APIGatewayProxyEventV2, tenantId?: string) => {
        return await settingsController.get(tenantId!);
      })
      .priority(100)
      .build()
  );

  routeRegistry.register(
    put('/admin/settings')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const body = event.body ? JSON.parse(event.body) : undefined;
        return await settingsController.update(tenantId!, body);
      })
      .priority(100)
      .build()
  );

  routeRegistry.register(
    get('/admin/settings/webhook')
      .handler(async (_event: APIGatewayProxyEventV2, tenantId?: string) => {
        return await settingsController.getWebhookUrl(tenantId!);
      })
      .priority(50)
      .build()
  );

  routeRegistry.register(
    post('/admin/settings/webhook/regenerate')
      .handler(async (_event: APIGatewayProxyEventV2, tenantId?: string) => {
        return await settingsController.regenerateWebhookToken(tenantId!);
      })
      .priority(50)
      .build()
  );

  // Billing
  routeRegistry.register(
    get('/admin/billing/usage')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const queryParams = event.queryStringParameters || {};
        return await billingController.getUsage(tenantId!, queryParams);
      })
      .priority(100)
      .build()
  );

  // Analytics
  routeRegistry.register(
    get('/admin/analytics')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const queryParams = event.queryStringParameters || {};
        logger.info('[Router] Matched /admin/analytics GET route');
        const result = await analyticsController.getAnalytics(tenantId!, queryParams);
        logger.info('[Router] Analytics result', {
          statusCode: result.statusCode,
          hasBody: !!result.body,
          bodyKeys: result.body ? Object.keys(result.body) : null,
        });
        return result;
      })
      .priority(100)
      .build()
  );

  // Notifications
  routeRegistry.register(
    get('/admin/notifications')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const queryParams = event.queryStringParameters || {};
        return await notificationsController.list(tenantId!, queryParams);
      })
      .priority(100)
      .build()
  );

  routeRegistry.register(
    put('/admin/notifications/:id/read')
      .handler(async (event: APIGatewayProxyEventV2, tenantId?: string) => {
        const notificationId = event.pathParameters?.id || event.rawPath.split('/')[3] || '';
        return await notificationsController.markAsRead(tenantId!, notificationId);
      })
      .priority(50)
      .build()
  );

  routeRegistry.register(
    put('/admin/notifications/read-all')
      .handler(async (_event: APIGatewayProxyEventV2, tenantId?: string) => {
        return await notificationsController.markAllAsRead(tenantId!);
      })
      .priority(50)
      .build()
  );
}
