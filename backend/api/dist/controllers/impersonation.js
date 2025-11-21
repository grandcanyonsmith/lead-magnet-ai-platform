"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.impersonationController = void 0;
const db_1 = require("../utils/db");
const rbac_1 = require("../utils/rbac");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const ulid_1 = require("ulid");
const env_1 = require("../utils/env");
const SESSIONS_TABLE = env_1.env.sessionsTable;
const USERS_TABLE = env_1.env.usersTable;
const IMPERSONATION_LOGS_TABLE = env_1.env.impersonationLogsTable;
/**
 * Impersonation Controller
 * Handles user impersonation for admins
 */
class ImpersonationController {
    /**
     * Start impersonation
     * POST /admin/impersonate
     */
    async start(_params, body, _query, _tenantId, context) {
        (0, rbac_1.requireAdmin)(context);
        const realUserId = (0, rbac_1.getRealUserId)(context);
        if (!body.targetUserId || typeof body.targetUserId !== 'string') {
            throw new errors_1.ApiError('targetUserId is required', 400);
        }
        const targetUserId = body.targetUserId;
        // Prevent impersonating yourself
        if (targetUserId === realUserId) {
            throw new errors_1.ApiError('Cannot impersonate yourself', 400);
        }
        try {
            // Verify target user exists
            const targetUser = await db_1.db.get(USERS_TABLE, { user_id: targetUserId });
            if (!targetUser) {
                throw new errors_1.ApiError('Target user not found', 404);
            }
            // Prevent impersonating other admins (unless SUPER_ADMIN)
            // Check if real user is SUPER_ADMIN by trying to require it (will throw if not)
            try {
                (0, rbac_1.requireSuperAdmin)(context);
                // If we get here, user is SUPER_ADMIN, so they can impersonate anyone
            }
            catch {
                // Not SUPER_ADMIN, so check if target is admin
                const targetRole = targetUser.role || 'USER';
                if (targetRole === 'ADMIN' || targetRole === 'SUPER_ADMIN') {
                    throw new errors_1.ApiError('You do not have permission to impersonate admins', 403);
                }
            }
            // Create session for impersonation
            const sessionId = `session_${(0, ulid_1.ulid)()}`;
            const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour
            const session = {
                session_id: sessionId,
                real_user_id: realUserId,
                acting_user_id: targetUserId,
                expires_at: expiresAt,
                created_at: new Date().toISOString(),
            };
            await db_1.db.put(SESSIONS_TABLE, session);
            // Log impersonation
            const logId = `log_${(0, ulid_1.ulid)()}`;
            const log = {
                log_id: logId,
                admin_id: realUserId,
                target_user_id: targetUserId,
                started_at: new Date().toISOString(),
                reason: body.reason || undefined,
            };
            await db_1.db.put(IMPERSONATION_LOGS_TABLE, log);
            logger_1.logger.info('[Impersonation] Started impersonation', {
                sessionId,
                realUserId,
                targetUserId,
                logId,
            });
            return {
                statusCode: 200,
                body: {
                    session_id: sessionId,
                    acting_user_id: targetUserId,
                    expires_at: expiresAt,
                    message: 'Impersonation started successfully',
                },
            };
        }
        catch (error) {
            if (error instanceof errors_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('[Impersonation] Error starting impersonation', {
                error: error instanceof Error ? error.message : String(error),
                realUserId,
                targetUserId,
            });
            throw new errors_1.ApiError('Failed to start impersonation', 500);
        }
    }
    /**
     * Stop impersonation
     * POST /admin/impersonate/reset
     */
    async reset(_params, body, _query, _tenantId, context) {
        (0, rbac_1.requireAdmin)(context);
        const realUserId = (0, rbac_1.getRealUserId)(context);
        const sessionId = body.sessionId ||
            context?.event.headers['x-session-id'] ||
            context?.event.headers['X-Session-Id'];
        if (!sessionId) {
            throw new errors_1.ApiError('sessionId is required', 400);
        }
        try {
            // Get session
            const session = await db_1.db.get(SESSIONS_TABLE, { session_id: sessionId });
            if (!session) {
                throw new errors_1.ApiError('Session not found', 404);
            }
            // Verify session belongs to real user
            if (session.real_user_id !== realUserId) {
                throw new errors_1.ApiError('You do not have permission to end this session', 403);
            }
            // Delete session
            await db_1.db.delete(SESSIONS_TABLE, { session_id: sessionId });
            // Update impersonation log
            const logs = await db_1.db.scan(IMPERSONATION_LOGS_TABLE);
            const activeLog = logs.find((log) => log.admin_id === realUserId &&
                log.target_user_id === session.acting_user_id &&
                !log.ended_at);
            if (activeLog) {
                await db_1.db.update(IMPERSONATION_LOGS_TABLE, { log_id: activeLog.log_id }, {
                    ended_at: new Date().toISOString(),
                });
            }
            logger_1.logger.info('[Impersonation] Stopped impersonation', {
                sessionId,
                realUserId,
                actingUserId: session.acting_user_id,
            });
            return {
                statusCode: 200,
                body: {
                    message: 'Impersonation stopped successfully',
                },
            };
        }
        catch (error) {
            if (error instanceof errors_1.ApiError) {
                throw error;
            }
            logger_1.logger.error('[Impersonation] Error stopping impersonation', {
                error: error instanceof Error ? error.message : String(error),
                realUserId,
                sessionId,
            });
            throw new errors_1.ApiError('Failed to stop impersonation', 500);
        }
    }
}
exports.impersonationController = new ImpersonationController();
//# sourceMappingURL=impersonation.js.map