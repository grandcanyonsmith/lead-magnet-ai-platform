import { submissionsController } from '../controllers/submissions';
import { artifactsController } from '../controllers/artifacts';
import { settingsController } from '../controllers/settings';
import { billingController } from '../controllers/billing';
import { analyticsController } from '../controllers/analytics';
import { notificationsController } from '../controllers/notifications';
import { adminController } from '../controllers/admin';
import { router } from './router';
import { logger } from '../utils/logger';

/**
 * Other admin routes (submissions, artifacts, settings, billing, analytics, notifications).
 */
export function registerAdminRoutes(): void {
  // Submissions
  router.register('GET', '/admin/submissions', async (_params, _body, query, tenantId) => {
    return await submissionsController.list(tenantId!, query);
  });

  router.register('GET', '/admin/submissions/:id', async (params, _body, _query, tenantId) => {
    return await submissionsController.get(tenantId!, params.id);
  });

  // Artifacts
  router.register('GET', '/admin/artifacts', async (_params, _body, query, tenantId) => {
    return await artifactsController.list(tenantId!, query);
  });

  router.register('GET', '/admin/artifacts/:id/content', async (params, _body, _query, tenantId) => {
    return await artifactsController.getContent(tenantId!, params.id);
  });

  router.register('GET', '/admin/artifacts/:id', async (params, _body, _query, tenantId) => {
    return await artifactsController.get(tenantId!, params.id);
  });

  // Settings
  router.register('GET', '/admin/settings', async (_params, _body, _query, tenantId) => {
    return await settingsController.get(tenantId!);
  });

  router.register('PUT', '/admin/settings', async (_params, body, _query, tenantId) => {
    return await settingsController.update(tenantId!, body);
  });

  router.register('GET', '/admin/settings/webhook', async (_params, _body, _query, tenantId) => {
    return await settingsController.getWebhookUrl(tenantId!);
  });

  router.register('POST', '/admin/settings/webhook/regenerate', async (_params, _body, _query, tenantId) => {
    return await settingsController.regenerateWebhookToken(tenantId!);
  });

  // Billing
  router.register('GET', '/admin/billing/usage', async (_params, _body, query, tenantId) => {
    return await billingController.getUsage(tenantId!, query);
  });

  // Analytics
  router.register('GET', '/admin/analytics', async (_params, _body, query, tenantId) => {
    logger.info('[Router] Matched /admin/analytics GET route');
    const result = await analyticsController.getAnalytics(tenantId!, query);
    logger.info('[Router] Analytics result', {
      statusCode: result.statusCode,
      hasBody: !!result.body,
      bodyKeys: result.body ? Object.keys(result.body) : null,
    });
    return result;
  });

  // Notifications
  router.register('GET', '/admin/notifications', async (_params, _body, query, tenantId) => {
    return await notificationsController.list(tenantId!, query);
  });

  router.register('PUT', '/admin/notifications/:id/read', async (params, _body, _query, tenantId) => {
    return await notificationsController.markAsRead(tenantId!, params.id);
  });

  router.register('PUT', '/admin/notifications/read-all', async (_params, _body, _query, tenantId) => {
    return await notificationsController.markAllAsRead(tenantId!);
  });

  // Admin users listing
  router.register('GET', '/admin/users', async (_params, _body, query, tenantId, context) => {
    logger.info('[Admin Routes] GET /admin/users');
    return await adminController.listUsers(_params, _body, query, tenantId, context);
  });
}
