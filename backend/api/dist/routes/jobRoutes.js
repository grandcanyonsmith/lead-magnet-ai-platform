"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerJobRoutes = registerJobRoutes;
const jobs_1 = require("../controllers/jobs");
const executionStepsController_1 = require("../controllers/executionStepsController");
const jobRerunController_1 = require("../controllers/jobRerunController");
const router_1 = require("./router");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
/**
 * Job-related admin routes.
 */
function registerJobRoutes() {
    // List jobs
    router_1.router.register('GET', '/admin/jobs', async (_params, _body, query, tenantId) => {
        return await jobs_1.jobsController.list(tenantId, query);
    });
    // Resubmit job
    router_1.router.register('POST', '/admin/jobs/:id/resubmit', async (params, _body, _query, tenantId) => {
        logger_1.logger.info('[Router] Matched /admin/jobs/:id/resubmit route', { id: params.id });
        return await jobs_1.jobsController.resubmit(tenantId, params.id);
    });
    // Rerun step
    router_1.router.register('POST', '/admin/jobs/:id/rerun-step', async (params, body, _query, tenantId) => {
        logger_1.logger.info('[Router] Matched /admin/jobs/:id/rerun-step route', { id: params.id, stepIndex: body?.step_index });
        const stepIndex = body?.step_index;
        if (stepIndex === undefined || stepIndex === null) {
            throw new errors_1.ApiError('step_index is required in request body', 400);
        }
        return await jobRerunController_1.jobRerunController.rerunStep(tenantId, params.id, stepIndex);
    });
    // Quick edit step
    router_1.router.register('POST', '/admin/jobs/:id/quick-edit-step', async (params, body, _query, tenantId) => {
        logger_1.logger.info('[Router] Matched /admin/jobs/:id/quick-edit-step route', { id: params.id });
        return await executionStepsController_1.executionStepsController.quickEditStep(tenantId, params.id, body);
    });
    // Get job document
    router_1.router.register('GET', '/admin/jobs/:id/document', async (params, _body, _query, tenantId) => {
        return await jobs_1.jobsController.getDocument(tenantId, params.id);
    });
    // Get execution steps
    router_1.router.register('GET', '/admin/jobs/:id/execution-steps', async (params, _body, _query, tenantId) => {
        return await executionStepsController_1.executionStepsController.getExecutionSteps(tenantId, params.id);
    });
    // Get job
    router_1.router.register('GET', '/admin/jobs/:id', async (params, _body, _query, tenantId) => {
        return await jobs_1.jobsController.get(tenantId, params.id);
    });
}
//# sourceMappingURL=jobRoutes.js.map