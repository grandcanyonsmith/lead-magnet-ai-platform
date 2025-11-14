import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { db } from './db';
import { logger } from './logger';

/**
 * Auth context extracted from JWT claims and session
 */
export interface AuthContext {
  realUserId: string;
  actingUserId: string;
  role: string;
  customerId: string;
  isImpersonating: boolean;
  viewMode?: 'agency' | 'subaccount'; // Agency view for super admin
  selectedCustomerId?: string; // Selected customer when in agency view
}

/**
 * Extended request context with auth information
 */
export interface ExtendedRequestContext {
  sourceIp: string;
  event: APIGatewayProxyEventV2;
  auth: AuthContext;
}

const SESSIONS_TABLE = process.env.SESSIONS_TABLE || 'leadmagnet-sessions';
const USERS_TABLE = process.env.USERS_TABLE || 'leadmagnet-users';
const isForcedSuperAdmin = (email?: string): boolean => {
  if (!email) {
    return false;
  }
  return superAdminEmailSet.has(email.toLowerCase());
};

async function ensureUserIsPersistedAsSuperAdmin(userId: string) {
  try {
    const user = await db.get(USERS_TABLE, { user_id: userId });
    if (user && user.role !== 'SUPER_ADMIN') {
      await db.update(USERS_TABLE, { user_id: userId }, {
        role: 'SUPER_ADMIN',
        updated_at: new Date().toISOString(),
      });
      logger.info('[AuthContext] Elevated user to SUPER_ADMIN based on email allowlist', {
        userId,
      });
    }
  } catch (error) {
    logger.warn('[AuthContext] Failed to persist SUPER_ADMIN role for user', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
  }
}
const defaultSuperAdminEmails = ['canyon@coursecreator360.com'];
const configuredSuperAdminEmails = (process.env.SUPER_ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const superAdminEmailSet = new Set([
  ...defaultSuperAdminEmails.map((email) => email.toLowerCase()),
  ...configuredSuperAdminEmails,
]);

/**
 * Extract auth context from JWT claims and session
 */
export async function extractAuthContext(event: APIGatewayProxyEventV2): Promise<AuthContext | null> {
  const authorizer = (event.requestContext as any)?.authorizer;
  const claims = authorizer?.jwt?.claims || {};

  // If no claims, user is not authenticated
  if (!claims.sub) {
    return null;
  }

  const realUserId = claims.sub as string;
  let role = (claims['custom:role'] as string) || 'USER';
  let emailClaim =
    (claims.email as string | undefined) ||
    (claims['custom:email'] as string | undefined);

  // If email not in JWT claims, try to get from user record
  if (!emailClaim) {
    try {
      const user = await db.get(USERS_TABLE, { user_id: realUserId });
      if (user && user.email) {
        emailClaim = user.email;
        logger.info('[AuthContext] Retrieved email from user record', {
          realUserId,
          email: emailClaim,
        });
      }
    } catch (error) {
      logger.warn('[AuthContext] Could not fetch user email from database', {
        error: error instanceof Error ? error.message : String(error),
        realUserId,
      });
    }
  }

  logger.info('[AuthContext] Extracting auth context', {
    realUserId,
    roleFromJWT: role,
    emailClaim,
    emailFromClaims: claims.email,
    customEmailFromClaims: claims['custom:email'],
    isInAllowlist: emailClaim ? isForcedSuperAdmin(emailClaim) : false,
    allowlistEmails: Array.from(superAdminEmailSet),
  });

  if (isForcedSuperAdmin(emailClaim) && role !== 'SUPER_ADMIN') {
    logger.info('[AuthContext] Forcing SUPER_ADMIN based on email allowlist', {
      emailClaim,
      previousRole: role,
    });
    role = 'SUPER_ADMIN';
    await ensureUserIsPersistedAsSuperAdmin(realUserId);
  }
  
  // Check for session-based impersonation
  // Frontend should send session_id in Authorization header or custom header
  const sessionId = event.headers['x-session-id'] || 
                    event.headers['X-Session-Id'] ||
                    extractSessionIdFromAuth(event.headers.authorization);

  let actingUserId = realUserId;
  let customerId = claims['custom:customer_id'] as string | undefined;

  if (sessionId) {
    try {
      const session = await db.get(SESSIONS_TABLE, { session_id: sessionId });
      if (session && session.real_user_id === realUserId) {
        // Verify session hasn't expired
        // expires_at is stored as Unix timestamp (number)
        const expiresAt = typeof session.expires_at === 'number' 
          ? session.expires_at 
          : Math.floor(new Date(session.expires_at).getTime() / 1000);
        const now = Math.floor(Date.now() / 1000);
        
        if (expiresAt && expiresAt > now) {
          actingUserId = session.acting_user_id;
        }
      }
    } catch (error) {
      logger.warn('[AuthContext] Error checking session', { error, sessionId });
    }
  }

  // If impersonating, get customerId from acting user
  if (actingUserId !== realUserId) {
    try {
      const actingUser = await db.get(USERS_TABLE, { user_id: actingUserId });
      if (actingUser) {
        customerId = actingUser.customer_id;
      }
    } catch (error) {
      logger.warn('[AuthContext] Error fetching acting user', { error, actingUserId });
    }
  }

  // If customerId still not set, try to get from claims or derive from user
  if (!customerId) {
    // Try to get from user record
    try {
      const user = await db.get(USERS_TABLE, { user_id: actingUserId });
      if (user) {
        customerId = user.customer_id;
      }
    } catch (error) {
      logger.warn('[AuthContext] Error fetching user for customerId', { error, actingUserId });
    }

    // Last resort: use tenant_id fallback (for migration period)
    if (!customerId && claims['custom:tenant_id']) {
      customerId = claims['custom:tenant_id'] as string;
      logger.warn('[AuthContext] Using tenant_id as customerId fallback', { customerId });
    }
  }

  if (!customerId) {
    logger.error('[AuthContext] No customerId found', { realUserId, actingUserId, role });
    return null;
  }

  // Check for agency view mode (only for SUPER_ADMIN)
  const viewMode = event.headers['x-view-mode'] || event.headers['X-View-Mode'];
  const selectedCustomerId = event.headers['x-selected-customer-id'] || event.headers['X-Selected-Customer-Id'];
  
  let finalCustomerId = customerId;
  let finalViewMode: 'agency' | 'subaccount' | undefined = undefined;

  // Only SUPER_ADMIN can use agency view
  if (role === 'SUPER_ADMIN') {
    if (viewMode === 'agency') {
      finalViewMode = 'agency';
      // In agency view, use selected customer if provided, otherwise use real user's customer
      if (selectedCustomerId) {
        finalCustomerId = selectedCustomerId;
      }
      // If no selected customer, stay in agency view but use real user's customer as default
    } else {
      finalViewMode = 'subaccount';
      // In subaccount view, use acting user's customer
    }
  }

  return {
    realUserId,
    actingUserId,
    role,
    customerId: finalCustomerId,
    isImpersonating: actingUserId !== realUserId,
    viewMode: finalViewMode,
    selectedCustomerId: selectedCustomerId || undefined,
  };
}

/**
 * Extract session ID from Authorization header if present
 * Format: Bearer <token> or Session <session_id>
 */
function extractSessionIdFromAuth(authHeader?: string): string | undefined {
  if (!authHeader) return undefined;
  
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Session') {
    return parts[1];
  }
  
  return undefined;
}
