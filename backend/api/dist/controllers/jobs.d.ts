import { RouteResponse } from '../routes';
declare class JobsController {
    list(_tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse>;
    get(tenantId: string, jobId: string): Promise<RouteResponse>;
    /**
     * Get the final document for a job by serving the final artifact content.
     * This endpoint proxies the artifact content to avoid CloudFront redirect issues.
     */
    getDocument(tenantId: string, jobId: string): Promise<RouteResponse>;
    getPublicStatus(jobId: string): Promise<RouteResponse>;
    resubmit(_tenantId: string, jobId: string): Promise<RouteResponse>;
}
export declare const jobsController: JobsController;
export {};
//# sourceMappingURL=jobs.d.ts.map