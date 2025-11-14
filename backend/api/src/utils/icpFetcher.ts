/**
 * Utility functions for fetching ICP (Ideal Customer Profile) document content.
 * 
 * Provides functions to fetch and process ICP documents from URLs with:
 * - Timeout handling
 * - Retry logic for transient failures
 * - Content type detection and processing
 * - Content length limits
 * - Brand context building from settings
 * 
 * @module icpFetcher
 */

import { logger } from './logger';
import { retryWithBackoff } from './retry';
import { withTimeout } from './timeout';
import { validateUrl } from './validators';
import { BrandSettings } from './types';

const MAX_CONTENT_LENGTH = 50000; // Limit to ~50k characters to avoid token limits
const FETCH_TIMEOUT = 10000; // 10 seconds timeout
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Fetch content from an ICP document URL with retry logic and timeout handling.
 * 
 * Automatically retries on transient failures (network errors, timeouts, 5xx errors)
 * and handles various content types (JSON, text, HTML). PDFs are not supported.
 * 
 * @param url - The URL to fetch the ICP document from
 * @returns The fetched content, or null if fetch fails after retries
 * @throws {Error} If URL is invalid
 * 
 * @example
 * ```typescript
 * const content = await fetchICPContent('https://example.com/icp.json');
 * if (content) {
 *   console.log('ICP content:', content);
 * }
 * ```
 */
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
          'Accept': 'text/html,text/plain,application/json,application/pdf',
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

      // Truncate if too long
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

/**
 * Process response content based on content type.
 * 
 * @param response - Fetch response object
 * @param contentType - Content type header value
 * @param url - URL for logging
 * @returns Processed content string or null if unsupported
 */
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

  // Try to get as text for other types
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

/**
 * Build brand context string from settings.
 * 
 * Extracts brand-related fields from user settings and formats them into
 * a readable context string for use in AI prompts.
 * 
 * @param settings - User settings object with brand information
 * @returns Formatted brand context string, or empty string if no brand info
 * 
 * @example
 * ```typescript
 * const context = buildBrandContext({
 *   organization_name: 'Acme Corp',
 *   industry: 'Technology',
 *   brand_description: 'Innovative solutions'
 * });
 * // Returns: "Organization: Acme Corp\nIndustry: Technology\nBrand Description: Innovative solutions"
 * ```
 */
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

