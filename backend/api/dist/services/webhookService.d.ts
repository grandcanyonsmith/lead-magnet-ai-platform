/**
 * Webhook Service
 * Handles sending webhook notifications for workflow generation completion.
 */
export interface WorkflowGenerationWebhookPayload {
    job_id: string;
    status: 'completed' | 'failed';
    workflow_id?: string;
    workflow?: any;
    error_message?: string;
    completed_at?: string;
    failed_at?: string;
}
/**
 * Send a webhook notification for workflow generation completion.
 *
 * @param webhookUrl - The webhook URL to send the notification to
 * @param payload - The payload to send in the webhook
 * @returns Promise that resolves when webhook is sent successfully
 */
export declare function sendWorkflowGenerationWebhook(webhookUrl: string, payload: WorkflowGenerationWebhookPayload): Promise<void>;
//# sourceMappingURL=webhookService.d.ts.map