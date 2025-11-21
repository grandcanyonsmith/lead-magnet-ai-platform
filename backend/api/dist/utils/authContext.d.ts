import { APIGatewayProxyEventV2 } from 'aws-lambda';
/**
 * Auth context extracted from JWT claims and session
 */
export interface AuthContext {
    realUserId: string;
    actingUserId: string;
    role: string;
    customerId: string;
    isImpersonating: boolean;
    viewMode?: 'agency' | 'subaccount';
    selectedCustomerId?: string;
}
/**
 * Extended request context with auth information
 */
export interface ExtendedRequestContext {
    sourceIp: string;
    event: APIGatewayProxyEventV2;
    auth: AuthContext;
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
export declare function extractAuthContext(event: APIGatewayProxyEventV2): Promise<AuthContext | null>;
//# sourceMappingURL=authContext.d.ts.map