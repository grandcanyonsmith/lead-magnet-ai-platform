import { formsController } from '../controllers/forms';
import { formAIController } from '../controllers/formAIController';
import { router } from './router';
import { logger } from '../utils/logger';

/**
 * Form-related admin routes.
 */
export function registerFormRoutes(): void {
  // List forms
  router.register('GET', '/admin/forms', async (_params, _body, query, tenantId) => {
    return await formsController.list(tenantId!, query);
  });

  // Create form
  router.register('POST', '/admin/forms', async (_params, body, _query, tenantId) => {
    return await formsController.create(tenantId!, body);
  });

  // Generate CSS
  router.register('POST', '/admin/forms/generate-css', async (_params, body, _query, tenantId) => {
    logger.info('[Router] Matched /admin/forms/generate-css route');
    return await formAIController.generateCSS(tenantId!, body);
  });

  // Refine CSS
  router.register('POST', '/admin/forms/refine-css', async (_params, body, _query, tenantId) => {
    logger.info('[Router] Matched /admin/forms/refine-css route');
    return await formAIController.refineCSS(tenantId!, body);
  });

  // Get form
  router.register('GET', '/admin/forms/:id', async (params, _body, _query, tenantId) => {
    return await formsController.get(tenantId!, params.id);
  });

  // Update form
  router.register('PUT', '/admin/forms/:id', async (params, body, _query, tenantId) => {
    return await formsController.update(tenantId!, params.id, body);
  });

  // Delete form
  router.register('DELETE', '/admin/forms/:id', async (params, _body, _query, tenantId) => {
    return await formsController.delete(tenantId!, params.id);
  });
}
