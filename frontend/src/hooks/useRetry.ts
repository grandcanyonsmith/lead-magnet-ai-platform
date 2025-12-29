/**
 * Hook for retrying failed operations with exponential backoff
 */

import { useCallback, useState } from "react";

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryable?: (error: unknown) => boolean;
}

interface RetryState {
  retryCount: number;
  isRetrying: boolean;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "retryable">> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

/**
 * Calculate delay for exponential backoff
 */
function calculateDelay(
  retryCount: number,
  initialDelay: number,
  maxDelay: number,
  backoffMultiplier: number
): number {
  const delay = initialDelay * Math.pow(backoffMultiplier, retryCount);
  return Math.min(delay, maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Hook for retrying async operations with exponential backoff
 */
export function useRetry<T>(
  options: RetryOptions = {}
): [
  (fn: () => Promise<T>) => Promise<T>,
  RetryState
] {
  const {
    maxRetries = DEFAULT_OPTIONS.maxRetries,
    initialDelay = DEFAULT_OPTIONS.initialDelay,
    maxDelay = DEFAULT_OPTIONS.maxDelay,
    backoffMultiplier = DEFAULT_OPTIONS.backoffMultiplier,
    retryable,
  } = options;

  const [state, setState] = useState<RetryState>({
    retryCount: 0,
    isRetrying: false,
  });

  const executeWithRetry = useCallback(
    async (fn: () => Promise<T>): Promise<T> => {
      let lastError: unknown;
      let currentRetry = 0;

      while (currentRetry <= maxRetries) {
        try {
          if (currentRetry > 0) {
            setState({ retryCount: currentRetry, isRetrying: true });
            const delay = calculateDelay(
              currentRetry - 1,
              initialDelay,
              maxDelay,
              backoffMultiplier
            );
            await sleep(delay);
          }

          const result = await fn();
          setState({ retryCount: 0, isRetrying: false });
          return result;
        } catch (error) {
          lastError = error;

          // Check if error is retryable
          if (retryable && !retryable(error)) {
            throw error;
          }

          // Don't retry on last attempt
          if (currentRetry >= maxRetries) {
            setState({ retryCount: 0, isRetrying: false });
            throw error;
          }

          currentRetry++;
        }
      }

      setState({ retryCount: 0, isRetrying: false });
      throw lastError;
    },
    [maxRetries, initialDelay, maxDelay, backoffMultiplier, retryable]
  );

  return [executeWithRetry, state];
}

/**
 * Default retryable check for network errors
 */
export function isRetryableError(error: unknown): boolean {
  if (error && typeof error === "object") {
    // Check for network errors
    if ("code" in error) {
      const code = (error as { code?: string }).code;
      if (code === "ECONNABORTED" || code === "ETIMEDOUT" || code === "ENOTFOUND") {
        return true;
      }
    }

    // Check for HTTP status codes that are retryable
    if ("statusCode" in error || "status" in error) {
      const status =
        (error as { statusCode?: number }).statusCode ||
        (error as { status?: number }).status;
      // Retry on 5xx errors and 429 (rate limit)
      if (status && (status >= 500 || status === 429)) {
        return true;
      }
      // Don't retry on 4xx errors (except 429)
      if (status && status >= 400 && status < 500) {
        return false;
      }
    }
  }

  // Default to retryable for unknown errors
  return true;
}

