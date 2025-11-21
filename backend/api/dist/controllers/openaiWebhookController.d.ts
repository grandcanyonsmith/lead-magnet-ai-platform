/**
 * OpenAI Webhook Controller
 * Handles incoming webhook events from OpenAI (response.completed, response.failed, etc.)
 */
import { RouteResponse } from '../routes';
export declare class OpenAIWebhookController {
    /**
     * Get webhook signing secret from AWS Secrets Manager
     */
    private getWebhookSecret;
    /**
     * Handle incoming OpenAI webhook events
     */
    handleWebhook(body: any, headers: Record<string, string | undefined>, rawBody?: string): Promise<RouteResponse>;
    /**
     * Handle response.completed event
     */
    private handleResponseCompleted;
    /**
     * Handle response.failed event
     */
    private handleResponseFailed;
    /**
     * Handle response.cancelled event
     */
    private handleResponseCancelled;
    /**
     * Handle response.incomplete event
     */
    private handleResponseIncomplete;
}
export declare const openAIWebhookController: OpenAIWebhookController;
//# sourceMappingURL=openaiWebhookController.d.ts.map