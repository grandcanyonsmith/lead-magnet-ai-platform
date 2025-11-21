"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTemplateRoutes = registerTemplateRoutes;
const templates_1 = require("../controllers/templates");
const router_1 = require("./router");
const logger_1 = require("../utils/logger");
/**
 * Template-related admin routes.
 */
function registerTemplateRoutes() {
    // List templates
    router_1.router.register('GET', '/admin/templates', async (_params, _body, query, tenantId) => {
        return await templates_1.templatesController.list(tenantId, query);
    });
    // Create template
    router_1.router.register('POST', '/admin/templates', async (_params, body, _query, tenantId) => {
        return await templates_1.templatesController.create(tenantId, body);
    });
    // Generate template with AI
    router_1.router.register('POST', '/admin/templates/generate', async (_params, body, _query, tenantId) => {
        logger_1.logger.info('[Router] Matched /admin/templates/generate route');
        return await templates_1.templatesController.generateWithAI(tenantId, body);
    });
    // Refine template with AI
    router_1.router.register('POST', '/admin/templates/refine', async (_params, body, _query, tenantId) => {
        logger_1.logger.info('[Router] Matched /admin/templates/refine route');
        return await templates_1.templatesController.refineWithAI(tenantId, body);
    });
    // Get template
    router_1.router.register('GET', '/admin/templates/:id', async (params, _body, _query, tenantId) => {
        return await templates_1.templatesController.get(tenantId, params.id);
    });
    // Update template
    router_1.router.register('PUT', '/admin/templates/:id', async (params, body, _query, tenantId) => {
        return await templates_1.templatesController.update(tenantId, params.id, body);
    });
    // Delete template
    router_1.router.register('DELETE', '/admin/templates/:id', async (params, _body, _query, tenantId) => {
        return await templates_1.templatesController.delete(tenantId, params.id);
    });
}
//# sourceMappingURL=templateRoutes.js.map