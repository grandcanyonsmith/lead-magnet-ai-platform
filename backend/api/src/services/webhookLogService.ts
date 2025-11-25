import { ulid } from 'ulid';
import { db } from '../utils/db';
import { env } from '../utils/env';
import { logger } from '../utils/logger';

const WEBHOOK_LOGS_TABLE = env.webhookLogsTable;

export interface WebhookLogData {
  tenant_id?: string | null;
  webhook_token?: string | null;
  endpoint: string;
  request_body: any;
  request_headers?: Record<string, string | undefined>;
  source_ip?: string;
  response_status?: number;
  response_body?: any;
  error_message?: string;
  error_stack?: string;
  processing_time_ms?: number;
}

/**
 * Service for logging webhook requests to DynamoDB
 */
export class WebhookLogService {
  /**
   * Log a webhook request to the database
   * @param data Webhook log data
   * @returns The created log entry
   */
  async logWebhookRequest(data: WebhookLogData): Promise<any> {
    const logId = `log_${ulid()}`;
    const createdAt = new Date().toISOString();

    // Stringify request/response bodies to avoid DynamoDB size limits
    const requestBodyStr = typeof data.request_body === 'string' 
      ? data.request_body 
      : JSON.stringify(data.request_body || {});
    
    const responseBodyStr = data.response_body !== undefined
      ? (typeof data.response_body === 'string' 
          ? data.response_body 
          : JSON.stringify(data.response_body))
      : undefined;

    const logEntry: any = {
      log_id: logId,
      created_at: createdAt,
      endpoint: data.endpoint,
      request_body: requestBodyStr,
      processing_time_ms: data.processing_time_ms,
    };

    // Add optional fields only if they exist
    if (data.tenant_id !== undefined && data.tenant_id !== null) {
      logEntry.tenant_id = data.tenant_id;
    }

    if (data.webhook_token !== undefined && data.webhook_token !== null) {
      logEntry.webhook_token = data.webhook_token;
    }

    if (data.request_headers) {
      logEntry.request_headers = JSON.stringify(data.request_headers);
    }

    if (data.source_ip) {
      logEntry.source_ip = data.source_ip;
    }

    if (data.response_status !== undefined) {
      logEntry.response_status = data.response_status;
    }

    if (responseBodyStr !== undefined) {
      logEntry.response_body = responseBodyStr;
    }

    if (data.error_message) {
      logEntry.error_message = data.error_message;
    }

    if (data.error_stack) {
      logEntry.error_stack = data.error_stack;
    }

    try {
      await db.put(WEBHOOK_LOGS_TABLE, logEntry);
      logger.debug('[WebhookLogService] Logged webhook request', { logId, endpoint: data.endpoint });
      return logEntry;
    } catch (error: any) {
      // Don't throw - logging failures shouldn't break webhook processing
      logger.error('[WebhookLogService] Failed to log webhook request', {
        error: error.message,
        errorStack: error.stack,
        logId,
        endpoint: data.endpoint,
      });
      return null;
    }
  }
}

export const webhookLogService = new WebhookLogService();

