/**
 * Utility functions for fetching ICP (Ideal Customer Profile) document content
 */

import { logger } from './logger';

const MAX_CONTENT_LENGTH = 50000; // Limit to ~50k characters to avoid token limits
const FETCH_TIMEOUT = 10000; // 10 seconds timeout

/**
 * Fetch content from an ICP document URL
 * @param url - The URL to fetch the ICP document from
 * @returns The fetched content, or null if fetch fails
 */
export async function fetchICPContent(url: string): Promise<string | null> {
  if (!url || !url.trim()) {
    return null;
  }

  try {
    logger.info('[ICP Fetcher] Fetching ICP document', { url });

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'LeadMagnet-AI/1.0',
          'Accept': 'text/html,text/plain,application/json,application/pdf',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn('[ICP Fetcher] Failed to fetch ICP document', {
          url,
          status: response.status,
          statusText: response.statusText,
        });
        return null;
      }

      const contentType = response.headers.get('content-type') || '';
      
      // Handle different content types
      let content: string;
      
      if (contentType.includes('application/json')) {
        const json = await response.json();
        content = JSON.stringify(json, null, 2);
      } else if (contentType.includes('text/')) {
        content = await response.text();
      } else if (contentType.includes('application/pdf')) {
        // For PDFs, we can't easily extract text without a library
        // For now, return null and log a warning
        logger.warn('[ICP Fetcher] PDF content type not supported', { url, contentType });
        return null;
      } else {
        // Try to get as text for other types
        content = await response.text();
      }

      // Truncate if too long
      if (content.length > MAX_CONTENT_LENGTH) {
        logger.warn('[ICP Fetcher] ICP content truncated', {
          url,
          originalLength: content.length,
          truncatedLength: MAX_CONTENT_LENGTH,
        });
        content = content.substring(0, MAX_CONTENT_LENGTH) + '\n\n[Content truncated...]';
      }

      logger.info('[ICP Fetcher] Successfully fetched ICP document', {
        url,
        contentLength: content.length,
        contentType,
      });

      return content;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        logger.warn('[ICP Fetcher] Fetch timeout', { url });
      } else {
        logger.warn('[ICP Fetcher] Fetch error', {
          url,
          error: fetchError.message,
        });
      }
      return null;
    }
  } catch (error: any) {
    logger.error('[ICP Fetcher] Unexpected error fetching ICP document', {
      url,
      error: error.message,
      stack: error.stack,
    });
    return null;
  }
}

/**
 * Build brand context string from settings
 * @param settings - User settings object
 * @returns Formatted brand context string
 */
export function buildBrandContext(settings: any): string {
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

