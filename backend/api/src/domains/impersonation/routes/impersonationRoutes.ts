import { impersonationController } from '../controllers/impersonation.controller';
import { router } from '@routes/router';
import { logger } from '@utils/logger';

/**
 * Impersonation routes (admin only)
 */
export function registerImpersonationRoutes(): void {
  // Start impersonation
  router.register('POST', '/admin/impersonate', async (params, body, query, tenantId, context) => {
    logger.info('[Impersonation Routes] POST /admin/impersonate');
    return await impersonationController.start(params, body, query, tenantId, context);
  }, true);

  // Stop impersonation
  router.register('POST', '/admin/impersonate/reset', async (params, body, query, tenantId, context) => {
    logger.info('[Impersonation Routes] POST /admin/impersonate/reset');
    return await impersonationController.reset(params, body, query, tenantId, context);
  }, true);
}

