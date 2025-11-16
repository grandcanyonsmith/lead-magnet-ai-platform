import { foldersController } from '../controllers/folders';
import { router } from './router';
import { logger } from '../utils/logger';

/**
 * Folder-related admin routes.
 */
export function registerFolderRoutes(): void {
  // List folders
  router.register('GET', '/admin/folders', async (_params, _body, query, tenantId) => {
    logger.info('[Router] Matched /admin/folders GET route');
    return await foldersController.list(tenantId!, query);
  });

  // Create folder
  router.register('POST', '/admin/folders', async (_params, body, _query, tenantId) => {
    logger.info('[Router] Matched /admin/folders POST route');
    return await foldersController.create(tenantId!, body);
  });

  // Get folder
  router.register('GET', '/admin/folders/:id', async (params, _body, _query, tenantId) => {
    logger.info('[Router] Matched /admin/folders/:id GET route', { id: params.id });
    return await foldersController.get(tenantId!, params.id);
  });

  // Update folder
  router.register('PUT', '/admin/folders/:id', async (params, body, _query, tenantId) => {
    logger.info('[Router] Matched /admin/folders/:id PUT route', { id: params.id });
    return await foldersController.update(tenantId!, params.id, body);
  });

  // Delete folder
  router.register('DELETE', '/admin/folders/:id', async (params, _body, _query, tenantId) => {
    logger.info('[Router] Matched /admin/folders/:id DELETE route', { id: params.id });
    return await foldersController.delete(tenantId!, params.id);
  });
}


