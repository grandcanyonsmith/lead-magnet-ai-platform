import { db } from '../utils/db';
import { RouteResponse } from '../routes';
import { RequestContext } from '../routes/router';
import { requireSuperAdmin, requireAdmin } from '../utils/rbac';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';
import { env } from '../utils/env';

const USERS_TABLE = env.usersTable;
const CUSTOMERS_TABLE = env.customersTable;

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

  /**
   * List all users for agency view (super admin only)
   * GET /admin/agency/users
   */
  async listAgencyUsers(
    _params: Record<string, string>,
    _body: any,
    query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext
  ): Promise<RouteResponse> {
    requireSuperAdmin(context);

    const searchTerm = query.q;
    const limit = parseInt(query.limit || '100', 10);
    const customerId = query.customer_id; // Optional filter by customer

    try {
      let users: any[];

      // Scan all users
      const allUsers = await db.scan(USERS_TABLE, 1000);

      // Apply filters
      if (customerId) {
        users = allUsers.filter((user: any) => user.customer_id === customerId);
      } else {
        users = allUsers;
      }

      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        users = users.filter((user: any) => {
          const email = (user.email || '').toLowerCase();
          const name = (user.name || '').toLowerCase();
          return email.includes(searchLower) || name.includes(searchLower);
        });
      }

      // Limit results
      users = users.slice(0, limit);

      // Sanitize and include customer info
      const sanitizedUsers = users.map((user: any) => ({
        user_id: user.user_id,
        email: user.email,
        name: user.name,
        customer_id: user.customer_id,
        role: user.role || 'USER',
        created_at: user.created_at,
        updated_at: user.updated_at,
      }));

      logger.debug('[Admin] Listed agency users', {
        count: sanitizedUsers.length,
        searchTerm,
        customerId,
      });

      return {
        statusCode: 200,
        body: {
          users: sanitizedUsers,
          count: sanitizedUsers.length,
        },
      };
    } catch (error) {
      logger.error('[Admin] Error listing agency users', {
        error: error instanceof Error ? error.message : String(error),
        searchTerm,
      });
      throw new ApiError('Failed to list agency users', 500);
    }
  }

  /**
   * Update user role (super admin only)
   * PUT /admin/agency/users/:userId
   */
  async updateUserRole(
    params: Record<string, string>,
    body: any,
    _query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext
  ): Promise<RouteResponse> {
    // Validate context before RBAC check
    if (!context) {
      logger.error('[Admin] Missing request context in updateUserRole');
      throw new ApiError('Request context is missing', 500);
    }

    if (!context.auth) {
      logger.error('[Admin] Missing auth context in updateUserRole', {
        hasContext: !!context,
        hasEvent: !!context.event,
      });
      throw new ApiError('Authentication required', 401);
    }

    logger.info('[Admin] Starting user role update', {
      userId: params.userId,
      requestingUserId: context.auth.actingUserId,
      requestingRole: context.auth.role,
    });

    try {
      requireSuperAdmin(context);
    } catch (error) {
      logger.error('[Admin] Authorization failed in updateUserRole', {
        error: error instanceof Error ? error.message : String(error),
        userId: params.userId,
        requestingUserId: context.auth.actingUserId,
        requestingRole: context.auth.role,
      });
      throw error;
    }

    const userId = params.userId;
    if (!userId) {
      logger.warn('[Admin] Missing userId parameter in updateUserRole');
      throw new ApiError('User ID is required', 400);
    }

    const { role, customer_id } = body || {};
    if (!role || !['USER', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      logger.warn('[Admin] Invalid role provided in updateUserRole', {
        userId,
        providedRole: role,
      });
      throw new ApiError('Valid role is required (USER, ADMIN, SUPER_ADMIN)', 400);
    }

    try {
      logger.debug('[Admin] Fetching user for role update', { userId });
      
      // Get existing user
      const user = await db.get(USERS_TABLE, { user_id: userId });
      if (!user) {
        logger.warn('[Admin] User not found for role update', { userId });
        throw new ApiError('User not found', 404);
      }

      logger.debug('[Admin] User found, checking for last SUPER_ADMIN', {
        userId,
        currentRole: user.role,
        newRole: role,
      });

      // Prevent demoting the last SUPER_ADMIN
      if (user.role === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') {
        // Check if there are other SUPER_ADMINs
        const allUsers = await db.scan(USERS_TABLE, 1000);
        const superAdmins = allUsers.filter((u: any) => u.role === 'SUPER_ADMIN' && u.user_id !== userId);
        if (superAdmins.length === 0) {
          logger.warn('[Admin] Attempted to demote last SUPER_ADMIN', { userId });
          throw new ApiError('Cannot demote the last SUPER_ADMIN', 400);
        }
      }

      // Build update data
      const updateData: any = {
        role,
        updated_at: new Date().toISOString(),
      };

      if (customer_id) {
        updateData.customer_id = customer_id;
      }

      logger.debug('[Admin] Updating user in database', {
        userId,
        updateData,
      });

      // Update user
      const updated = await db.update(USERS_TABLE, { user_id: userId }, updateData);

      if (!updated) {
        logger.error('[Admin] Database update returned null/undefined', {
          userId,
          updateData,
        });
        throw new ApiError('Failed to update user - database update returned no result', 500);
      }

      logger.info('[Admin] Successfully updated user role', {
        userId,
        oldRole: user.role,
        newRole: role,
        updatedUserId: updated.user_id,
      });

      return {
        statusCode: 200,
        body: {
          user: {
            user_id: updated.user_id,
            email: updated.email,
            name: updated.name,
            customer_id: updated.customer_id,
            role: updated.role,
          },
          message: 'User role updated successfully',
        },
      };
    } catch (error) {
      // Re-throw ApiError as-is
      if (error instanceof ApiError) {
        logger.error('[Admin] ApiError in updateUserRole', {
          error: error.message,
          statusCode: error.statusCode,
          userId,
        });
        throw error;
      }

      // Log detailed error information
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('[Admin] Unexpected error updating user role', {
        error: errorMessage,
        stack: errorStack,
        userId,
        role,
        customer_id,
      });

      throw new ApiError(
        `Failed to update user role: ${errorMessage}`,
        500
      );
    }
  }

  /**
   * List all customers/subaccounts (super admin only)
   * GET /admin/agency/customers
   */
  async listAgencyCustomers(
    _params: Record<string, string>,
    _body: any,
    query: Record<string, string | undefined>,
    _tenantId: string | undefined,
    context?: RequestContext
  ): Promise<RouteResponse> {
    requireSuperAdmin(context);

    const searchTerm = query.q;
    const limit = parseInt(query.limit || '100', 10);

    try {
      let customers: any[];

      // Scan all customers
      const allCustomers = await db.scan(CUSTOMERS_TABLE, 1000);

      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        customers = allCustomers.filter((customer: any) => {
          const name = (customer.name || '').toLowerCase();
          const email = (customer.email || '').toLowerCase();
          const customerId = (customer.customer_id || '').toLowerCase();
          return name.includes(searchLower) || 
                 email.includes(searchLower) || 
                 customerId.includes(searchLower);
        });
      } else {
        customers = allCustomers;
      }

      // Limit results
      customers = customers.slice(0, limit);

      // Get user counts for each customer
      const allUsers = await db.scan(USERS_TABLE, 1000);
      const customersWithStats = customers.map((customer: any) => {
        const customerUsers = allUsers.filter((u: any) => u.customer_id === customer.customer_id);
        return {
          customer_id: customer.customer_id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          timezone: customer.timezone,
          user_count: customerUsers.length,
          created_at: customer.created_at,
          updated_at: customer.updated_at,
        };
      });

      logger.debug('[Admin] Listed agency customers', {
        count: customersWithStats.length,
        searchTerm,
      });

      return {
        statusCode: 200,
        body: {
          customers: customersWithStats,
          count: customersWithStats.length,
        },
      };
    } catch (error) {
      logger.error('[Admin] Error listing agency customers', {
        error: error instanceof Error ? error.message : String(error),
        searchTerm,
      });
      throw new ApiError('Failed to list agency customers', 500);
    }
  }
}

export const adminController = new AdminController();

