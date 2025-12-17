import crypto from 'crypto';
import { setErrorTrackingHook, ApiError } from '@utils/errors';
import { env } from '@utils/env';
import { logger } from '@utils/logger';

type ErrorWebhookPayload = Record<string, any>;

function createErrorId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `err_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

async function postToErrorWebhook(payload: ErrorWebhookPayload): Promise<void> {
  if (!env.errorWebhookUrl) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.errorWebhookTimeoutMs);

  try {
    await fetch(env.errorWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...env.errorWebhookHeaders,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error: any) {
    logger.warn('[ErrorReporting] Failed to POST to error webhook', {
      error: error?.message || String(error),
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function initErrorReporting(): void {
  // Hook into centralized error handler without changing per-route code.
  setErrorTrackingHook((error: ApiError, context?: Record<string, any>) => {
    const errorId = createErrorId();
    const payload: ErrorWebhookPayload = {
      source: 'api',
      kind: 'server_error',
      error_id: errorId,
      timestamp: new Date().toISOString(),
      error: error.toLogObject(),
      context: context || {},
      env: {
        nodeEnv: env.nodeEnv,
        awsRegion: env.awsRegion,
      },
    };

    // Always log a single, searchable entry with an error_id.
    logger.error('[ErrorReporting] Captured server error', {
      error_id: errorId,
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      ...(context && { context }),
    });

    // Fire-and-forget webhook send (best effort)
    void postToErrorWebhook(payload);
  });
}

export async function reportClientError(args: {
  tenantId?: string;
  userId?: string;
  sourceIp?: string;
  requestId?: string;
  payload: Record<string, any>;
}): Promise<{ errorId: string }> {
  const errorId = createErrorId();

  const payload: ErrorWebhookPayload = {
    source: 'frontend',
    kind: 'client_error',
    error_id: errorId,
    timestamp: new Date().toISOString(),
    tenant_id: args.tenantId,
    user_id: args.userId,
    source_ip: args.sourceIp,
    request_id: args.requestId,
    payload: args.payload,
    env: {
      nodeEnv: env.nodeEnv,
      awsRegion: env.awsRegion,
    },
  };

  logger.error('[ErrorReporting] Captured client error', payload);
  void postToErrorWebhook(payload);

  return { errorId };
}


