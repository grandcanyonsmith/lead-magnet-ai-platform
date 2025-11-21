/**
 * Error handling utilities and patterns.
 * Provides consistent error handling, retry logic, and error context management.
 */
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
export declare function addErrorContext(error: Error, context: ErrorContext): Error;
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
export declare function safeAsync<T>(fn: () => Promise<T>, errorMessage?: string): Promise<{
    success: true;
    data: T;
} | {
    success: false;
    error: Error;
}>;
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
export declare function safeReturn<T>(fn: () => Promise<T>, logError?: boolean): Promise<T | null>;
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
export declare function retryWithBackoff<T>(fn: () => Promise<T>, config?: RetryConfig): Promise<T>;
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
export declare function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage?: string): Promise<T>;
/**
 * Executes multiple promises and returns the first one that resolves or rejects.
 *
 * @param promises - Array of promises to race
 * @param timeoutMs - Optional timeout for the race
 * @returns First promise result
 * @throws Error if timeout is exceeded (if provided)
 */
export declare function raceWithTimeout<T>(promises: Promise<T>[], timeoutMs?: number): Promise<T>;
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
export declare function withErrorHandling<T>(fn: () => Promise<T>, defaultValue: T, logError?: boolean): Promise<T>;
//# sourceMappingURL=errorHandling.d.ts.map