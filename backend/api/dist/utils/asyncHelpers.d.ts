/**
 * Async operation helpers for common async patterns.
 * Provides utilities for parallel execution, sequential processing, and batching.
 */
/**
 * Executes multiple async operations in parallel and returns all results.
 *
 * @param operations - Array of async functions to execute
 * @param options - Execution options
 * @returns Array of results in the same order as input
 * @throws Error if any operation fails (unless continueOnError is true)
 *
 * @example
 * ```typescript
 * const results = await parallel([
 *   () => fetchUserData(userId1),
 *   () => fetchUserData(userId2),
 *   () => fetchUserData(userId3),
 * ]);
 * ```
 */
export declare function parallel<T>(operations: Array<() => Promise<T>>, options?: {
    continueOnError?: boolean;
    maxConcurrency?: number;
}): Promise<T[]>;
/**
 * Executes async operations sequentially (one after another).
 *
 * @param operations - Array of async functions to execute
 * @returns Array of results in execution order
 * @throws Error if any operation fails
 *
 * @example
 * ```typescript
 * const results = await sequential([
 *   () => step1(),
 *   () => step2(),
 *   () => step3(),
 * ]);
 * ```
 */
export declare function sequential<T>(operations: Array<() => Promise<T>>): Promise<T[]>;
/**
 * Processes items in batches with optional concurrency control.
 *
 * @param items - Array of items to process
 * @param processor - Function to process each item
 * @param options - Batch processing options
 * @returns Array of results in the same order as input
 *
 * @example
 * ```typescript
 * const results = await batch(
 *   userIds,
 *   async (userId) => await fetchUserData(userId),
 *   { batchSize: 10, maxConcurrency: 5 }
 * );
 * ```
 */
export declare function batch<T, R>(items: T[], processor: (item: T, index: number) => Promise<R>, options?: {
    batchSize?: number;
    maxConcurrency?: number;
    continueOnError?: boolean;
}): Promise<R[]>;
/**
 * Maps an array through an async function with optional concurrency control.
 *
 * @param items - Array of items to map
 * @param mapper - Async function to map each item
 * @param options - Mapping options
 * @returns Array of mapped results
 *
 * @example
 * ```typescript
 * const results = await asyncMap(
 *   urls,
 *   async (url) => await fetch(url).then(r => r.json()),
 *   { maxConcurrency: 5 }
 * );
 * ```
 */
export declare function asyncMap<T, R>(items: T[], mapper: (item: T, index: number) => Promise<R>, options?: {
    maxConcurrency?: number;
    continueOnError?: boolean;
}): Promise<R[]>;
/**
 * Filters an array using an async predicate function.
 *
 * @param items - Array of items to filter
 * @param predicate - Async function that returns true to keep item
 * @param options - Filtering options
 * @returns Array of items that passed the predicate
 *
 * @example
 * ```typescript
 * const validUsers = await asyncFilter(
 *   users,
 *   async (user) => await validateUser(user)
 * );
 * ```
 */
export declare function asyncFilter<T>(items: T[], predicate: (item: T, index: number) => Promise<boolean>, options?: {
    maxConcurrency?: number;
}): Promise<T[]>;
/**
 * Reduces an array using an async reducer function.
 *
 * @param items - Array of items to reduce
 * @param reducer - Async reducer function
 * @param initialValue - Initial accumulator value
 * @returns Final accumulator value
 *
 * @example
 * ```typescript
 * const total = await asyncReduce(
 *   numbers,
 *   async (acc, num) => acc + await processNumber(num),
 *   0
 * );
 * ```
 */
export declare function asyncReduce<T, R>(items: T[], reducer: (accumulator: R, item: T, index: number) => Promise<R>, initialValue: R): Promise<R>;
//# sourceMappingURL=asyncHelpers.d.ts.map