"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAdminRoutes = registerAdminRoutes;
const submissions_1 = require("../controllers/submissions");
const artifacts_1 = require("../controllers/artifacts");
const settings_1 = require("../controllers/settings");
const billing_1 = require("../controllers/billing");
const analytics_1 = require("../controllers/analytics");
const notifications_1 = require("../controllers/notifications");
const admin_1 = require("../controllers/admin");
const router_1 = require("./router");
const logger_1 = require("../utils/logger");
/**
 * Other admin routes (submissions, artifacts, settings, billing, analytics, notifications).
 */
function registerAdminRoutes() {
    // Submissions
    router_1.router.register('GET', '/admin/submissions', async (_params, _body, query, tenantId) => {
        return await submissions_1.submissionsController.list(tenantId, query);
    });
    router_1.router.register('GET', '/admin/submissions/:id', async (params, _body, _query, tenantId) => {
        return await submissions_1.submissionsController.get(tenantId, params.id);
    });
    // Artifacts
    router_1.router.register('GET', '/admin/artifacts', async (_params, _body, query, tenantId) => {
        return await artifacts_1.artifactsController.list(tenantId, query);
    });
    router_1.router.register('GET', '/admin/artifacts/:id/content', async (params, _body, _query, tenantId) => {
        return await artifacts_1.artifactsController.getContent(tenantId, params.id);
    });
    router_1.router.register('GET', '/admin/artifacts/:id', async (params, _body, _query, tenantId) => {
        return await artifacts_1.artifactsController.get(tenantId, params.id);
    });
    // Settings
    router_1.router.register('GET', '/admin/settings', async (_params, _body, _query, tenantId, context) => {
        return await settings_1.settingsController.get(_params, _body, _query, tenantId, context);
    });
    router_1.router.register('PUT', '/admin/settings', async (_params, body, _query, tenantId, context) => {
        return await settings_1.settingsController.update(_params, body, _query, tenantId, context);
    });
    router_1.router.register('GET', '/admin/settings/webhook', async (_params, _body, _query, tenantId, context) => {
        return await settings_1.settingsController.getWebhookUrl(_params, _body, _query, tenantId, context);
    });
    router_1.router.register('POST', '/admin/settings/webhook/regenerate', async (_params, _body, _query, tenantId, context) => {
        return await settings_1.settingsController.regenerateWebhookToken(_params, _body, _query, tenantId, context);
    });
    // Billing
    router_1.router.register('GET', '/admin/billing/usage', async (_params, _body, query, tenantId) => {
        return await billing_1.billingController.getUsage(tenantId, query);
    });
    // Analytics
    router_1.router.register('GET', '/admin/analytics', async (_params, _body, query, tenantId) => {
        logger_1.logger.info('[Router] Matched /admin/analytics GET route');
        const result = await analytics_1.analyticsController.getAnalytics(tenantId, query);
        logger_1.logger.info('[Router] Analytics result', {
            statusCode: result.statusCode,
            hasBody: !!result.body,
            bodyKeys: result.body ? Object.keys(result.body) : null,
        });
        return result;
    });
    // Notifications
    router_1.router.register('GET', '/admin/notifications', async (_params, _body, query, tenantId) => {
        return await notifications_1.notificationsController.list(tenantId, query);
    });
    router_1.router.register('PUT', '/admin/notifications/:id/read', async (params, _body, _query, tenantId) => {
        return await notifications_1.notificationsController.markAsRead(tenantId, params.id);
    });
    router_1.router.register('PUT', '/admin/notifications/read-all', async (_params, _body, _query, tenantId) => {
        return await notifications_1.notificationsController.markAllAsRead(tenantId);
    });
    // Admin users listing
    router_1.router.register('GET', '/admin/users', async (_params, _body, query, tenantId, context) => {
        logger_1.logger.info('[Admin Routes] GET /admin/users');
        return await admin_1.adminController.listUsers(_params, _body, query, tenantId, context);
    });
    // Agency management routes (super admin only)
    router_1.router.register('GET', '/admin/agency/users', async (_params, _body, query, tenantId, context) => {
        logger_1.logger.info('[Admin Routes] GET /admin/agency/users');
        return await admin_1.adminController.listAgencyUsers(_params, _body, query, tenantId, context);
    });
    router_1.router.register('PUT', '/admin/agency/users/:userId', async (params, body, _query, tenantId, context) => {
        logger_1.logger.info('[Admin Routes] PUT /admin/agency/users/:userId', { userId: params.userId });
        return await admin_1.adminController.updateUserRole(params, body, _query, tenantId, context);
    });
    router_1.router.register('GET', '/admin/agency/customers', async (_params, _body, query, tenantId, context) => {
        logger_1.logger.info('[Admin Routes] GET /admin/agency/customers');
        return await admin_1.adminController.listAgencyCustomers(_params, _body, query, tenantId, context);
    });
}
//# sourceMappingURL=adminRoutes.js.map