import { RouteResponse } from '../routes';
/**
 * Controller for job rerun operations.
 * Handles rerunning individual steps or entire jobs.
 */
export declare class JobRerunController {
    /**
     * Rerun a specific step in a job.
     */
    rerunStep(tenantId: string, jobId: string, stepIndex: number): Promise<RouteResponse>;
}
export declare const jobRerunController: JobRerunController;
//# sourceMappingURL=jobRerunController.d.ts.map