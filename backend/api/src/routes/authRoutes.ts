import { authController } from "../controllers/auth";
import { router } from "./router";
import { logger } from "../utils/logger";

/**
 * Auth routes
 */
export function registerAuthRoutes(): void {
  // Get current user info
  router.register(
    "GET",
    "/me",
    async (params, body, query, tenantId, context) => {
      logger.info("[Auth Routes] GET /me");
      return await authController.getMe(params, body, query, tenantId, context);
    },
    true,
  );
}
