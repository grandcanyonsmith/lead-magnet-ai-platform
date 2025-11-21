import { RouteResponse } from '../routes';
import { RequestContext } from '../routes/router';
/**
 * Auth Controller
 * Handles authentication-related endpoints
 */
declare class AuthController {
    /**
     * Get current user information
     * GET /me
     */
    getMe(_params: Record<string, string>, _body: any, _query: Record<string, string | undefined>, _tenantId: string | undefined, context?: RequestContext): Promise<RouteResponse>;
}
export declare const authController: AuthController;
export {};
//# sourceMappingURL=auth.d.ts.map