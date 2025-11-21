"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAuthContext = extractAuthContext;
const db_1 = require("./db");
const logger_1 = require("./logger");
const env_1 = require("./env");
const SESSIONS_TABLE = env_1.env.sessionsTable;
const USERS_TABLE = env_1.env.usersTable;
/**
 * Super Admin email allowlist configuration.
 * Users with emails in this set are automatically elevated to SUPER_ADMIN role.
 */
const defaultSuperAdminEmails = ['canyon@coursecreator360.com'];
const superAdminEmailSet = new Set([
    ...defaultSuperAdminEmails.map((email) => email.toLowerCase()),
    ...env_1.env.superAdminEmails,
]);
/**
 * Check if an email is in the SUPER_ADMIN allowlist.
 */
function isForcedSuperAdmin(email) {
    if (!email) {
        return false;
    }
    return superAdminEmailSet.has(email.toLowerCase());
}
/**
 * Persist SUPER_ADMIN role to database for a user.
 * This ensures the role elevation persists across sessions.
 */
async function ensureUserIsPersistedAsSuperAdmin(userId) {
    try {
        const user = await db_1.db.get(USERS_TABLE, { user_id: userId });
        if (user && user.role !== 'SUPER_ADMIN') {
            await db_1.db.update(USERS_TABLE, { user_id: userId }, {
                role: 'SUPER_ADMIN',
                updated_at: new Date().toISOString(),
            });
            logger_1.logger.info('[AuthContext] Elevated user to SUPER_ADMIN based on email allowlist', {
                userId,
            });
        }
    }
    catch (error) {
        logger_1.logger.warn('[AuthContext] Failed to persist SUPER_ADMIN role for user', {
            error: error instanceof Error ? error.message : String(error),
            userId,
        });
    }
}
/**
 * Get email from JWT claims or fallback to database lookup.
 *
 * @param claims - JWT claims from API Gateway authorizer
 * @param userId - User ID to lookup if email not in claims
 * @returns Email address or undefined if not found
 */
async function getEmailFromClaimsOrDatabase(claims, userId) {
    // Try JWT claims first
    let email = claims.email ||
        claims['custom:email'];
    // Fallback to database lookup
    if (!email) {
        try {
            const user = await db_1.db.get(USERS_TABLE, { user_id: userId });
            if (user?.email) {
                email = user.email;
            }
        }
        catch (error) {
            logger_1.logger.warn('[AuthContext] Could not fetch user email from database', {
                error: error instanceof Error ? error.message : String(error),
                userId,
            });
        }
    }
    return email;
}
/**
 * Elevate role to SUPER_ADMIN if email is in allowlist.
 *
 * Role precedence: JWT claim → allowlist check → default USER
 *
 * @param role - Current role from JWT claims
 * @param email - User email address
 * @param userId - User ID for database persistence
 * @returns Effective role (SUPER_ADMIN if in allowlist, otherwise original role)
 */
async function elevateRoleIfInAllowlist(role, email, userId) {
    if (isForcedSuperAdmin(email) && role !== 'SUPER_ADMIN') {
        logger_1.logger.info('[AuthContext] Forcing SUPER_ADMIN based on email allowlist', {
            email,
            previousRole: role,
        });
        await ensureUserIsPersistedAsSuperAdmin(userId);
        return 'SUPER_ADMIN';
    }
    return role;
}
/**
 * Resolve customer ID from claims, impersonation session, or user record.
 *
 * Resolution order:
 * 1. If impersonating: acting user's customer_id
 * 2. JWT claim: custom:customer_id
 * 3. User record lookup
 *
 * @param claims - JWT claims
 * @param actingUserId - Acting user ID (may differ from real user if impersonating)
 * @returns Customer ID or undefined if not found
 */
async function resolveCustomerId(claims, actingUserId) {
    // Try JWT claim first
    let customerId = claims['custom:customer_id'];
    // If not in claims, try user record lookup
    if (!customerId) {
        try {
            const user = await db_1.db.get(USERS_TABLE, { user_id: actingUserId });
            if (user?.customer_id) {
                customerId = user.customer_id;
            }
        }
        catch (error) {
            logger_1.logger.warn('[AuthContext] Error fetching user for customerId', {
                error: error instanceof Error ? error.message : String(error),
                actingUserId,
            });
        }
    }
    return customerId;
}
/**
 * Extract agency view context from request headers.
 * Only SUPER_ADMIN users can use agency view.
 *
 * @param event - API Gateway event
 * @param role - User's role
 * @param defaultCustomerId - Default customer ID (real user's customer)
 * @returns Object with viewMode, selectedCustomerId, and effective customerId
 */
