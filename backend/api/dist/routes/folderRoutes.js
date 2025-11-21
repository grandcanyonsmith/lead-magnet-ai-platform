"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFolderRoutes = registerFolderRoutes;
const folders_1 = require("../controllers/folders");
const router_1 = require("./router");
const logger_1 = require("../utils/logger");
/**
 * Folder-related admin routes.
 */
function registerFolderRoutes() {
    // List folders
    router_1.router.register('GET', '/admin/folders', async (_params, _body, query, tenantId) => {
        logger_1.logger.info('[Router] Matched /admin/folders GET route');
        return await folders_1.foldersController.list(tenantId, query);
    });
    // Create folder
    router_1.router.register('POST', '/admin/folders', async (_params, body, _query, tenantId) => {
        logger_1.logger.info('[Router] Matched /admin/folders POST route');
        return await folders_1.foldersController.create(tenantId, body);
    });
    // Get folder
    router_1.router.register('GET', '/admin/folders/:id', async (params, _body, _query, tenantId) => {
        logger_1.logger.info('[Router] Matched /admin/folders/:id GET route', { id: params.id });
        return await folders_1.foldersController.get(tenantId, params.id);
    });
    // Update folder
    router_1.router.register('PUT', '/admin/folders/:id', async (params, body, _query, tenantId) => {
        logger_1.logger.info('[Router] Matched /admin/folders/:id PUT route', { id: params.id });
        return await folders_1.foldersController.update(tenantId, params.id, body);
    });
    // Delete folder
    router_1.router.register('DELETE', '/admin/folders/:id', async (params, _body, _query, tenantId) => {
        logger_1.logger.info('[Router] Matched /admin/folders/:id DELETE route', { id: params.id });
        return await folders_1.foldersController.delete(tenantId, params.id);
    });
}
//# sourceMappingURL=folderRoutes.js.map