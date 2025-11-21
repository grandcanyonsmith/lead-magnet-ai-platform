"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFileRoutes = registerFileRoutes;
const files_1 = require("../controllers/files");
const router_1 = require("./router");
const logger_1 = require("../utils/logger");
/**
 * File routes
 */
function registerFileRoutes() {
    // Upload file
    router_1.router.register('POST', '/files', async (params, body, query, tenantId, context) => {
        logger_1.logger.info('[File Routes] POST /files');
        return await files_1.filesController.upload(params, body, query, tenantId, context);
    }, true);
    // List files
    router_1.router.register('GET', '/files', async (params, body, query, tenantId, context) => {
        logger_1.logger.info('[File Routes] GET /files');
        return await files_1.filesController.list(params, body, query, tenantId, context);
    }, true);
    // Get file
    router_1.router.register('GET', '/files/:fileId', async (params, body, query, tenantId, context) => {
        logger_1.logger.info('[File Routes] GET /files/:fileId', { fileId: params.fileId });
        return await files_1.filesController.get(params, body, query, tenantId, context);
    }, true);
    // Delete file
    router_1.router.register('DELETE', '/files/:fileId', async (params, body, query, tenantId, context) => {
        logger_1.logger.info('[File Routes] DELETE /files/:fileId', { fileId: params.fileId });
        return await files_1.filesController.delete(params, body, query, tenantId, context);
    }, true);
    // Search files
    router_1.router.register('POST', '/files/search', async (params, body, query, tenantId, context) => {
        logger_1.logger.info('[File Routes] POST /files/search');
        return await files_1.filesController.search(params, body, query, tenantId, context);
    }, true);
}
//# sourceMappingURL=fileRoutes.js.map