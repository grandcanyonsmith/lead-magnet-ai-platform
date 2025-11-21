/**
 * RBAC (Role-Based Access Control) helpers.
 *
 * Provides utilities for enforcing role-based access control in route handlers.
 * Functions throw appropriate errors (AuthenticationError, AuthorizationError) when
 * access is denied, providing clear error messages for debugging.
 *
 * @module rbac
 */
import { RequestContext } from '../routes/router';
import { AuthContext } from './authContext';
/**
 * Ensure user is authenticated
 */
export declare function requireUser(context?: RequestContext): AuthContext;
/**
 * Ensure user has ADMIN or SUPER_ADMIN role
 */
export declare function requireAdmin(context?: RequestContext): AuthContext;
/**
 * Ensure user has SUPER_ADMIN role
 */
export declare function requireSuperAdmin(context?: RequestContext): AuthContext;
/**
 * Get customerId from auth context
 */
export declare function getCustomerId(context?: RequestContext): string;
/**
 * Get acting user ID (for impersonation)
 */
export declare function getActingUserId(context?: RequestContext): string;
/**
 * Get real user ID (actual logged-in user)
 */
export declare function getRealUserId(context?: RequestContext): string;
/**
 * Check if user is currently impersonating
 */
export declare function isImpersonating(context?: RequestContext): boolean;
//# sourceMappingURL=rbac.d.ts.map