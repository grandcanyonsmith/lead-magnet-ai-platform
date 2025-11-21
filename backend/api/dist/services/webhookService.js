"use strict";
/**
 * Webhook Service
 * Handles sending webhook notifications for workflow generation completion.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWorkflowGenerationWebhook = sendWorkflowGenerationWebhook;
const logger_1 = require("../utils/logger");
const retry_1 = require("../utils/retry");
const WEBHOOK_TIMEOUT_MS = 30000; // 30 seconds timeout for webhook requests
const MAX_RETRY_ATTEMPTS = 3;
/**
 * Send a webhook notification for workflow generation completion.
 *
 * @param webhookUrl - The webhook URL to send the notification to
 * @param payload - The payload to send in the webhook
 * @returns Promise that resolves when webhook is sent successfully
 */
async function sendWorkflowGenerationWebhook(webhookUrl, payload) {
    if (!webhookUrl || typeof webhookUrl !== 'string' || webhookUrl.trim().length === 0) {
        logger_1.logger.warn('[Webhook Service] Invalid webhook URL provided', { webhookUrl });
        return;
    }
    logger_1.logger.info('[Webhook Service] Sending workflow generation webhook', {
        webhookUrl,
        jobId: payload.job_id,
        status: payload.status,
    });
    return (0, retry_1.retryWithBackoff)(async () => {
        const fetchPromise = fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'LeadMagnet-AI/1.0',
            },
            body: JSON.stringify(payload),
        });
        // Add timeout using Promise.race
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Webhook request timed out after ${WEBHOOK_TIMEOUT_MS}ms`));
            }, WEBHOOK_TIMEOUT_MS);
        });
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unable to read response');
            logger_1.logger.warn('[Webhook Service] Webhook returned non-OK status', {
                webhookUrl,
                jobId: payload.job_id,
                status: response.status,
                statusText: response.statusText,
                errorText: errorText.substring(0, 200), // Truncate long error messages
            });
            throw new Error(`Webhook returned status ${response.status}: ${response.statusText}`);
        }
        logger_1.logger.info('[Webhook Service] Webhook sent successfully', {
            webhookUrl,
            jobId: payload.job_id,
            status: response.status,
        });
    }, {
        maxAttempts: MAX_RETRY_ATTEMPTS,
        initialDelayMs: 1000,
        onRetry: (attempt, error) => {
            logger_1.logger.debug('[Webhook Service] Retrying webhook send', {
                attempt,
                webhookUrl,
                jobId: payload.job_id,
                error: error instanceof Error ? error.message : String(error),
            });
        },
    }).catch((error) => {
        // Log error but don't throw - webhook failures shouldn't fail the job
        logger_1.logger.error('[Webhook Service] Failed to send webhook after retries', {
            webhookUrl,
            jobId: payload.job_id,
            error: error instanceof Error ? error.message : String(error),
        });
        // Don't rethrow - webhook failures are non-critical
    });
}
//# sourceMappingURL=webhookService.js.map