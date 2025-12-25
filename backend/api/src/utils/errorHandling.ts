/**
 * Error handling utilities and patterns.
 * Provides consistent error handling, retry logic, and error context management.
 */

import { logger } from "./logger";
import { ApiError } from "./errors";

/**
 * Error context information to attach to errors.
 */
export interface ErrorContext {
  [key: string]: unknown;
}

/**
 * Adds context information to an error.
 *
 * @param error - Original error
 * @param context - Additional context to add
 * @returns Error with context added to message or as details
 */
export function addErrorContext(error: Error, context: ErrorContext): Error {
  if (error instanceof ApiError) {
    // Add context to ApiError details
    return new ApiError(error.message, error.statusCode, error.code, {
      ...error.details,
      ...context,
    });
  }

  // For regular errors, add context to message
  const contextStr = Object.entries(context)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(", ");

  const enhancedError = new Error(`${error.message} [Context: ${contextStr}]`);
  enhancedError.stack = error.stack;
  enhancedError.name = error.name;

  return enhancedError;
}

/**
 * Wraps an async function to catch and log errors safely.
 * Returns a result object instead of throwing.
 *
 * @param fn - Async function to execute
 * @param errorMessage - Custom error message prefix
 * @returns Result object with success flag and data/error
 *
 * @example
 * ```typescript
 * const result = await safeAsync(
 *   () => someAsyncOperation(),
 *   'Failed to process data'
 * );
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  errorMessage?: string,
): Promise<{ success: true; data: T } | { success: false; error: Error }> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const message = errorMessage
      ? `${errorMessage}: ${err.message}`
      : err.message;

    logger.error("[SafeAsync] Error caught", {
      error: err.message,
      stack: err.stack,
      customMessage: errorMessage,
    });

    return {
      success: false,
      error: new Error(message),
    };
  }
}

/**
 * Executes a function and returns the result or null on error.
 * Errors are logged but not thrown.
 *
 * @param fn - Function to execute
 * @param logError - Whether to log errors (default: true)
 * @returns Function result or null on error
 *
 * @example
 * ```typescript
 * const result = await safeReturn(() => riskyOperation());
 * if (result !== null) {
 *   // Use result
 * }
 * ```
 */
export async function safeReturn<T>(
  fn: () => Promise<T>,
  logError: boolean = true,
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    if (logError) {
      logger.error("[SafeReturn] Error caught and returning null", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
    return null;
  }
}

/**
 * Retry configuration options.
 */
export interface RetryConfig {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown) => void;
}

/**
 * Default retry configuration.
 */
const DEFAULT_RETRY_CONFIG: Required<
  Omit<RetryConfig, "retryableErrors" | "onRetry">
> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Determines if an error is retryable by default.
 * Network errors, timeouts, and 5xx errors are considered retryable.
 *
 * @param error - Error to check
 * @returns True if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof ApiError) {
    // Retry on 5xx errors, rate limits, and service unavailable
    return (
      error.statusCode >= 500 ||
      error.statusCode === 429 ||
      error.statusCode === 503
    );
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Retry on network errors, timeouts, and connection issues
    return (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("connection") ||
      message.includes("econnreset") ||
      message.includes("enotfound")
    );
  }

  return false;
}

/**
 * Calculates delay for retry attempt using exponential backoff.
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
function calculateRetryDelay(attempt: number, config: RetryConfig): number {
  const initialDelay =
    config.initialDelayMs ?? DEFAULT_RETRY_CONFIG.initialDelayMs;
  const maxDelay = config.maxDelayMs ?? DEFAULT_RETRY_CONFIG.maxDelayMs;
  const multiplier =
    config.backoffMultiplier ?? DEFAULT_RETRY_CONFIG.backoffMultiplier;

  const delay = initialDelay * Math.pow(multiplier, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * Retries an async operation with exponential backoff.
 *
 * @param fn - Async function to retry
 * @param config - Retry configuration
 * @returns Result of the function
 * @throws Last error if all retries fail
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   () => fetchData(),
 *   {
 *     maxAttempts: 3,
 *     initialDelayMs: 1000,
 *     onRetry: (attempt, error) => {
 *       console.log(`Retry attempt ${attempt}:`, error);
 *     }
 *   }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {},
): Promise<T> {
  const maxAttempts = config.maxAttempts ?? DEFAULT_RETRY_CONFIG.maxAttempts;
  const retryableErrors = config.retryableErrors ?? isRetryableError;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (!retryableErrors(error)) {
        logger.debug("[Retry] Error is not retryable, stopping", {
          attempt: attempt + 1,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }

      // If this is the last attempt, throw the error
      if (attempt === maxAttempts - 1) {
        logger.warn("[Retry] Max attempts reached, throwing error", {
          maxAttempts,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }

      // Calculate delay and wait before retry
      const delay = calculateRetryDelay(attempt, config);

      logger.debug("[Retry] Retrying after delay", {
        attempt: attempt + 1,
        maxAttempts,
        delayMs: delay,
        error: error instanceof Error ? error.message : String(error),
      });

      // Call onRetry callback if provided
      if (config.onRetry) {
        config.onRetry(attempt + 1, error);
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Wraps a promise with a timeout.
 *
 * @param promise - Promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Custom error message (optional)
 * @returns Promise that rejects on timeout
 * @throws Error if timeout is exceeded
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   fetchData(),
 *   5000,
 *   'Data fetch timed out'
 * );
 * ```
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string,
): Promise<T> {
  if (timeoutMs <= 0) {
    throw new Error("Timeout must be greater than 0");
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`),
      );
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Executes multiple promises and returns the first one that resolves or rejects.
 *
 * @param promises - Array of promises to race
 * @param timeoutMs - Optional timeout for the race
 * @returns First promise result
 * @throws Error if timeout is exceeded (if provided)
 */
export async function raceWithTimeout<T>(
  promises: Promise<T>[],
  timeoutMs?: number,
): Promise<T> {
  if (promises.length === 0) {
    throw new Error("At least one promise is required");
  }

  if (timeoutMs !== undefined && timeoutMs > 0) {
    return withTimeout(Promise.race(promises), timeoutMs);
  }

  return Promise.race(promises);
}

/**
 * Wraps an async function to handle errors gracefully.
 * Catches errors, logs them, and returns a default value or re-throws.
 *
 * @param fn - Async function to wrap
 * @param defaultValue - Default value to return on error
 * @param logError - Whether to log errors (default: true)
 * @returns Function result or default value on error
 *
 * @example
 * ```typescript
 * const value = await withErrorHandling(
 *   () => riskyOperation(),
 *   'default value'
 * );
 * ```
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  defaultValue: T,
  logError: boolean = true,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (logError) {
      logger.error("[ErrorHandling] Error caught, returning default", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        defaultValue: String(defaultValue),
      });
    }
    return defaultValue;
  }
}
