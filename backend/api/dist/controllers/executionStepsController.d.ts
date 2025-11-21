import { RouteResponse } from '../routes';
/**
 * Controller for execution steps operations.
 * Handles fetching and editing execution steps stored in S3.
 */
export declare class ExecutionStepsController {
    /**
     * Get execution steps for a job by fetching directly from S3.
     * This endpoint proxies the execution steps to avoid presigned URL expiration issues.
     */
    getExecutionSteps(tenantId: string, jobId: string): Promise<RouteResponse>;
    /**
     * Quick edit a step's output using AI.
     * Fetches execution steps from S3, edits the specified step, and optionally saves back.
     */
    quickEditStep(tenantId: string, jobId: string, body: any): Promise<RouteResponse>;
}
export declare const executionStepsController: ExecutionStepsController;
//# sourceMappingURL=executionStepsController.d.ts.map