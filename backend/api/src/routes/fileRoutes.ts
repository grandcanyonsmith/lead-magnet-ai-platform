import { filesController } from '../controllers/files';
import { router } from './router';
import { logger } from '../utils/logger';

/**
 * File routes
 */
export function registerFileRoutes(): void {
  // Upload file
  router.register('POST', '/files', async (params, body, query, tenantId, context) => {
    logger.info('[File Routes] POST /files');
    return await filesController.upload(params, body, query, tenantId, context);
  }, true);

  // List files
  router.register('GET', '/files', async (params, body, query, tenantId, context) => {
    logger.info('[File Routes] GET /files');
    return await filesController.list(params, body, query, tenantId, context);
  }, true);

  // Get file
  router.register('GET', '/files/:fileId', async (params, body, query, tenantId, context) => {
    logger.info('[File Routes] GET /files/:fileId', { fileId: params.fileId });
    return await filesController.get(params, body, query, tenantId, context);
  }, true);

  // Delete file
  router.register('DELETE', '/files/:fileId', async (params, body, query, tenantId, context) => {
    logger.info('[File Routes] DELETE /files/:fileId', { fileId: params.fileId });
    return await filesController.delete(params, body, query, tenantId, context);
  }, true);

  // Search files
  router.register('POST', '/files/search', async (params, body, query, tenantId, context) => {
    logger.info('[File Routes] POST /files/search');
    return await filesController.search(params, body, query, tenantId, context);
  }, true);
}

