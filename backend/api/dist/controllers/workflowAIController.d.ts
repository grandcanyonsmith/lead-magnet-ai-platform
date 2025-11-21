import { RouteResponse } from '../routes';
/**
 * Controller for AI-powered workflow operations.
 * Handles workflow generation, refinement, and AI editing.
 */
export declare class WorkflowAIController {
    /**
     * Validate webhook URL format.
     */
    private _validateWebhookUrl;
    /**
     * Create workflow generation job record.
     */
    private _createWorkflowGenerationJob;
    /**
     * Trigger async job processing (Lambda or local).
     */
    private _triggerJobProcessing;
    /**
     * Generate a workflow with AI (async).
     * Creates a job and triggers async processing.
     */
    generateWithAI(tenantId: string, body: any): Promise<RouteResponse>;
    /**
     * Initialize generation service and start timing.
     */
    private _initializeGeneration;
    /**
     * Fetch brand context and ICP content.
     */
    private _fetchBrandAndICPContext;
    /**
     * Generate all workflow components in parallel.
     */
    private _generateWorkflowComponents;
    /**
     * Save workflow result and update job status.
     */
    private _saveWorkflowResult;
    /**
     * Send webhook notification.
     */
    private _sendWebhookNotification;
    /**
     * Handle job error and send failure webhook if needed.
     */
    private _handleJobError;
    /**
     * Process a workflow generation job.
     * Called asynchronously to generate the workflow.
     */
    processWorkflowGenerationJob(jobId: string, tenantId: string, description: string, model: string): Promise<void>;
    /**
     * Get the status of a workflow generation job.
     */
    getGenerationStatus(tenantId: string, jobId: string): Promise<RouteResponse>;
    /**
     * Refine workflow instructions using AI.
     */
    refineInstructions(tenantId: string, body: any): Promise<RouteResponse>;
    /**
     * Generate a workflow step using AI.
     */
    aiGenerateStep(tenantId: string, workflowId: string, body: any): Promise<RouteResponse>;
    /**
     * Edit a workflow using AI.
     */
    aiEditWorkflow(tenantId: string, workflowId: string, body: any): Promise<RouteResponse>;
}
export declare const workflowAIController: WorkflowAIController;
//# sourceMappingURL=workflowAIController.d.ts.map