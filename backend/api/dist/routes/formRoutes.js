"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFormRoutes = registerFormRoutes;
const forms_1 = require("../controllers/forms");
const formAIController_1 = require("../controllers/formAIController");
const router_1 = require("./router");
const logger_1 = require("../utils/logger");
/**
 * Form-related admin routes.
 */
function registerFormRoutes() {
    // List forms
    router_1.router.register('GET', '/admin/forms', async (_params, _body, query, tenantId) => {
        return await forms_1.formsController.list(tenantId, query);
    });
    // Create form
    router_1.router.register('POST', '/admin/forms', async (_params, body, _query, tenantId) => {
        return await forms_1.formsController.create(tenantId, body);
    });
    // Generate CSS
    router_1.router.register('POST', '/admin/forms/generate-css', async (_params, body, _query, tenantId) => {
        logger_1.logger.info('[Router] Matched /admin/forms/generate-css route');
        return await formAIController_1.formAIController.generateCSS(tenantId, body);
    });
    // Refine CSS
    router_1.router.register('POST', '/admin/forms/refine-css', async (_params, body, _query, tenantId) => {
        logger_1.logger.info('[Router] Matched /admin/forms/refine-css route');
        return await formAIController_1.formAIController.refineCSS(tenantId, body);
    });
    // Get form
    router_1.router.register('GET', '/admin/forms/:id', async (params, _body, _query, tenantId) => {
        return await forms_1.formsController.get(tenantId, params.id);
    });
    // Update form
    router_1.router.register('PUT', '/admin/forms/:id', async (params, body, _query, tenantId) => {
        return await forms_1.formsController.update(tenantId, params.id, body);
    });
    // Delete form
    router_1.router.register('DELETE', '/admin/forms/:id', async (params, _body, _query, tenantId) => {
        return await forms_1.formsController.delete(tenantId, params.id);
    });
}
//# sourceMappingURL=formRoutes.js.map