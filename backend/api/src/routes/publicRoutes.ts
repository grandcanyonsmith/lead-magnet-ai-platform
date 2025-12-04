import { formsController } from '@domains/forms';
import { jobsController } from '../controllers/jobs.controller';
import { webhooksController } from '../controllers/webhooks.controller';
import { openAIWebhookController } from '../controllers/openai-webhook.controller';
import { router } from './router';
import { logger } from '../utils/logger';

/**
 * Public routes that don't require authentication.
 * These routes are accessible without tenant authentication.
 */
export function registerPublicRoutes(): void {
  // Public form rendering
  router.register('GET', '/v1/forms/:slug', async (params) => {
    logger.info('[Public Routes] GET /v1/forms/:slug', { slug: params.slug });
    return await formsController.getPublicForm(params.slug);
  }, false);

  // Public form submission
  router.register('POST', '/v1/forms/:slug/submit', async (params, body, _query, _tenantId, context) => {
    logger.info('[Public Routes] POST /v1/forms/:slug/submit', { slug: params.slug });
    return await formsController.submitForm(params.slug, body, context?.sourceIp || '');
  }, false);

  // Public job status endpoint (for form submissions)
  router.register('GET', '/v1/jobs/:jobId/status', async (params) => {
    logger.info('[Public Routes] GET /v1/jobs/:jobId/status', { jobId: params.jobId });
    return await jobsController.getPublicStatus(params.jobId);
  }, false);

  // Public webhook endpoint
  router.register('POST', '/v1/webhooks/:token', async (params, body, _query, _tenantId, context) => {
    logger.info('[Public Routes] POST /v1/webhooks/:token', { token: params.token });
    const headers = context?.event?.headers || {};
    return await webhooksController.handleWebhook(params.token, body, context?.sourceIp || '', headers);
  }, false);

  // OpenAI webhook endpoint
  router.register('POST', '/v1/openai/webhook', async (_params, body, _query, _tenantId, context) => {
    logger.info('[Public Routes] POST /v1/openai/webhook');
    const headers = context?.event?.headers || {};
    const rawBody = context?.event?.body;
    const sourceIp = context?.sourceIp || '';
    return await openAIWebhookController.handleWebhook(body, headers, rawBody, sourceIp);
  }, false);
}

