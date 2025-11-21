import { RouteResponse } from '../routes';
declare class SubmissionsController {
    list(_tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse>;
    get(_tenantId: string, submissionId: string): Promise<RouteResponse>;
}
export declare const submissionsController: SubmissionsController;
export {};
//# sourceMappingURL=submissions.d.ts.map