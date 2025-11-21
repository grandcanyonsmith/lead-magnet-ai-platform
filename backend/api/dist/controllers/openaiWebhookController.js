"use strict";
/**
 * OpenAI Webhook Controller
 * Handles incoming webhook events from OpenAI (response.completed, response.failed, etc.)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.openAIWebhookController = exports.OpenAIWebhookController = void 0;
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const env_1 = require("../utils/env");
const webhookSignature_1 = require("../utils/webhookSignature");
const OPENAI_WEBHOOK_SECRET_NAME = 'leadmagnet/openai-webhook-secret';
const secretsClient = new client_secrets_manager_1.SecretsManagerClient({ region: env_1.env.awsRegion });
// Cache the webhook secret
let cachedWebhookSecret = null;
class OpenAIWebhookController {
    /**
     * Get webhook signing secret from AWS Secrets Manager
     */
    async getWebhookSecret() {
        if (cachedWebhookSecret) {
            return cachedWebhookSecret;
        }
        try {
            const command = new client_secrets_manager_1.GetSecretValueCommand({ SecretId: OPENAI_WEBHOOK_SECRET_NAME });
            const response = await secretsClient.send(command);
            if (!response.SecretString) {
                throw new errors_1.ApiError('OpenAI webhook secret not found', 500);
            }
            cachedWebhookSecret = response.SecretString;
            logger_1.logger.info('[OpenAI Webhook] Secret retrieved and cached');
            return cachedWebhookSecret;
        }
        catch (error) {
            logger_1.logger.error('[OpenAI Webhook] Error retrieving webhook secret', {
                error: error.message,
                secretName: OPENAI_WEBHOOK_SECRET_NAME,
            });
            throw new errors_1.ApiError(`Failed to retrieve webhook secret: ${error.message}`, 500);
        }
    }
    /**
     * Handle incoming OpenAI webhook events
     */
    async handleWebhook(body, headers, rawBody) {
        logger_1.logger.info('[OpenAI Webhook] Received webhook event', {
            eventType: body?.type,
            eventId: body?.id,
        });
        try {
            // Verify webhook signature
            const signature = (0, webhookSignature_1.extractSignatureFromHeaders)(headers);
            if (!signature) {
                logger_1.logger.warn('[OpenAI Webhook] Missing signature header');
                throw new errors_1.ApiError('Missing webhook signature', 401);
            }
            // Get webhook secret
            const secret = await this.getWebhookSecret();
            // Verify signature (use raw body if available, otherwise stringify body)
            const payload = rawBody || JSON.stringify(body);
            const isValid = (0, webhookSignature_1.verifyOpenAIWebhookSignature)(payload, signature, secret);
            if (!isValid) {
                logger_1.logger.warn('[OpenAI Webhook] Invalid signature', {
                    hasSignature: !!signature,
                    signatureLength: signature.length,
                });
                throw new errors_1.ApiError('Invalid webhook signature', 401);
            }
            logger_1.logger.info('[OpenAI Webhook] Signature verified successfully');
            // Validate webhook event structure
            if (!body || typeof body !== 'object') {
                throw new errors_1.ApiError('Invalid webhook payload', 400);
            }
            const event = body;
            // Handle different event types
            switch (event.type) {
                case 'response.completed':
                    await this.handleResponseCompleted(event);
                    break;
                case 'response.failed':
                    await this.handleResponseFailed(event);
                    break;
                case 'response.cancelled':
                    await this.handleResponseCancelled(event);
                    break;
                case 'response.incomplete':
                    await this.handleResponseIncomplete(event);
                    break;
                default:
                    logger_1.logger.warn('[OpenAI Webhook] Unknown event type', { type: event.type });
            }
            return {
                statusCode: 200,
                body: { received: true },
            };
        }
        catch (error) {
            logger_1.logger.error('[OpenAI Webhook] Error processing webhook', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }
    /**
     * Handle response.completed event
     */
    async handleResponseCompleted(event) {
        logger_1.logger.info('[OpenAI Webhook] Processing response.completed', {
            responseId: event.data.id,
        });
        // Extract response ID from event
        const responseId = event.data.id;
        // Find job by response_id (if stored)
        // Note: You may need to store response_id when creating OpenAI requests
        // For now, we'll log the event
        logger_1.logger.info('[OpenAI Webhook] Response completed', {
            responseId,
            model: event.data.model,
            hasOutput: !!event.data.output,
        });
        // Note: Job status update when response_id is linked to a job is a future enhancement
        // This would require storing response_id when making OpenAI API calls
    }
    /**
     * Handle response.failed event
     */
    async handleResponseFailed(event) {
        logger_1.logger.error('[OpenAI Webhook] Processing response.failed', {
            responseId: event.data.id,
            error: event.data.error,
        });
        const responseId = event.data.id;
        const errorMessage = event.data.error?.message || 'Unknown error';
        logger_1.logger.error('[OpenAI Webhook] Response failed', {
            responseId,
            errorMessage,
            errorCode: event.data.error?.code,
        });
        // Note: Job status update when response_id is linked to a job is a future enhancement
    }
    /**
     * Handle response.cancelled event
     */
    async handleResponseCancelled(event) {
        logger_1.logger.info('[OpenAI Webhook] Processing response.cancelled', {
            responseId: event.data.id,
        });
        // Note: Cancellation handling is a future enhancement
    }
    /**
     * Handle response.incomplete event
     */
    async handleResponseIncomplete(event) {
        logger_1.logger.info('[OpenAI Webhook] Processing response.incomplete', {
            responseId: event.data.id,
        });
        // Note: Incomplete response handling is a future enhancement
    }
}
exports.OpenAIWebhookController = OpenAIWebhookController;
exports.openAIWebhookController = new OpenAIWebhookController();
//# sourceMappingURL=openaiWebhookController.js.map