"use strict";
/**
 * RBAC (Role-Based Access Control) helpers.
 *
 * Provides utilities for enforcing role-based access control in route handlers.
 * Functions throw appropriate errors (AuthenticationError, AuthorizationError) when
 * access is denied, providing clear error messages for debugging.
 *
 * @module rbac
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireUser = requireUser;
exports.requireAdmin = requireAdmin;
exports.requireSuperAdmin = requireSuperAdmin;
exports.getCustomerId = getCustomerId;
exports.getActingUserId = getActingUserId;
exports.getRealUserId = getRealUserId;
exports.isImpersonating = isImpersonating;
const errors_1 = require("./errors");
const logger_1 = require("./logger");
/**
 * Ensure user is authenticated
 */
function requireUser(context) {
    if (!context) {
        logger_1.logger.error('[RBAC.requireUser] Request context is missing');
        throw new errors_1.AuthenticationError('Request context is missing. This may indicate a configuration issue.', {
            message: 'The request context was not provided. This could indicate a problem with the API gateway or middleware configuration.',
        });
    }
    if (!context.auth) {
        logger_1.logger.warn('[RBAC.requireUser] Authentication context is missing', {
            hasContext: !!context,
            hasEvent: !!context.event,
            sourceIp: context.sourceIp,
        });
        throw new errors_1.AuthenticationError('Please sign in to access this resource. If you are already signed in, your session may have expired or there may be an issue with your account configuration.', {
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
function requireAdmin(context) {
    const auth = requireUser(context);
    if (auth.role !== 'ADMIN' && auth.role !== 'SUPER_ADMIN') {
        logger_1.logger.warn('[RBAC.requireAdmin] Insufficient permissions', {
            userId: auth.actingUserId,
            customerId: auth.customerId,
            role: auth.role,
            requiredRole: 'ADMIN or SUPER_ADMIN',
        });
        throw new errors_1.AuthorizationError(`You do not have permission to access this resource. Required role: ADMIN or SUPER_ADMIN, but your role is: ${auth.role || 'not set'}`, {
            message: 'Insufficient permissions for this operation',
            currentRole: auth.role || 'not set',
            requiredRoles: ['ADMIN', 'SUPER_ADMIN'],
            userId: auth.actingUserId,
            customerId: auth.customerId,
        });
    }
    return auth;
}
/**
 * Ensure user has SUPER_ADMIN role
 */
function requireSuperAdmin(context) {
    const auth = requireUser(context);
    if (auth.role !== 'SUPER_ADMIN') {
        logger_1.logger.warn('[RBAC.requireSuperAdmin] Insufficient permissions', {
            userId: auth.actingUserId,
            customerId: auth.customerId,
            role: auth.role,
            requiredRole: 'SUPER_ADMIN',
        });
        throw new errors_1.AuthorizationError(`You do not have permission to access this resource. Required role: SUPER_ADMIN, but your role is: ${auth.role || 'not set'}`, {
            message: 'Superadmin access required for this operation',
            currentRole: auth.role || 'not set',
            requiredRole: 'SUPER_ADMIN',
            userId: auth.actingUserId,
            customerId: auth.customerId,
            troubleshooting: 'If you believe you should have superadmin access, verify that your user record in the database has role="SUPER_ADMIN"',
        });
    }
    return auth;
}
/**
 * Get customerId from auth context
 */
function getCustomerId(context) {
    const auth = requireUser(context);
    if (!auth.customerId) {
        logger_1.logger.error('[RBAC.getCustomerId] Customer ID is missing from auth context', {
            userId: auth.actingUserId,
            role: auth.role,
            hasCustomerId: !!auth.customerId,
        });
        throw new errors_1.ApiError('Unable to determine customer ID. This may indicate a problem with your account configuration. Please contact support if this issue persists.', 500, 'MISSING_CUSTOMER_ID', {
            message: 'Customer ID is missing from authentication context',
            userId: auth.actingUserId,
            role: auth.role,
            troubleshooting: 'For superadmin accounts, verify that the customer_id field is properly set in the user database record',
        });
    }
    return auth.customerId;
}
/**
 * Get acting user ID (for impersonation)
 */
function getActingUserId(context) {
    const auth = requireUser(context);
    return auth.actingUserId;
}
/**
 * Get real user ID (actual logged-in user)
 */
function getRealUserId(context) {
    const auth = requireUser(context);
    return auth.realUserId;
}
/**
 * Check if user is currently impersonating
 */
function isImpersonating(context) {
    if (!context?.auth) {
        return false;
    }
    return context.auth.isImpersonating;
}
//# sourceMappingURL=rbac.js.map