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

  // Update user profile
  router.register(
    "PATCH",
    "/me",
    async (params, body, query, tenantId, context) => {
      logger.info("[Auth Routes] PATCH /me");
      return await authController.updateProfile(
        params,
        body,
        query,
        tenantId,
        context,
      );
    },
    true,
  );

  // Get avatar upload URL
  router.register(
    "POST",
    "/me/avatar-upload-url",
    async (params, body, query, tenantId, context) => {
      logger.info("[Auth Routes] POST /me/avatar-upload-url");
      return await authController.getAvatarUploadUrl(
        params,
        body,
        query,
        tenantId,
        context,
      );
    },
    true,
  );

  // Upload avatar directly (base64 payload)
  router.register(
    "POST",
    "/me/avatar-upload",
    async (params, body, query, tenantId, context) => {
      logger.info("[Auth Routes] POST /me/avatar-upload");
      return await authController.uploadAvatar(
        params,
        body,
        query,
        tenantId,
        context,
      );
    },
    true,
  );
}
