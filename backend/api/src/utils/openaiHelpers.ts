/**
 * OpenAI helper utilities.
 * 
 * Provides utilities for OpenAI API calls with timeout and error handling.
 * 
 * @module openaiHelpers
 * @deprecated Consider using timeout utilities from './timeout' for new code
 */

import { withTimeout } from './timeout';
import { logger } from './logger';

/**
 * Default timeout for OpenAI responses (30 seconds).
 */
export const RESPONSES_TIMEOUT_MS = 30000;

/**
 * Call an async function with optional timeout.
 * 
 * Wraps a promise factory function with timeout handling. If timeout is not provided
 * or is 0, executes without timeout. Otherwise, applies the specified timeout.
 * 
 * @param promiseFactory - Function that returns a promise to execute
 * @param contextLabel - Context label for logging (optional, for compatibility)
 * @param timeoutMs - Timeout in milliseconds (optional, defaults to RESPONSES_TIMEOUT_MS)
 * @returns Promise result
 * @throws Error if timeout is exceeded
 * 
 * @example
 * ```typescript
 * const result = await callResponsesWithTimeout(
 *   () => openai.chat.completions.create(...),
 *   'Chat completion',
 *   5000
 * );
 * ```
 */
export async function callResponsesWithTimeout<T>(
  promiseFactory: () => Promise<T>,
  contextLabel?: string,
  timeoutMs?: number
): Promise<T> {
  const timeout = timeoutMs !== undefined && timeoutMs > 0 ? timeoutMs : RESPONSES_TIMEOUT_MS;
  
  if (timeout <= 0) {
    // No timeout - just call the promise factory directly
    return await promiseFactory();
  }

  try {
    const promise = promiseFactory();
    return await withTimeout(
      promise,
      timeout,
      contextLabel 
        ? `${contextLabel} timed out after ${timeout}ms`
        : `Operation timed out after ${timeout}ms`
    );
  } catch (error) {
    if (contextLabel) {
      logger.error(`[OpenAI Helpers] Error in ${contextLabel}`, {
        error: error instanceof Error ? error.message : String(error),
        timeout,
      });
    }
    throw error;
  }
}