function extractAgencyViewContext(event, role, defaultCustomerId) {
    // Only SUPER_ADMIN can use agency view
    if (role !== 'SUPER_ADMIN') {
        return { effectiveCustomerId: defaultCustomerId };
    }
    const viewMode = event.headers['x-view-mode'] || event.headers['X-View-Mode'];
    const selectedCustomerId = event.headers['x-selected-customer-id'] ||
        event.headers['X-Selected-Customer-Id'];
    if (viewMode === 'agency') {
        // In agency view, use selected customer if provided, otherwise use default
        return {
            viewMode: 'agency',
            selectedCustomerId: selectedCustomerId || undefined,
            effectiveCustomerId: selectedCustomerId || defaultCustomerId,
        };
    }
    else {
        // In subaccount view, use default customer
        return {
            viewMode: 'subaccount',
            effectiveCustomerId: defaultCustomerId,
        };
    }
}
/**
 * Extract session ID from Authorization header if present.
 * Format: Bearer <token> or Session <session_id>
 */
function extractSessionIdFromAuth(authHeader) {
    if (!authHeader)
        return undefined;
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Session') {
        return parts[1];
    }
    return undefined;
}
/**
 * Resolve acting user ID from impersonation session if present.
 *
 * @param event - API Gateway event
 * @param realUserId - Real user ID from JWT claims
 * @returns Acting user ID (may differ from real user if impersonating)
 */
async function resolveActingUserId(event, realUserId) {
    const sessionId = event.headers['x-session-id'] ||
        event.headers['X-Session-Id'] ||
        extractSessionIdFromAuth(event.headers.authorization);
    if (!sessionId) {
        return realUserId;
    }
    try {
        const session = await db_1.db.get(SESSIONS_TABLE, { session_id: sessionId });
        if (session && session.real_user_id === realUserId) {
            // Verify session hasn't expired
            const expiresAt = typeof session.expires_at === 'number'
                ? session.expires_at
                : Math.floor(new Date(session.expires_at).getTime() / 1000);
            const now = Math.floor(Date.now() / 1000);
            if (expiresAt && expiresAt > now) {
                return session.acting_user_id;
            }
        }
    }
    catch (error) {
        logger_1.logger.warn('[AuthContext] Error checking session', { error, sessionId });
    }
    return realUserId;
}
/**
 * Extract authentication context from JWT claims and session.
 *
 * This is the main entry point for authentication. It:
 * 1. Extracts user identity from JWT claims
 * 2. Resolves email from claims or database
 * 3. Elevates role if email is in SUPER_ADMIN allowlist
 * 4. Handles session-based impersonation
 * 5. Resolves customer ID for multi-tenant isolation
 * 6. Extracts agency view context for SUPER_ADMIN users
 *
 * @param event - API Gateway event with JWT authorizer claims
 * @returns AuthContext if authenticated, null otherwise
 */
async function extractAuthContext(event) {
    const authorizer = event.requestContext?.authorizer;
    const claims = authorizer?.jwt?.claims || {};
    // If no claims, user is not authenticated
    if (!claims.sub) {
        return null;
    }
    const realUserId = claims.sub;
    const baseRole = claims['custom:role'] || 'USER';
    // Get email and elevate role if needed
    const email = await getEmailFromClaimsOrDatabase(claims, realUserId);
    const role = await elevateRoleIfInAllowlist(baseRole, email, realUserId);
    // Resolve acting user (may differ if impersonating)
    const actingUserId = await resolveActingUserId(event, realUserId);
    // Resolve customer ID
    let customerId;
    // If impersonating, get customerId from acting user first
    if (actingUserId !== realUserId) {
        try {
            const actingUser = await db_1.db.get(USERS_TABLE, { user_id: actingUserId });
            if (actingUser?.customer_id) {
                customerId = actingUser.customer_id;
            }
        }
        catch (error) {
            logger_1.logger.warn('[AuthContext] Error fetching acting user', { error, actingUserId });
        }
    }
    // If not impersonating or acting user lookup failed, resolve normally
    if (!customerId) {
        customerId = await resolveCustomerId(claims, actingUserId);
    }
    // Customer ID is required - fail if not found
    if (!customerId) {
        logger_1.logger.error('[AuthContext] No customerId found', {
            realUserId,
            actingUserId,
            role
        });
        return null;
    }
    // Extract agency view context (only for SUPER_ADMIN)
    const agencyContext = extractAgencyViewContext(event, role, customerId);
    return {
        realUserId,
        actingUserId,
        role,
        customerId: agencyContext.effectiveCustomerId,
        isImpersonating: actingUserId !== realUserId,
        viewMode: agencyContext.viewMode,
        selectedCustomerId: agencyContext.selectedCustomerId,
    };
}
//# sourceMappingURL=authContext.js.map