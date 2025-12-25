/**
 * Retry utilities for handling transient failures.
 * Re-exports retry functionality from errorHandling for convenience.
 */

import {
  retryWithBackoff as retryWithBackoffImpl,
  type RetryConfig,
} from "./errorHandling";

export { retryWithBackoffImpl as retryWithBackoff, type RetryConfig };

/**
 * Retries an operation with a simple fixed delay between attempts.
 *
 * @param fn - Async function to retry
 * @param options - Retry options
 * @returns Result of the function
 * @throws Last error if all retries fail
 *
 * @example
 * ```typescript
 * const result = await retryWithFixedDelay(
 *   () => fetchData(),
 *   { maxAttempts: 3, delayMs: 1000 }
 * );
 * ```
 */
export async function retryWithFixedDelay<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delayMs?: number;
    retryableErrors?: (error: unknown) => boolean;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const delayMs = options.delayMs ?? 1000;
  const retryableErrors = options.retryableErrors ?? (() => true);
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!retryableErrors(error)) {
        throw error;
      }

      if (attempt === maxAttempts - 1) {
        throw error;
      }

      if (options.onRetry) {
        options.onRetry(attempt + 1, error);
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Retries an operation only if a condition is met.
 *
 * @param fn - Async function to retry
 * @param condition - Function that determines if error should be retried
 * @param options - Retry options
 * @returns Result of the function
 * @throws Last error if all retries fail or condition is not met
 *
 * @example
 * ```typescript
 * const result = await retryOnCondition(
 *   () => apiCall(),
 *   (error) => error.statusCode === 429, // Only retry on rate limit
 *   { maxAttempts: 5 }
 * );
 * ```
 */
export async function retryOnCondition<T>(
  fn: () => Promise<T>,
  condition: (error: unknown) => boolean,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {},
): Promise<T> {
  return retryWithBackoffImpl(fn, {
    ...options,
    retryableErrors: condition,
  });
}
