"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerImpersonationRoutes = registerImpersonationRoutes;
const impersonation_1 = require("../controllers/impersonation");
const router_1 = require("./router");
const logger_1 = require("../utils/logger");
/**
 * Impersonation routes (admin only)
 */
function registerImpersonationRoutes() {
    // Start impersonation
    router_1.router.register('POST', '/admin/impersonate', async (params, body, query, tenantId, context) => {
        logger_1.logger.info('[Impersonation Routes] POST /admin/impersonate');
        return await impersonation_1.impersonationController.start(params, body, query, tenantId, context);
    }, true);
    // Stop impersonation
    router_1.router.register('POST', '/admin/impersonate/reset', async (params, body, query, tenantId, context) => {
        logger_1.logger.info('[Impersonation Routes] POST /admin/impersonate/reset');
        return await impersonation_1.impersonationController.reset(params, body, query, tenantId, context);
    }, true);
}
//# sourceMappingURL=impersonationRoutes.js.map