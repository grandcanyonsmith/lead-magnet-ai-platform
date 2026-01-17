import { submissionsController } from "../controllers/submissions";
import { artifactsController } from "../controllers/artifacts";
import { settingsController } from "../controllers/settings";
import { billingController } from "../controllers/billing";
import { analyticsController } from "../controllers/analytics";
import { notificationsController } from "../controllers/notifications";
import { adminController } from "../controllers/admin";
import { webhookLogsController } from "../controllers/webhookLogs";
import { workflowSharingController } from "../controllers/workflowSharing.controller";
import { trackingController } from "../controllers/tracking";
import { httpRequestTestController } from "../controllers/httpRequestTest";
import { clientErrorsController } from "../controllers/clientErrors";
import { router } from "./router";
import { logger } from "../utils/logger";

/**
 * Other admin routes (submissions, artifacts, settings, billing, analytics, notifications).
 */
export function registerAdminRoutes(): void {
  // Submissions
  router.register(
    "GET",
    "/admin/submissions",
    async (_params, _body, query, tenantId) => {
      return await submissionsController.list(tenantId!, query);
    },
  );

  router.register(
    "GET",
    "/admin/submissions/:id",
    async (params, _body, _query, tenantId) => {
      return await submissionsController.get(tenantId!, params.id);
    },
  );

  // Artifacts
  router.register(
    "GET",
    "/admin/artifacts",
    async (_params, _body, query, tenantId) => {
      return await artifactsController.list(tenantId!, query);
    },
  );

  router.register(
    "GET",
    "/admin/artifacts/:id/content",
    async (params, _body, _query, tenantId) => {
      return await artifactsController.getContent(tenantId!, params.id);
    },
  );

  router.register(
    "GET",
    "/admin/artifacts/:id",
    async (params, _body, _query, tenantId) => {
      return await artifactsController.get(tenantId!, params.id);
    },
  );

  // Settings
  router.register(
    "GET",
    "/admin/settings",
    async (_params, _body, _query, tenantId, context) => {
      return await settingsController.get(
        _params,
        _body,
        _query,
        tenantId,
        context,
      );
    },
  );

  router.register(
    "PUT",
    "/admin/settings",
    async (_params, body, _query, tenantId, context) => {
      return await settingsController.update(
        _params,
        body,
        _query,
        tenantId,
        context,
      );
    },
  );

  router.register(
    "GET",
    "/admin/settings/webhook",
    async (_params, _body, _query, tenantId, context) => {
      return await settingsController.getWebhookUrl(
        _params,
        _body,
        _query,
        tenantId,
        context,
      );
    },
  );

  router.register(
    "POST",
    "/admin/settings/webhook/regenerate",
    async (_params, _body, _query, tenantId, context) => {
      return await settingsController.regenerateWebhookToken(
        _params,
        _body,
        _query,
        tenantId,
        context,
      );
    },
  );

  // Billing
  router.register(
    "GET",
    "/admin/billing/usage",
    async (_params, _body, query, tenantId) => {
      return await billingController.getUsage(tenantId!, query);
    },
  );

  router.register(
    "GET",
    "/admin/billing/subscription",
    async (_params, _body, _query, tenantId) => {
      return await billingController.getSubscription(tenantId!);
    },
  );

  router.register(
    "POST",
    "/admin/billing/checkout-session",
    async (_params, body, _query, tenantId) => {
      return await billingController.createCheckoutSession(tenantId!, body);
    },
  );

  router.register(
    "POST",
    "/admin/billing/portal-session",
    async (_params, body, _query, tenantId) => {
      return await billingController.createPortalSession(tenantId!, body);
    },
  );

  // Analytics
  router.register(
    "GET",
    "/admin/analytics",
    async (_params, _body, query, tenantId) => {
      logger.info("[Router] Matched /admin/analytics GET route");
      const result = await analyticsController.getAnalytics(tenantId!, query);
      logger.info("[Router] Analytics result", {
        statusCode: result.statusCode,
        hasBody: !!result.body,
        bodyKeys: result.body ? Object.keys(result.body) : null,
      });
      return result;
    },
  );

  // Notifications
  router.register(
    "GET",
    "/admin/notifications",
    async (_params, _body, query, tenantId) => {
      return await notificationsController.list(tenantId!, query);
    },
  );

  router.register(
    "PUT",
    "/admin/notifications/:id/read",
    async (params, _body, _query, tenantId) => {
      return await notificationsController.markAsRead(tenantId!, params.id);
    },
  );

  router.register(
    "PUT",
    "/admin/notifications/read-all",
    async (_params, _body, _query, tenantId) => {
      return await notificationsController.markAllAsRead(tenantId!);
    },
  );

  // Admin users listing
  router.register(
    "GET",
    "/admin/users",
    async (_params, _body, query, tenantId, context) => {
      logger.info("[Admin Routes] GET /admin/users");
      return await adminController.listUsers(
        _params,
        _body,
        query,
        tenantId,
        context,
      );
    },
  );

  router.register(
    "GET",
    "/admin/users/tenant",
    async (_params, _body, query, tenantId, context) => {
      logger.info("[Admin Routes] GET /admin/users/tenant");
      return await adminController.listTenantUsers(
        _params,
        _body,
        query,
        tenantId,
        context,
      );
    },
  );

  // Agency management routes (super admin only)
  router.register(
    "GET",
    "/admin/agency/users",
    async (_params, _body, query, tenantId, context) => {
      logger.info("[Admin Routes] GET /admin/agency/users");
      return await adminController.listAgencyUsers(
        _params,
        _body,
        query,
        tenantId,
        context,
      );
    },
  );

  router.register(
    "PUT",
    "/admin/agency/users/:userId",
    async (params, body, _query, tenantId, context) => {
      logger.info("[Admin Routes] PUT /admin/agency/users/:userId", {
        userId: params.userId,
      });
      return await adminController.updateUserRole(
        params,
        body,
        _query,
        tenantId,
        context,
      );
    },
  );

  router.register(
    "GET",
    "/admin/agency/customers",
    async (_params, _body, query, tenantId, context) => {
      logger.info("[Admin Routes] GET /admin/agency/customers");
      return await adminController.listAgencyCustomers(
        _params,
        _body,
        query,
        tenantId,
        context,
      );
    },
  );

  // Webhook Logs
  router.register(
    "GET",
    "/admin/webhook-logs",
    async (_params, _body, query, tenantId) => {
      return await webhookLogsController.list(tenantId!, query);
    },
  );

  router.register(
    "GET",
    "/admin/webhook-logs/:id",
    async (params, _body, _query, tenantId) => {
      return await webhookLogsController.get(tenantId!, params.id);
    },
  );

  router.register(
    "POST",
    "/admin/webhook-logs/:id/retry",
    async (params, _body, _query, tenantId) => {
      return await webhookLogsController.retry(tenantId!, params.id);
    },
  );

  // HTTP Request Tester (for workflow HTTP steps)
  router.register(
    "POST",
    "/admin/http-request/test",
    async (_params, body, _query, tenantId, context) => {
      logger.info("[Admin Routes] POST /admin/http-request/test");
      return await httpRequestTestController.test(
        _params,
        body,
        _query,
        tenantId,
        context,
      );
    },
  );

  // Client-side error reporting (React ErrorBoundary)
  router.register(
    "POST",
    "/admin/client-errors",
    async (_params, body, _query, tenantId, context) => {
      return await clientErrorsController.report(tenantId!, body, context);
    },
  );

  // Workflow sharing (internal endpoint for worker)
  router.register(
    "POST",
    "/internal/workflow-sharing/share-artifact",
    async (_params, body, _query, tenantId) => {
      return await workflowSharingController.shareArtifact(
        _params,
        body,
        _query,
        tenantId,
      );
    },
  );

  // Tracking analytics
  router.register(
    "GET",
    "/admin/tracking/jobs/:jobId/stats",
    async (params, _body, _query, tenantId) => {
      return await trackingController.getJobStats(tenantId!, params.jobId);
    },
  );

  router.register(
    "GET",
    "/admin/tracking/jobs/:jobId/events",
    async (params, _body, query, tenantId) => {
      return await trackingController.getJobEvents(
        tenantId!,
        params.jobId,
        query,
      );
    },
  );

  router.register(
    "GET",
    "/admin/tracking/jobs/:jobId/recordings",
    async (params, _body, query, tenantId) => {
      return await trackingController.getJobRecordings(
        tenantId!,
        params.jobId,
        query,
      );
    },
  );
}
