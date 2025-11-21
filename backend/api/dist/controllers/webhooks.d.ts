import { RouteResponse } from '../routes';
declare class WebhooksController {
    /**
     * Handle incoming webhook POST request
     * Looks up user by token, finds workflow, creates submission/job, and triggers execution
     */
    handleWebhook(token: string, body: any, sourceIp: string): Promise<RouteResponse>;
    /**
     * Find user_settings by webhook_token
     * Scans the user_settings table to find matching token
     */
    private findUserByWebhookToken;
}
export declare const webhooksController: WebhooksController;
export {};
//# sourceMappingURL=webhooks.d.ts.map