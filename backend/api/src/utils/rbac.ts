import { RequestContext } from '../routes/router';
import { ApiError } from './errors';
import { AuthContext } from './authContext';

/**
 * RBAC (Role-Based Access Control) helpers
 */

/**
 * Ensure user is authenticated
 */
export function requireUser(context?: RequestContext): AuthContext {
  if (!context?.auth) {
    throw new ApiError('Please sign in to access this page', 401);
  }
  return context.auth;
}

/**
 * Ensure user has ADMIN or SUPER_ADMIN role
 */
export function requireAdmin(context?: RequestContext): AuthContext {
  const auth = requireUser(context);
  
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') {
    throw new ApiError('You do not have permission to access this resource', 403);
  }
  
  return auth;
}

/**
 * Ensure user has SUPER_ADMIN role
 */
export function requireSuperAdmin(context?: RequestContext): AuthContext {
  const auth = requireUser(context);
  
  if (auth.role !== 'SUPER_ADMIN') {
    throw new ApiError('You do not have permission to access this resource', 403);
  }
  
  return auth;
}

/**
 * Get customerId from auth context
 */
export function getCustomerId(context?: RequestContext): string {
  const auth = requireUser(context);
  return auth.customerId;
}

/**
 * Get acting user ID (for impersonation)
 */
export function getActingUserId(context?: RequestContext): string {
  const auth = requireUser(context);
  return auth.actingUserId;
}

/**
 * Get real user ID (actual logged-in user)
 */
export function getRealUserId(context?: RequestContext): string {
  const auth = requireUser(context);
  return auth.realUserId;
}

/**
 * Check if user is currently impersonating
 */
export function isImpersonating(context?: RequestContext): boolean {
  if (!context?.auth) {
    return false;
  }
  return context.auth.isImpersonating;
}

