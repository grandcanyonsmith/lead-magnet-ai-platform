export interface FormSubmissionData extends Record<string, any> {
    name: string;
    email: string;
    phone: string;
}
export interface SubmissionResult {
    submissionId: string;
    jobId: string;
    message: string;
    redirectUrl?: string;
}
/**
 * Service for handling form submissions and job creation.
 */
export declare class FormSubmissionService {
    /**
     * Create a submission and start job processing.
     *
     * Execution Path Selection:
     * - Step Functions (Production): When STEP_FUNCTIONS_ARN is set and not in local/dev mode
     * - Direct Processing (Local): When IS_LOCAL=true OR NODE_ENV=development OR STEP_FUNCTIONS_ARN not set
     *
     * See docs/EXECUTION_PATHS.md for detailed explanation.
     */
    submitFormAndStartJob(form: any, submissionData: FormSubmissionData, sourceIp: string, thankYouMessage?: string, redirectUrl?: string): Promise<SubmissionResult>;
    /**
     * Start job processing using either Step Functions or local processing.
     */
    private startJobProcessing;
}
export declare const formSubmissionService: FormSubmissionService;
//# sourceMappingURL=formSubmissionService.d.ts.map