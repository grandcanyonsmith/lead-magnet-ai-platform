/**
 * OpenAI helper utilities.
 *
 * Provides utilities for OpenAI API calls with timeout and error handling.
 *
 * @module openaiHelpers
 * @deprecated Consider using timeout utilities from './timeout' for new code
 */

import { withTimeout } from "./timeout";
import { logger } from "./logger";

/**
 * Default timeout for OpenAI responses (no timeout by default).
 * Set to 0 to disable timeout entirely.
 */
export const RESPONSES_TIMEOUT_MS = 0;

/**
 * Call an async function with optional timeout.
 *
 * Wraps a promise factory function with timeout handling. If timeout is not provided
 * or is 0, executes without timeout. Otherwise, applies the specified timeout.
 *
 * @param promiseFactory - Function that returns a promise to execute
 * @param contextLabel - Context label for logging (optional, for compatibility)
 * @param timeoutMs - Timeout in milliseconds (optional, defaults to 0 - no timeout)
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
  timeoutMs?: number,
): Promise<T> {
  const timeout = timeoutMs !== undefined && timeoutMs > 0 ? timeoutMs : 0;

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
        : `Operation timed out after ${timeout}ms`,
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

/**
 * Remove markdown code fences (``` / ```html / ```css) from model output.
 *
 * OpenAI sometimes wraps raw HTML/CSS in code blocks; this normalizes it to plain text.
 */
export function stripMarkdownCodeFences(content: string): string {
  let cleaned = content.trim();

  if (!cleaned.startsWith("```")) {
    return cleaned;
  }

  // Remove opening fence line (``` or ```lang)
  cleaned = cleaned.replace(/^```[a-z0-9_-]*\s*/i, "");
  // Remove closing fence
  cleaned = cleaned.replace(/\s*```$/i, "");

  return cleaned.trim();
}
