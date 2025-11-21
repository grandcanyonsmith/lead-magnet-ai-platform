"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = void 0;
const db_1 = require("../utils/db");
const rbac_1 = require("../utils/rbac");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const env_1 = require("../utils/env");
const USERS_TABLE = env_1.env.usersTable;
/**
 * Auth Controller
 * Handles authentication-related endpoints
 */
class AuthController {
    /**
     * Get current user information
     * GET /me
     */
    async getMe(_params, _body, _query, _tenantId, context) {
        const auth = (0, rbac_1.requireUser)(context);
        try {
            // Get real user
            const realUser = await db_1.db.get(USERS_TABLE, { user_id: auth.realUserId });
            if (!realUser) {
                throw new errors_1.ApiError('User not found', 404);
            }
            // Get acting user (if impersonating)
            let actingUser = realUser;
            if (auth.isImpersonating && auth.actingUserId !== auth.realUserId) {
                const actingUserRecord = await db_1.db.get(USERS_TABLE, { user_id: auth.actingUserId });
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
        }
        catch (error) {
            if (error instanceof errors_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('[Auth] Error getting user info', {
                error: error instanceof Error ? error.message : String(error),
                realUserId: auth.realUserId,
            });
            throw new errors_1.ApiError('Failed to get user information', 500);
        }
    }
}
exports.authController = new AuthController();
//# sourceMappingURL=auth.js.map