import { db, normalizeQueryResult } from '../utils/db';
import { RouteResponse } from '../routes';
import { logger } from '../utils/logger';
import { env } from '../utils/env';
import { webhooksController } from './webhooks';
import { openAIWebhookController } from './openaiWebhookController';

const WEBHOOK_LOGS_TABLE = env.webhookLogsTable;

interface WebhookLogQueryParams {
  limit?: number;
  offset?: number;
  tenant_id?: string;
  webhook_token?: string;
  endpoint?: string;
  status?: string; // success, error, all
}

class WebhookLogsController {
  /**
   * List webhook logs with filtering and pagination
   */
  async list(tenantId: string, query: WebhookLogQueryParams = {}): Promise<RouteResponse> {
    const limit = Math.min(query.limit || 50, 100);
    const offset = query.offset || 0;
    const statusFilter = query.status || 'all';

    try {
      let logs: any[] = [];

      // Query by tenant_id if provided
      if (tenantId) {
        const result = await db.query(
          WEBHOOK_LOGS_TABLE,
          'gsi_tenant_created',
          'tenant_id = :tenant_id',
          { ':tenant_id': tenantId },
          undefined,
          limit + offset + 1 // Fetch enough to handle pagination
        );
        logs = normalizeQueryResult(result);
        // Apply offset manually since DynamoDB query doesn't support offset directly
        if (offset > 0 && result.lastEvaluatedKey) {
          // For simplicity, we'll just slice the results
          // In production, you'd use lastEvaluatedKey for proper pagination
        }
      } else {
        // If no tenant_id, scan the table (admin only)
        const allLogs = await db.scan(WEBHOOK_LOGS_TABLE);
        logs = allLogs;
      }

      // Filter by endpoint if provided
      if (query.endpoint) {
        logs = logs.filter(log => log.endpoint === query.endpoint);
      }

      // Filter by webhook_token if provided
      if (query.webhook_token) {
        logs = logs.filter(log => log.webhook_token === query.webhook_token);
      }

      // Filter by status
      if (statusFilter !== 'all') {
        if (statusFilter === 'success') {
          logs = logs.filter(log => !log.error_message && log.response_status && log.response_status < 400);
        } else if (statusFilter === 'error') {
          logs = logs.filter(log => log.error_message || (log.response_status && log.response_status >= 400));
        }
      }

      // Sort by created_at descending (newest first)
      logs.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });

      // Apply pagination
      const paginatedLogs = logs.slice(offset, offset + limit);
      const hasMore = logs.length > offset + limit;

      return {
        statusCode: 200,
        body: {
          logs: paginatedLogs,
          total: paginatedLogs.length,
          has_more: hasMore,
        },
      };
    } catch (error: any) {
      logger.error('[WebhookLogs] Failed to list logs', {
        error: error.message,
        errorStack: error.stack,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Get a specific webhook log by ID
   */
  async get(tenantId: string, logId: string): Promise<RouteResponse> {
    try {
      const log = await db.get(WEBHOOK_LOGS_TABLE, { log_id: logId });

      if (!log) {
        return {
          statusCode: 404,
          body: { error: 'Webhook log not found' },
        };
      }

      // Check tenant access (if log has tenant_id)
      if (log.tenant_id && log.tenant_id !== tenantId) {
        return {
          statusCode: 403,
          body: { error: 'You don\'t have permission to access this log' },
        };
      }

      return {
        statusCode: 200,
        body: log,
      };
    } catch (error: any) {
      logger.error('[WebhookLogs] Failed to get log', {
        error: error.message,
        errorStack: error.stack,
        logId,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Retry a webhook request
   */
  async retry(tenantId: string, logId: string): Promise<RouteResponse> {
    try {
      const log = await db.get(WEBHOOK_LOGS_TABLE, { log_id: logId });

      if (!log) {
        return {
          statusCode: 404,
          body: { error: 'Webhook log not found' },
        };
      }

      // Check tenant access
      if (log.tenant_id && log.tenant_id !== tenantId) {
        return {
          statusCode: 403,
          body: { error: 'You don\'t have permission to retry this webhook' },
        };
      }

      // Parse request body
      let requestBody: any;
      try {
        requestBody = typeof log.request_body === 'string' 
          ? JSON.parse(log.request_body) 
          : log.request_body;
      } catch (e) {
        requestBody = log.request_body;
      }

      // Retry based on endpoint
      if (log.endpoint === '/v1/webhooks/:token' && log.webhook_token) {
        // Retry main webhook
        const headers = log.request_headers 
          ? (typeof log.request_headers === 'string' ? JSON.parse(log.request_headers) : log.request_headers)
          : {};
        const result = await webhooksController.handleWebhook(
          log.webhook_token,
          requestBody,
          log.source_ip || '',
          headers
        );
        return {
          statusCode: 200,
          body: {
            message: 'Webhook retried successfully',
            result,
          },
        };
      } else if (log.endpoint === '/v1/openai/webhook') {
        // Retry OpenAI webhook
        const headers = log.request_headers 
          ? (typeof log.request_headers === 'string' ? JSON.parse(log.request_headers) : log.request_headers)
          : {};
        const result = await openAIWebhookController.handleWebhook(
          requestBody,
          headers,
          typeof log.request_body === 'string' ? log.request_body : JSON.stringify(log.request_body),
          log.source_ip
        );
        return {
          statusCode: 200,
          body: {
            message: 'Webhook retried successfully',
            result,
          },
        };
      } else {
        return {
          statusCode: 400,
          body: { error: 'Unknown webhook endpoint, cannot retry' },
        };
      }
    } catch (error: any) {
      logger.error('[WebhookLogs] Failed to retry webhook', {
        error: error.message,
        errorStack: error.stack,
        logId,
        tenantId,
      });
      return {
        statusCode: 500,
        body: { error: `Failed to retry webhook: ${error.message}` },
      };
    }
  }
}

export const webhookLogsController = new WebhookLogsController();

