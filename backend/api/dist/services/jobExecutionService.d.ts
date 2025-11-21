export interface JobExecutionParams {
    jobId: string;
    tenantId: string;
    workflowId: string;
    submissionId: string;
}
/**
 * Service for handling job execution via Step Functions or local processing.
 *
 * Execution Path Selection:
 * - Step Functions (Production): When STEP_FUNCTIONS_ARN is set and not in local/dev mode
 * - Direct Processing (Local): When IS_LOCAL=true OR NODE_ENV=development OR STEP_FUNCTIONS_ARN not set
 *
 * See docs/EXECUTION_PATHS.md for detailed explanation.
 */
export declare class JobExecutionService {
    /**
     * Start job processing using either Step Functions or local processing.
     */
    startJobProcessing(params: JobExecutionParams): Promise<void>;
}
export declare const jobExecutionService: JobExecutionService;
//# sourceMappingURL=jobExecutionService.d.ts.map