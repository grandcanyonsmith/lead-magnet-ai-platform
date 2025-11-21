/**
 * Timeout utilities for async operations.
 * Re-exports timeout functionality from errorHandling and adds additional helpers.
 */
import { withTimeout as withTimeoutImpl, raceWithTimeout } from './errorHandling';
export { withTimeoutImpl as withTimeout, raceWithTimeout, };
/**
 * Creates a promise that resolves after a specified delay.
 *
 * @param ms - Delay in milliseconds
 * @returns Promise that resolves after delay
 *
 * @example
 * ```typescript
 * await delay(1000); // Wait 1 second
 * ```
 */
export declare function delay(ms: number): Promise<void>;
/**
 * Creates a promise that rejects after a specified timeout.
 *
 * @param ms - Timeout in milliseconds
 * @param message - Error message (optional)
 * @returns Promise that rejects after timeout
 *
 * @example
 * ```typescript
 * await timeout(5000, 'Operation timed out');
 * ```
 */
export declare function timeout(ms: number, message?: string): Promise<never>;
/**
 * Wraps a function to add timeout behavior.
 *
 * @param fn - Async function to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Custom error message (optional)
 * @returns Wrapped function with timeout
 *
 * @example
 * ```typescript
 * const fetchWithTimeout = withTimeoutWrapper(
 *   fetchData,
 *   5000,
 *   'Data fetch timed out'
 * );
 * const result = await fetchWithTimeout();
 * ```
 */
export declare function withTimeoutWrapper<T extends (...args: any[]) => Promise<any>>(fn: T, timeoutMs: number, errorMessage?: string): T;
//# sourceMappingURL=timeout.d.ts.map