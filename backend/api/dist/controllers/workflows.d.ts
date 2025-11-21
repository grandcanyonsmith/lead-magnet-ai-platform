import { RouteResponse } from '../routes';
declare class WorkflowsController {
    list(_tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse>;
    get(_tenantId: string, workflowId: string): Promise<RouteResponse>;
    create(tenantId: string, body: any): Promise<RouteResponse>;
    update(_tenantId: string, workflowId: string, body: any): Promise<RouteResponse>;
    delete(_tenantId: string, workflowId: string): Promise<RouteResponse>;
}
export declare const workflowsController: WorkflowsController;
export {};
//# sourceMappingURL=workflows.d.ts.map