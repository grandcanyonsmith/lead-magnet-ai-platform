import { db } from '../utils/db';
import { RouteResponse } from '../routes';
import { RequestContext } from '../routes/router';
import { requireUser } from '../utils/rbac';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';

const USERS_TABLE = process.env.USERS_TABLE || 'leadmagnet-users';

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
    context?: RequestContext
  ): Promise<RouteResponse> {
    const auth = requireUser(context);

    try {
      // Get real user
      const realUser = await db.get(USERS_TABLE, { user_id: auth.realUserId });
      if (!realUser) {
        throw new ApiError('User not found', 404);
      }

      // Get acting user (if impersonating)
      let actingUser = realUser;
      if (auth.isImpersonating && auth.actingUserId !== auth.realUserId) {
        const actingUserRecord = await db.get(USERS_TABLE, { user_id: auth.actingUserId });
        if (actingUserRecord) {
          actingUser = actingUserRecord;
        }
      }

      logger.debug('[Auth] Retrieved user info', {
        realUserId: auth.realUserId,
        actingUserId: auth.actingUserId,
        isImpersonating: auth.isImpersonating,
      });

      return {
        statusCode: 200,
        body: {
          realUser: {
            user_id: realUser.user_id,
            email: realUser.email,
            name: realUser.name,
            role: realUser.role || 'USER',
            customer_id: realUser.customer_id,
          },
          actingUser: {
            user_id: actingUser.user_id,
            email: actingUser.email,
            name: actingUser.name,
            role: actingUser.role || 'USER',
            customer_id: actingUser.customer_id,
          },
          role: auth.role,
          customerId: auth.customerId,
          isImpersonating: auth.isImpersonating,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error('[Auth] Error getting user info', {
        error: error instanceof Error ? error.message : String(error),
        realUserId: auth.realUserId,
      });
      throw new ApiError('Failed to get user information', 500);
    }
  }
}

export const authController = new AuthController();

