"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAuthRoutes = registerAuthRoutes;
const auth_1 = require("../controllers/auth");
const router_1 = require("./router");
const logger_1 = require("../utils/logger");
/**
 * Auth routes
 */
function registerAuthRoutes() {
    // Get current user info
    router_1.router.register('GET', '/me', async (params, body, query, tenantId, context) => {
        logger_1.logger.info('[Auth Routes] GET /me');
        return await auth_1.authController.getMe(params, body, query, tenantId, context);
    }, true);
}
//# sourceMappingURL=authRoutes.js.map