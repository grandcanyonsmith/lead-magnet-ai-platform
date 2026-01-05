import { logger } from '@utils/logger';
import { retryWithBackoff } from '@utils/errorHandling';
import { withTimeout } from '@utils/timeout';
import { validateUrl } from '@utils/validators';
import { BrandSettings } from '@utils/types';

const MAX_CONTENT_LENGTH = 50000; // Limit to ~50k characters to avoid token limits
const FETCH_TIMEOUT = 10000; // 10 seconds timeout
const MAX_RETRY_ATTEMPTS = 3;

export async function fetchICPContent(url: string): Promise<string | null> {
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    logger.warn('[ICP Fetcher] Empty or invalid URL provided');
    return null;
  }

  try {
    validateUrl(url, 'ICP document URL');
  } catch (error) {
    logger.warn('[ICP Fetcher] Invalid URL format', {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  return retryWithBackoff(
    async () => {
      logger.info('[ICP Fetcher] Fetching ICP document', { url });

      const fetchPromise = fetch(url, {
        headers: {
          'User-Agent': 'LeadMagnet-AI/1.0',
          Accept: 'text/html,text/plain,application/json,application/pdf',
        },
      });

      const response = await withTimeout(fetchPromise, FETCH_TIMEOUT, `ICP fetch timed out after ${FETCH_TIMEOUT}ms`);

      if (!response.ok) {
        logger.warn('[ICP Fetcher] Failed to fetch ICP document', {
          url,
          status: response.status,
          statusText: response.statusText,
        });
        return null;
      }

      const contentType = response.headers.get('content-type') || '';
      const content = await processContent(response, contentType, url);

      if (content === null) {
        return null;
      }

      if (content.length > MAX_CONTENT_LENGTH) {
        logger.warn('[ICP Fetcher] ICP content truncated', {
          url,
          originalLength: content.length,
          truncatedLength: MAX_CONTENT_LENGTH,
        });
        return content.substring(0, MAX_CONTENT_LENGTH) + '\n\n[Content truncated...]';
      }

      logger.info('[ICP Fetcher] Successfully fetched ICP document', {
        url,
        contentLength: content.length,
        contentType,
      });

      return content;
    },
    {
      maxAttempts: MAX_RETRY_ATTEMPTS,
      initialDelayMs: 1000,
      onRetry: (attempt, error) => {
        logger.debug('[ICP Fetcher] Retrying fetch', {
          attempt,
          url,
          error: error instanceof Error ? error.message : String(error),
        });
      },
    }
  ).catch((error) => {
    logger.error('[ICP Fetcher] Failed to fetch ICP document after retries', {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  });
}

async function processContent(response: Response, contentType: string, url: string): Promise<string | null> {
  if (contentType.includes('application/json')) {
    try {
      const json = await response.json();
      return JSON.stringify(json, null, 2);
    } catch (error) {
      logger.warn('[ICP Fetcher] Failed to parse JSON content', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  if (contentType.includes('text/')) {
    return await response.text();
  }

  if (contentType.includes('application/pdf')) {
    logger.warn('[ICP Fetcher] PDF content type not supported', { url, contentType });
    return null;
  }

  try {
    return await response.text();
  } catch (error) {
    logger.warn('[ICP Fetcher] Failed to extract text content', {
      url,
      contentType,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function buildBrandContext(settings: BrandSettings | Record<string, unknown>): string {
  if (!settings || typeof settings !== 'object') {
    return '';
  }
  const contextParts: string[] = [];

  if (settings.organization_name) {
    contextParts.push(`Organization: ${settings.organization_name}`);
  }

  if (settings.industry) {
    contextParts.push(`Industry: ${settings.industry}`);
  }

  if (settings.company_size) {
    contextParts.push(`Company Size: ${settings.company_size}`);
  }

  if (settings.brand_description) {
    contextParts.push(`Brand Description: ${settings.brand_description}`);
  }

  if (settings.brand_voice) {
    contextParts.push(`Brand Voice: ${settings.brand_voice}`);
  }

  if (settings.target_audience) {
    contextParts.push(`Target Audience: ${settings.target_audience}`);
  }

  if (settings.company_values) {
    contextParts.push(`Company Values: ${settings.company_values}`);
  }

  if (settings.brand_messaging_guidelines) {
    contextParts.push(`Brand Messaging Guidelines: ${settings.brand_messaging_guidelines}`);
  }

  if (settings.website_url) {
    contextParts.push(`Website: ${settings.website_url}`);
  }

  return contextParts.length > 0 ? contextParts.join('\n') : '';
}

export const workflowContextService = {
  fetchICPContent,
  buildBrandContext,
};

export type WorkflowContextService = typeof workflowContextService;
