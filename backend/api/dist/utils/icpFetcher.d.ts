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
import { BrandSettings } from './types';
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
export declare function fetchICPContent(url: string): Promise<string | null>;
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
export declare function buildBrandContext(settings: BrandSettings | Record<string, unknown>): string;
//# sourceMappingURL=icpFetcher.d.ts.map