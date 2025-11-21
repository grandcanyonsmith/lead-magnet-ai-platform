import { RouteResponse } from '../routes';
import { RequestContext } from '../routes/router';
/**
 * Admin Controller
 * Handles admin-only operations
 */
declare class AdminController {
    /**
     * List/search users (admin only)
     * GET /admin/users
     */
    listUsers(_params: Record<string, string>, _body: any, query: Record<string, string | undefined>, _tenantId: string | undefined, context?: RequestContext): Promise<RouteResponse>;
    /**
     * List all users for agency view (super admin only)
     * GET /admin/agency/users
     */
    listAgencyUsers(_params: Record<string, string>, _body: any, query: Record<string, string | undefined>, _tenantId: string | undefined, context?: RequestContext): Promise<RouteResponse>;
    /**
     * Update user role (super admin only)
     * PUT /admin/agency/users/:userId
     */
    updateUserRole(params: Record<string, string>, body: any, _query: Record<string, string | undefined>, _tenantId: string | undefined, context?: RequestContext): Promise<RouteResponse>;
    /**
     * List all customers/subaccounts (super admin only)
     * GET /admin/agency/customers
     */
    listAgencyCustomers(_params: Record<string, string>, _body: any, query: Record<string, string | undefined>, _tenantId: string | undefined, context?: RequestContext): Promise<RouteResponse>;
}
export declare const adminController: AdminController;
export {};
//# sourceMappingURL=admin.d.ts.map