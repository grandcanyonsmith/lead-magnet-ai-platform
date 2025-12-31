import { formsController } from "@domains/forms";
import { jobsController } from "../controllers/jobs";
import { webhooksController } from "../controllers/webhooks";
import { stripeWebhookController } from "../controllers/stripeWebhook";
import { trackingController } from "../controllers/tracking";
import { shellToolController } from "../controllers/shellTool";
import { leadMagnetHtmlEditorController } from "../controllers/leadMagnetHtmlEditor";
import { router } from "./router";
import { logger } from "../utils/logger";
import { ApiError } from "../utils/errors";

/**
 * Public routes that don't require authentication.
 * These routes are accessible without tenant authentication.
 */
export function registerPublicRoutes(): void {
  // Health check
  router.register(
    "GET",
    "/health",
    async () => {
      return {
        statusCode: 200,
        body: { status: "ok" },
      };
    },
    false,
  );

  // Public form rendering
  router.register(
    "GET",
    "/v1/forms/:slug",
    async (params) => {
      logger.info("[Public Routes] GET /v1/forms/:slug", { slug: params.slug });
      return await formsController.getPublicForm(params.slug);
    },
    false,
  );

  // Public form submission
  router.register(
    "POST",
    "/v1/forms/:slug/submit",
    async (params, body, _query, _tenantId, context) => {
      logger.info("[Public Routes] POST /v1/forms/:slug/submit", {
        slug: params.slug,
      });
      return await formsController.submitForm(
        params.slug,
        body,
        context?.sourceIp || "",
      );
    },
    false,
  );

  // Public job status endpoint (for form submissions)
  router.register(
    "GET",
    "/v1/jobs/:jobId/status",
    async (params) => {
      logger.info("[Public Routes] GET /v1/jobs/:jobId/status", {
        jobId: params.jobId,
      });
      return await jobsController.getPublicStatus(params.jobId);
    },
    false,
  );

  // Public job document endpoint (for form submissions / sharing)
  router.register(
    "GET",
    "/v1/jobs/:jobId/document",
    async (params) => {
      logger.info("[Public Routes] GET /v1/jobs/:jobId/document", {
        jobId: params.jobId,
      });
      return await jobsController.getPublicDocument(params.jobId);
    },
    false,
  );

  // Public lead magnet HTML patch endpoint (editMode overlay) - async
  router.register(
    "POST",
    "/v1/jobs/:jobId/html/patch",
    async (params, body) => {
      logger.info("[Public Routes] POST /v1/jobs/:jobId/html/patch", {
        jobId: params.jobId,
      });
      return await leadMagnetHtmlEditorController.patch(params.jobId, body);
    },
    false,
  );

  // Public lead magnet HTML patch status endpoint
  router.register(
    "GET",
    "/v1/jobs/:jobId/html/patch/:patchId/status",
    async (params) => {
      logger.info("[Public Routes] GET /v1/jobs/:jobId/html/patch/:patchId/status", {
        jobId: params.jobId,
        patchId: params.patchId,
      });
      return await leadMagnetHtmlEditorController.getPatchStatus(params.patchId);
    },
    false,
  );

  // Public lead magnet HTML save endpoint (editMode overlay)
  router.register(
    "POST",
    "/v1/jobs/:jobId/html/save",
    async (params, body) => {
      logger.info("[Public Routes] POST /v1/jobs/:jobId/html/save", {
        jobId: params.jobId,
      });
      return await leadMagnetHtmlEditorController.save(params.jobId, body);
    },
    false,
  );

  // Public webhook endpoint
  router.register(
    "POST",
    "/v1/webhooks/:token",
    async (params, body, _query, _tenantId, context) => {
      logger.info("[Public Routes] POST /v1/webhooks/:token", {
        token: params.token,
      });
      const headers = context?.event?.headers || {};
      return await webhooksController.handleWebhook(
        params.token,
        body,
        context?.sourceIp || "",
        headers,
      );
    },
    false,
  );

  // Stripe webhook endpoint
  router.register(
    "POST",
    "/v1/stripe/webhook",
    async (_params, _body, _query, _tenantId, context) => {
      logger.info("[Public Routes] POST /v1/stripe/webhook");
      const event = context?.event;
      if (!event) {
        throw new ApiError("Missing request event", 400);
      }
      return await stripeWebhookController.handleWebhook(event);
    },
    false,
  );

  // Tracking event endpoint (public, no auth required)
  router.register(
    "POST",
    "/v1/tracking/event",
    async (_params, body, _query, _tenantId, context) => {
      logger.info("[Public Routes] POST /v1/tracking/event");
      const headers = context?.event?.headers || {};
      const userAgent = headers["user-agent"] || headers["User-Agent"];
      const referrer = headers["referer"] || headers["Referer"];
      return await trackingController.recordEvent(
        body,
        context?.sourceIp || "",
        userAgent,
        referrer,
      );
    },
    false,
  );

  // Shell tool endpoint (public, no auth required)
  router.register(
    "POST",
    "/v1/tools/shell",
    async (params, body, query, tenantId, context) => {
      logger.info("[Public Routes] POST /v1/tools/shell");
      return await shellToolController.run(
        params,
        body,
        query,
        tenantId,
        context,
      );
    },
    false,
  );
}
