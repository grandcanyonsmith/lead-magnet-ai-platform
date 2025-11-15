/**
 * OpenAI Webhook Controller
 * Handles incoming webhook events from OpenAI (response.completed, response.failed, etc.)
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';
import { logger } from '../utils/logger';
import { env } from '../utils/env';
import { verifyOpenAIWebhookSignature, extractSignatureFromHeaders } from '../utils/webhookSignature';

const OPENAI_WEBHOOK_SECRET_NAME = 'leadmagnet/openai-webhook-secret';
const secretsClient = new SecretsManagerClient({ region: env.awsRegion });

// Cache the webhook secret
let cachedWebhookSecret: string | null = null;

interface OpenAIWebhookEvent {
  id: string;
  object: string;
  type: 'response.completed' | 'response.failed' | 'response.cancelled' | 'response.incomplete';
  created_at: number;
  data: {
    id: string;
    object: string;
    model?: string;
    status?: string;
    output?: any;
    error?: {
      message: string;
      code?: string;
    };
    [key: string]: any;
  };
}

export class OpenAIWebhookController {
  /**
   * Get webhook signing secret from AWS Secrets Manager
   */
  private async getWebhookSecret(): Promise<string> {
    if (cachedWebhookSecret) {
      return cachedWebhookSecret;
    }

    try {
      const command = new GetSecretValueCommand({ SecretId: OPENAI_WEBHOOK_SECRET_NAME });
      const response = await secretsClient.send(command);
      
      if (!response.SecretString) {
        throw new ApiError('OpenAI webhook secret not found', 500);
      }

      cachedWebhookSecret = response.SecretString;
      logger.info('[OpenAI Webhook] Secret retrieved and cached');
      
      return cachedWebhookSecret;
    } catch (error: any) {
      logger.error('[OpenAI Webhook] Error retrieving webhook secret', {
        error: error.message,
        secretName: OPENAI_WEBHOOK_SECRET_NAME,
      });
      throw new ApiError(`Failed to retrieve webhook secret: ${error.message}`, 500);
    }
  }

  /**
   * Handle incoming OpenAI webhook events
   */
  async handleWebhook(body: any, headers: Record<string, string | undefined>, rawBody?: string): Promise<RouteResponse> {
    logger.info('[OpenAI Webhook] Received webhook event', {
      eventType: body?.type,
      eventId: body?.id,
    });

    try {
      // Verify webhook signature
      const signature = extractSignatureFromHeaders(headers);
      if (!signature) {
        logger.warn('[OpenAI Webhook] Missing signature header');
        throw new ApiError('Missing webhook signature', 401);
      }

      // Get webhook secret
      const secret = await this.getWebhookSecret();

      // Verify signature (use raw body if available, otherwise stringify body)
      const payload = rawBody || JSON.stringify(body);
      const isValid = verifyOpenAIWebhookSignature(payload, signature, secret);

      if (!isValid) {
        logger.warn('[OpenAI Webhook] Invalid signature', {
          hasSignature: !!signature,
          signatureLength: signature.length,
        });
        throw new ApiError('Invalid webhook signature', 401);
      }

      logger.info('[OpenAI Webhook] Signature verified successfully');

      // Validate webhook event structure
      if (!body || typeof body !== 'object') {
        throw new ApiError('Invalid webhook payload', 400);
      }

      const event = body as OpenAIWebhookEvent;

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
          logger.warn('[OpenAI Webhook] Unknown event type', { type: event.type });
      }

      return {
        statusCode: 200,
        body: { received: true },
      };
    } catch (error: any) {
      logger.error('[OpenAI Webhook] Error processing webhook', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Handle response.completed event
   */
  private async handleResponseCompleted(event: OpenAIWebhookEvent): Promise<void> {
    logger.info('[OpenAI Webhook] Processing response.completed', {
      responseId: event.data.id,
    });

    // Extract response ID from event
    const responseId = event.data.id;

    // Find job by response_id (if stored)
    // Note: You may need to store response_id when creating OpenAI requests
    // For now, we'll log the event
    logger.info('[OpenAI Webhook] Response completed', {
      responseId,
      model: event.data.model,
      hasOutput: !!event.data.output,
    });

    // TODO: Update job status if response_id is linked to a job
    // This would require storing response_id when making OpenAI API calls
  }

  /**
   * Handle response.failed event
   */
  private async handleResponseFailed(event: OpenAIWebhookEvent): Promise<void> {
    logger.error('[OpenAI Webhook] Processing response.failed', {
      responseId: event.data.id,
      error: event.data.error,
    });

    const responseId = event.data.id;
    const errorMessage = event.data.error?.message || 'Unknown error';

    logger.error('[OpenAI Webhook] Response failed', {
      responseId,
      errorMessage,
      errorCode: event.data.error?.code,
    });

    // TODO: Update job status if response_id is linked to a job
  }

  /**
   * Handle response.cancelled event
   */
  private async handleResponseCancelled(event: OpenAIWebhookEvent): Promise<void> {
    logger.info('[OpenAI Webhook] Processing response.cancelled', {
      responseId: event.data.id,
    });

    // TODO: Handle cancellation
  }

  /**
   * Handle response.incomplete event
   */
  private async handleResponseIncomplete(event: OpenAIWebhookEvent): Promise<void> {
    logger.info('[OpenAI Webhook] Processing response.incomplete', {
      responseId: event.data.id,
    });

    // TODO: Handle incomplete responses
  }
}

export const openAIWebhookController = new OpenAIWebhookController();

