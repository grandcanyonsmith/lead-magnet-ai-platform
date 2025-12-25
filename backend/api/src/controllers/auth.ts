import { db } from "../utils/db";
import { RouteResponse } from "../routes";
import { RequestContext } from "../routes/router";
import { requireUser } from "../utils/rbac";
import { ApiError } from "../utils/errors";
import { logger } from "../utils/logger";
import { env } from "../utils/env";

const USERS_TABLE = env.usersTable;

/**
 * Auth Controller
 * Handles authentication-related endpoints
 */
class AuthController {
  /**
   * Get current user information
   * GET /me
   */
  async getMe(
    _params: Record<string, string>,
    _body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    const auth = requireUser(context);

    try {
      // Get real user
      const realUser = await db.get(USERS_TABLE, { user_id: auth.realUserId });
      if (!realUser) {
        throw new ApiError("User not found", 404);
      }

      // Get acting user (if impersonating)
      let actingUser = realUser;
      if (auth.isImpersonating && auth.actingUserId !== auth.realUserId) {
        const actingUserRecord = await db.get(USERS_TABLE, {
          user_id: auth.actingUserId,
        });
        if (actingUserRecord) {
          actingUser = actingUserRecord;
        }
      }

      return {
        statusCode: 200,
        body: {
          realUser: {
            user_id: realUser.user_id,
            email: realUser.email,
            name: realUser.name,
            customer_id: realUser.customer_id,
          },
          actingUser: {
            user_id: actingUser.user_id,
            email: actingUser.email,
            name: actingUser.name,
            customer_id: actingUser.customer_id,
          },
          /**
           * Effective role for the current request.
           * This is the computed role that includes allowlist elevation.
           * Use this field as the single source of truth for authorization.
           */
          role: auth.role,
          customerId: auth.customerId,
          isImpersonating: auth.isImpersonating,
          viewMode: auth.viewMode,
          selectedCustomerId: auth.selectedCustomerId,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error("[Auth] Error getting user info", {
        error: error instanceof Error ? error.message : String(error),
        realUserId: auth.realUserId,
      });
      throw new ApiError("Failed to get user information", 500);
    }
  }
}

export const authController = new AuthController();
