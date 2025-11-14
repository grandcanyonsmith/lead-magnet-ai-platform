import { db } from '../utils/db';
import { RouteResponse } from '../routes';
import { RequestContext } from '../routes/router';
import { requireAdmin } from '../utils/rbac';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';

const USERS_TABLE = process.env.USERS_TABLE || 'leadmagnet-users';

/**
 * Admin Controller
 * Handles admin-only operations
 */
class AdminController {
  /**
   * List/search users (admin only)
   * GET /admin/users
   */
  async listUsers(
    _params: Record<string, string>,
    _body: any,
    query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext
  ): Promise<RouteResponse> {
    requireAdmin(context);

    const searchTerm = query.q;
    const limit = parseInt(query.limit || '50', 10);

    try {
      let users: any[];

      if (searchTerm) {
        // Search by email or name
        // Note: DynamoDB doesn't support full-text search, so we'll scan and filter
        // In production, consider using Elasticsearch or similar
        const allUsers = await db.scan(USERS_TABLE, 1000); // Scan up to 1000 users
        
        const searchLower = searchTerm.toLowerCase();
        users = allUsers
          .filter((user: any) => {
            const email = (user.email || '').toLowerCase();
            const name = (user.name || '').toLowerCase();
            return email.includes(searchLower) || name.includes(searchLower);
          })
          .slice(0, limit);
      } else {
        // Get all users (limited)
        users = await db.scan(USERS_TABLE, limit);
      }

      // Remove sensitive information
      const sanitizedUsers = users.map((user: any) => ({
        user_id: user.user_id,
        email: user.email,
        name: user.name,
        customer_id: user.customer_id,
        role: user.role || 'USER',
        created_at: user.created_at,
      }));

      logger.debug('[Admin] Listed users', {
        count: sanitizedUsers.length,
        searchTerm,
      });

      return {
        statusCode: 200,
        body: {
          users: sanitizedUsers,
          count: sanitizedUsers.length,
        },
      };
    } catch (error) {
      logger.error('[Admin] Error listing users', {
        error: error instanceof Error ? error.message : String(error),
        searchTerm,
      });
      throw new ApiError('Failed to list users', 500);
    }
  }
}

export const adminController = new AdminController();

