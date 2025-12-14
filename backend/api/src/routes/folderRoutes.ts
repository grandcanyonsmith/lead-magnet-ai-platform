import { foldersController } from '../controllers/folders';
import { router } from './router';
import { logger } from '../utils/logger';

/**
 * Folder-related admin routes.
 */
export function registerFolderRoutes(): void {
  // List folders
  router.register('GET', '/admin/folders', async (_params, _body, query, tenantId, context) => {
    logger.info('[Router] Matched /admin/folders GET route');
    return await foldersController.list({}, null, query, tenantId, context);
  });

  // Create folder
  router.register('POST', '/admin/folders', async (_params, body, query, tenantId, context) => {
    logger.info('[Router] Matched /admin/folders POST route');
    return await foldersController.create({}, body, query, tenantId, context);
  });

  // Get folder
  router.register('GET', '/admin/folders/:id', async (params, _body, query, tenantId, context) => {
    logger.info('[Router] Matched /admin/folders/:id GET route', { id: params.id });
    return await foldersController.get(params, null, query, tenantId, context);
  });

  // Update folder
  router.register('PUT', '/admin/folders/:id', async (params, body, query, tenantId, context) => {
    logger.info('[Router] Matched /admin/folders/:id PUT route', { id: params.id });
    return await foldersController.update(params, body, query, tenantId, context);
  });

  // Delete folder
  router.register('DELETE', '/admin/folders/:id', async (params, _body, query, tenantId, context) => {
    logger.info('[Router] Matched /admin/folders/:id DELETE route', { id: params.id });
    return await foldersController.delete(params, null, query, tenantId, context);
  });
}

