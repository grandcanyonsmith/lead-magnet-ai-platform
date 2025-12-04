import { jobsController } from '../controllers/jobs.controller';
import { executionStepsController } from '../controllers/execution-steps.controller';
import { jobRerunController } from '../controllers/job-rerun.controller';
import { router } from './router';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Job-related admin routes.
 */
export function registerJobRoutes(): void {
  // List jobs
  router.register('GET', '/admin/jobs', async (_params, _body, query, tenantId) => {
    return await jobsController.list(tenantId!, query);
  });

  // Resubmit job
  router.register('POST', '/admin/jobs/:id/resubmit', async (params, _body, _query, tenantId) => {
    logger.info('[Router] Matched /admin/jobs/:id/resubmit route', { id: params.id });
    return await jobsController.resubmit(tenantId!, params.id);
  });

  // Rerun step
  router.register('POST', '/admin/jobs/:id/rerun-step', async (params, body, _query, tenantId) => {
    logger.info('[Router] Matched /admin/jobs/:id/rerun-step route', { id: params.id, stepIndex: body?.step_index, continueAfter: body?.continue_after });
    const stepIndex = body?.step_index;
    if (stepIndex === undefined || stepIndex === null) {
      throw new ApiError('step_index is required in request body', 400);
    }
    const continueAfter = body?.continue_after === true;
    return await jobRerunController.rerunStep(tenantId!, params.id, stepIndex, continueAfter);
  });

  // Quick edit step
  router.register('POST', '/admin/jobs/:id/quick-edit-step', async (params, body, _query, tenantId) => {
    logger.info('[Router] Matched /admin/jobs/:id/quick-edit-step route', { id: params.id });
    return await executionStepsController.quickEditStep(tenantId!, params.id, body);
  });

  // Get job document
  router.register('GET', '/admin/jobs/:id/document', async (params, _body, _query, tenantId) => {
    return await jobsController.getDocument(tenantId!, params.id);
  });

  // Get execution steps
  router.register('GET', '/admin/jobs/:id/execution-steps', async (params, _body, _query, tenantId) => {
    return await executionStepsController.getExecutionSteps(tenantId!, params.id);
  });

  // Get job
  router.register('GET', '/admin/jobs/:id', async (params, _body, _query, tenantId) => {
    return await jobsController.get(tenantId!, params.id);
  });
}
