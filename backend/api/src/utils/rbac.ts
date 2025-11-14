import { RequestContext } from '../routes/router';
import { ApiError, AuthenticationError, AuthorizationError } from './errors';
import { AuthContext } from './authContext';
import { logger } from './logger';

/**
 * RBAC (Role-Based Access Control) helpers
 */

/**
 * Ensure user is authenticated
 */
export function requireUser(context?: RequestContext): AuthContext {
  if (!context) {
    logger.error('[RBAC.requireUser] Request context is missing');
    throw new AuthenticationError('Request context is missing. This may indicate a configuration issue.', {
      message: 'The request context was not provided. This could indicate a problem with the API gateway or middleware configuration.',
    });
  }

  if (!context.auth) {
    logger.warn('[RBAC.requireUser] Authentication context is missing', {
      hasContext: !!context,
      hasEvent: !!context.event,
      sourceIp: context.sourceIp,
    });
    throw new AuthenticationError('Please sign in to access this resource. If you are already signed in, your session may have expired or there may be an issue with your account configuration.', {
      message: 'User authentication context is missing. This may indicate:',
      possibleCauses: [
        'Your session has expired - please sign in again',
        'There is an issue with your account configuration',
        'For superadmin accounts, verify that your role is properly set in the user database',
        'Check that your JWT token is valid and includes the required claims',
      ],
    });
  }

  return context.auth;
}

/**
 * Ensure user has ADMIN or SUPER_ADMIN role
 */
export function requireAdmin(context?: RequestContext): AuthContext {
  const auth = requireUser(context);
  
  if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') {
    logger.warn('[RBAC.requireAdmin] Insufficient permissions', {
      userId: auth.actingUserId,
      customerId: auth.customerId,
      role: auth.role,
      requiredRole: 'ADMIN or SUPER_ADMIN',
    });
    throw new AuthorizationError(
      `You do not have permission to access this resource. Required role: ADMIN or SUPER_ADMIN, but your role is: ${auth.role || 'not set'}`,
      {
        message: 'Insufficient permissions for this operation',
        currentRole: auth.role || 'not set',
        requiredRoles: ['ADMIN', 'SUPER_ADMIN'],
        userId: auth.actingUserId,
        customerId: auth.customerId,
      }
    );
  }
  
  return auth;
}

/**
 * Ensure user has SUPER_ADMIN role
 */
export function requireSuperAdmin(context?: RequestContext): AuthContext {
  const auth = requireUser(context);
  
  if (auth.role !== 'SUPER_ADMIN') {
    logger.warn('[RBAC.requireSuperAdmin] Insufficient permissions', {
      userId: auth.actingUserId,
      customerId: auth.customerId,
      role: auth.role,
      requiredRole: 'SUPER_ADMIN',
    });
    throw new AuthorizationError(
      `You do not have permission to access this resource. Required role: SUPER_ADMIN, but your role is: ${auth.role || 'not set'}`,
      {
        message: 'Superadmin access required for this operation',
        currentRole: auth.role || 'not set',
        requiredRole: 'SUPER_ADMIN',
        userId: auth.actingUserId,
        customerId: auth.customerId,
        troubleshooting: 'If you believe you should have superadmin access, verify that your user record in the database has role="SUPER_ADMIN"',
      }
    );
  }
  
  return auth;
}

/**
 * Get customerId from auth context
 */
export function getCustomerId(context?: RequestContext): string {
  const auth = requireUser(context);
  
  if (!auth.customerId) {
    logger.error('[RBAC.getCustomerId] Customer ID is missing from auth context', {
      userId: auth.actingUserId,
      role: auth.role,
      hasCustomerId: !!auth.customerId,
    });
    throw new ApiError(
      'Unable to determine customer ID. This may indicate a problem with your account configuration. Please contact support if this issue persists.',
      500,
      'MISSING_CUSTOMER_ID',
      {
        message: 'Customer ID is missing from authentication context',
        userId: auth.actingUserId,
        role: auth.role,
        troubleshooting: 'For superadmin accounts, verify that the customer_id field is properly set in the user database record',
      }
    );
  }
  
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

