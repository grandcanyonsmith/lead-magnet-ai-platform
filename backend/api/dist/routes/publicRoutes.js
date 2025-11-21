"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPublicRoutes = registerPublicRoutes;
const forms_1 = require("../controllers/forms");
const jobs_1 = require("../controllers/jobs");
const webhooks_1 = require("../controllers/webhooks");
const openaiWebhookController_1 = require("../controllers/openaiWebhookController");
const router_1 = require("./router");
const logger_1 = require("../utils/logger");
/**
 * Public routes that don't require authentication.
 * These routes are accessible without tenant authentication.
 */
function registerPublicRoutes() {
    // Public form rendering
    router_1.router.register('GET', '/v1/forms/:slug', async (params) => {
        logger_1.logger.info('[Public Routes] GET /v1/forms/:slug', { slug: params.slug });
        return await forms_1.formsController.getPublicForm(params.slug);
    }, false);
    // Public form submission
    router_1.router.register('POST', '/v1/forms/:slug/submit', async (params, body, _query, _tenantId, context) => {
        logger_1.logger.info('[Public Routes] POST /v1/forms/:slug/submit', { slug: params.slug });
        return await forms_1.formsController.submitForm(params.slug, body, context?.sourceIp || '');
    }, false);
    // Public job status endpoint (for form submissions)
    router_1.router.register('GET', '/v1/jobs/:jobId/status', async (params) => {
        logger_1.logger.info('[Public Routes] GET /v1/jobs/:jobId/status', { jobId: params.jobId });
        return await jobs_1.jobsController.getPublicStatus(params.jobId);
    }, false);
    // Public webhook endpoint
    router_1.router.register('POST', '/v1/webhooks/:token', async (params, body, _query, _tenantId, context) => {
        logger_1.logger.info('[Public Routes] POST /v1/webhooks/:token', { token: params.token });
        return await webhooks_1.webhooksController.handleWebhook(params.token, body, context?.sourceIp || '');
    }, false);
    // OpenAI webhook endpoint
    router_1.router.register('POST', '/v1/openai/webhook', async (_params, body, _query, _tenantId, context) => {
        logger_1.logger.info('[Public Routes] POST /v1/openai/webhook');
        const headers = context?.event?.headers || {};
        const rawBody = context?.event?.body;
        return await openaiWebhookController_1.openAIWebhookController.handleWebhook(body, headers, rawBody);
    }, false);
}
//# sourceMappingURL=publicRoutes.js.map