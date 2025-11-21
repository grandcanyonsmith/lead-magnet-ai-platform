/**
 * Service for managing execution steps stored in S3.
 * Handles fetching, saving, and editing execution steps.
 */
export declare class ExecutionStepsService {
    /**
     * Fetch execution steps from S3.
     */
    fetchFromS3(s3Key: string): Promise<any[]>;
    /**
     * Save execution steps to S3.
     */
    saveToS3(s3Key: string, executionSteps: any[]): Promise<void>;
    /**
     * Edit a step's output using AI.
     */
    editStep(s3Key: string, stepOrder: number, userPrompt: string, save: boolean): Promise<{
        original_output: any;
        edited_output: any;
        changes_summary: string;
        saved: boolean;
    }>;
}
export declare const executionStepsService: ExecutionStepsService;
//# sourceMappingURL=executionStepsService.d.ts.map