import { RouteResponse } from '../routes';
import { RequestContext } from '../routes/router';
/**
 * Impersonation Controller
 * Handles user impersonation for admins
 */
declare class ImpersonationController {
    /**
     * Start impersonation
     * POST /admin/impersonate
     */
    start(_params: Record<string, string>, body: any, _query: Record<string, string | undefined>, _tenantId: string | undefined, context?: RequestContext): Promise<RouteResponse>;
    /**
     * Stop impersonation
     * POST /admin/impersonate/reset
     */
    reset(_params: Record<string, string>, body: any, _query: Record<string, string | undefined>, _tenantId: string | undefined, context?: RequestContext): Promise<RouteResponse>;
}
export declare const impersonationController: ImpersonationController;
export {};
//# sourceMappingURL=impersonation.d.ts.map