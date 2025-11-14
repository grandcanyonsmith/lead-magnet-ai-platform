import { db } from '../utils/db';
import { RouteResponse } from '../routes';
import { RequestContext } from '../routes/router';
import { requireAdmin, getRealUserId } from '../utils/rbac';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';
import { ulid } from 'ulid';
import { randomBytes } from 'crypto';

const SESSIONS_TABLE = process.env.SESSIONS_TABLE || 'leadmagnet-sessions';
const USERS_TABLE = process.env.USERS_TABLE || 'leadmagnet-users';
const IMPERSONATION_LOGS_TABLE = process.env.IMPERSONATION_LOGS_TABLE || 'leadmagnet-impersonation-logs';

/**
 * Impersonation Controller
 * Handles user impersonation for admins
 */
class ImpersonationController {
  /**
   * Start impersonation
   * POST /admin/impersonate
   */
  async start(
    _params: Record<string, string>,
    body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext
  ): Promise<RouteResponse> {
    const auth = requireAdmin(context);
    const realUserId = getRealUserId(context);

    if (!body.targetUserId || typeof body.targetUserId !== 'string') {
      throw new ApiError('targetUserId is required', 400);
    }

    const targetUserId = body.targetUserId as string;

    // Prevent impersonating yourself
    if (targetUserId === realUserId) {
      throw new ApiError('Cannot impersonate yourself', 400);
    }

    try {
      // Verify target user exists
      const targetUser = await db.get(USERS_TABLE, { user_id: targetUserId });
      if (!targetUser) {
        throw new ApiError('Target user not found', 404);
      }

      // Prevent impersonating other admins (unless SUPER_ADMIN)
      if (auth.role !== 'SUPER_ADMIN') {
        const targetRole = targetUser.role || 'USER';
        if (targetRole === 'ADMIN' || targetRole === 'SUPER_ADMIN') {
          throw new ApiError('You do not have permission to impersonate admins', 403);
        }
      }

      // Create session for impersonation
      const sessionId = `session_${ulid()}`;
      const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour

      const session = {
        session_id: sessionId,
        real_user_id: realUserId,
        acting_user_id: targetUserId,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      };

      await db.put(SESSIONS_TABLE, session);

      // Log impersonation
      const logId = `log_${ulid()}`;
      const log = {
        log_id: logId,
        admin_id: realUserId,
        target_user_id: targetUserId,
        started_at: new Date().toISOString(),
        reason: body.reason || undefined,
      };

      await db.put(IMPERSONATION_LOGS_TABLE, log);

      logger.info('[Impersonation] Started impersonation', {
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
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error('[Impersonation] Error starting impersonation', {
        error: error instanceof Error ? error.message : String(error),
        realUserId,
        targetUserId,
      });
      throw new ApiError('Failed to start impersonation', 500);
    }
  }

  /**
   * Stop impersonation
   * POST /admin/impersonate/reset
   */
  async reset(
    _params: Record<string, string>,
    body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext
  ): Promise<RouteResponse> {
    const auth = requireAdmin(context);
    const realUserId = getRealUserId(context);

    const sessionId = body.sessionId || 
                      context?.event.headers['x-session-id'] ||
                      context?.event.headers['X-Session-Id'];

    if (!sessionId) {
      throw new ApiError('sessionId is required', 400);
    }

    try {
      // Get session
      const session = await db.get(SESSIONS_TABLE, { session_id: sessionId });

      if (!session) {
        throw new ApiError('Session not found', 404);
      }

      // Verify session belongs to real user
      if (session.real_user_id !== realUserId) {
        throw new ApiError('You do not have permission to end this session', 403);
      }

      // Delete session
      await db.delete(SESSIONS_TABLE, { session_id: sessionId });

      // Update impersonation log
      const logs = await db.scan(IMPERSONATION_LOGS_TABLE);
      const activeLog = logs.find(
        (log: any) =>
          log.admin_id === realUserId &&
          log.target_user_id === session.acting_user_id &&
          !log.ended_at
      );

      if (activeLog) {
        await db.update(IMPERSONATION_LOGS_TABLE, { log_id: activeLog.log_id }, {
          ended_at: new Date().toISOString(),
        });
      }

      logger.info('[Impersonation] Stopped impersonation', {
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
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error('[Impersonation] Error stopping impersonation', {
        error: error instanceof Error ? error.message : String(error),
        realUserId,
        sessionId,
      });
      throw new ApiError('Failed to stop impersonation', 500);
    }
  }
}

export const impersonationController = new ImpersonationController();

