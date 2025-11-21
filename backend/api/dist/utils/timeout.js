"use strict";
/**
 * Timeout utilities for async operations.
 * Re-exports timeout functionality from errorHandling and adds additional helpers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.raceWithTimeout = exports.withTimeout = void 0;
exports.delay = delay;
exports.timeout = timeout;
exports.withTimeoutWrapper = withTimeoutWrapper;
const errorHandling_1 = require("./errorHandling");
Object.defineProperty(exports, "withTimeout", { enumerable: true, get: function () { return errorHandling_1.withTimeout; } });
Object.defineProperty(exports, "raceWithTimeout", { enumerable: true, get: function () { return errorHandling_1.raceWithTimeout; } });
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
function delay(ms) {
    if (ms < 0) {
        return Promise.resolve();
    }
    return new Promise(resolve => setTimeout(resolve, ms));
}
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
function timeout(ms, message) {
    return new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error(message || `Timeout after ${ms}ms`));
        }, ms);
    });
}
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
function withTimeoutWrapper(fn, timeoutMs, errorMessage) {
    return ((...args) => {
        return (0, errorHandling_1.withTimeout)(fn(...args), timeoutMs, errorMessage);
    });
}
//# sourceMappingURL=timeout.js.map