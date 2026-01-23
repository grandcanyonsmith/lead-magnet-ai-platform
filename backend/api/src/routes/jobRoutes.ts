import { jobsController } from "../controllers/jobs";
import { executionStepsController } from "../controllers/executionStepsController";
import { jobRerunController } from "../controllers/jobRerunController";
import { jobLogsController } from "../controllers/jobLogsController";
import { router } from "./router";
import { ApiError } from "../utils/errors";
import { logger } from "../utils/logger";
import { cacheMiddleware } from "../utils/cache";

/**
 * Job-related admin routes.
 */
export function registerJobRoutes(): void {
  // List jobs
  router.register(
    "GET",
    "/admin/jobs",
    async (_params, _body, query, tenantId, context) => {
      // Cache job list for 10 seconds to reduce DB load on rapid refreshes
      const cacheHandler = cacheMiddleware(10 * 1000);
      return await cacheHandler(
        context?.event,
        tenantId,
        async () => await jobsController.list(tenantId!, query),
      );
    },
  );

  // Resubmit job
  router.register(
    "POST",
    "/admin/jobs/:id/resubmit",
    async (params, _body, _query, tenantId) => {
      logger.info("[Router] Matched /admin/jobs/:id/resubmit route", {
        id: params.id,
      });
      return await jobsController.resubmit(tenantId!, params.id);
    },
  );

  // Rerun step
  router.register(
    "POST",
    "/admin/jobs/:id/rerun-step",
    async (params, body, _query, tenantId) => {
      logger.info("[Router] Matched /admin/jobs/:id/rerun-step route", {
        id: params.id,
        stepIndex: body?.step_index,
        continueAfter: body?.continue_after,
      });
      const stepIndex = body?.step_index;
      if (stepIndex === undefined || stepIndex === null) {
        throw new ApiError("step_index is required in request body", 400);
      }
      const continueAfter = body?.continue_after === true;
      return await jobRerunController.rerunStep(
        tenantId!,
        params.id,
        stepIndex,
        continueAfter,
      );
    },
  );

  // Quick edit step
  router.register(
    "POST",
    "/admin/jobs/:id/quick-edit-step",
    async (params, body, _query, tenantId) => {
      logger.info("[Router] Matched /admin/jobs/:id/quick-edit-step route", {
        id: params.id,
      });
      return await executionStepsController.quickEditStep(
        tenantId!,
        params.id,
        body,
      );
    },
  );

  // Get job document
  router.register(
    "GET",
    "/admin/jobs/:id/document",
    async (params, _body, _query, tenantId) => {
      return await jobsController.getDocument(tenantId!, params.id);
    },
  );

  // Get execution steps
  router.register(
    "GET",
    "/admin/jobs/:id/execution-steps",
    async (params, _body, _query, tenantId, context) => {
      // Cache execution steps briefly to reduce S3 load during polling.
      const cacheHandler = cacheMiddleware(5 * 1000);
      return await cacheHandler(
        context?.event,
        tenantId,
        async () =>
          await executionStepsController.getExecutionSteps(
            tenantId!,
            params.id,
          ),
      );
    },
  );

  // Get job
  router.register(
    "GET",
    "/admin/jobs/:id",
    async (params, _body, _query, tenantId, context) => {
      // Cache job details for 30 seconds
      // Note: If job status updates frequently, we might need shorter TTL or cache invalidation
      const cacheHandler = cacheMiddleware(30 * 1000);
      return await cacheHandler(
        context?.event,
        tenantId,
        async () => await jobsController.get(tenantId!, params.id),
      );
    },
  );

  // Get job status (lightweight polling)
  router.register(
    "GET",
    "/admin/jobs/:id/status",
    async (params, _body, _query, tenantId) => {
      return await jobsController.getStatus(tenantId!, params.id);
    },
  );

  // Get shell executor auto uploads for a job
  router.register(
    "GET",
    "/admin/jobs/:id/auto-uploads",
    async (params, _body, query, tenantId) => {
      return await jobsController.getAutoUploads(tenantId!, params.id, query);
    },
  );

  // Get auto upload content for a job
  router.register(
    "GET",
    "/admin/jobs/:id/auto-uploads/content",
    async (params, _body, query, tenantId) => {
      return await jobsController.getAutoUploadContent(
        tenantId!,
        params.id,
        query,
      );
    },
  );

  // Get shell executor auto upload content for a job
  router.register(
    "GET",
    "/admin/jobs/:id/auto-uploads/content",
    async (params, _body, query, tenantId) => {
      return await jobsController.getAutoUploadContent(
        tenantId!,
        params.id,
        query,
      );
    },
  );

  // Get job logs (for streaming)
  router.register(
    "GET",
    "/admin/jobs/:id/logs",
    async (params, _body, query, tenantId) => {
      logger.info("[Router] Matched /admin/jobs/:id/logs route", {
        id: params.id,
      });
      const since = query.since ? parseInt(query.since) : undefined;
      const limit = query.limit ? parseInt(query.limit) : 100;
      return await jobLogsController.getLogs(tenantId!, params.id, since, limit);
    },
  );

  // Stream job logs (SSE format)
  router.register(
    "GET",
    "/admin/jobs/:id/logs/stream",
    async (params, _body, query, tenantId) => {
      logger.info("[Router] Matched /admin/jobs/:id/logs/stream route", {
        id: params.id,
      });
      const since = query.since ? parseInt(query.since) : undefined;
      return await jobLogsController.streamLogs(tenantId!, params.id, since);
    },
  );
}
