import { router } from "./router";
import { healthController } from "../controllers/healthController";

/**
 * Health check routes
 */
export function registerHealthRoutes(): void {
  // Basic health check (no auth required)
  router.register("GET", "/health", async (_params, _body, _query, _tenantId, context) => {
    return await healthController.basic(_params, _body, _query, _tenantId, context);
  });

  // Detailed health check with diagnostics (auth required)
  router.register(
    "GET",
    "/admin/health",
    async (_params, _body, _query, _tenantId, context) => {
      return await healthController.detailed(_params, _body, _query, _tenantId, context);
    },
    true, // requires auth
  );
}
