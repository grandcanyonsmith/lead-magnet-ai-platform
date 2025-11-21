"use strict";
/**
 * Async operation helpers for common async patterns.
 * Provides utilities for parallel execution, sequential processing, and batching.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parallel = parallel;
exports.sequential = sequential;
exports.batch = batch;
exports.asyncMap = asyncMap;
exports.asyncFilter = asyncFilter;
exports.asyncReduce = asyncReduce;
const logger_1 = require("./logger");
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
async function parallel(operations, options = {}) {
    const { continueOnError = false, maxConcurrency } = options;
    if (operations.length === 0) {
        return [];
    }
    // If no concurrency limit, execute all in parallel
    if (maxConcurrency === undefined || maxConcurrency >= operations.length) {
        const promises = operations.map(op => op());
        if (continueOnError) {
            const results = await Promise.allSettled(promises);
            return results.map((result, index) => {
                if (result.status === 'fulfilled') {
                    return result.value;
                }
                else {
                    logger_1.logger.error('[Parallel] Operation failed', {
                        index,
                        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
                    });
                    throw result.reason;
                }
            });
        }
        return Promise.all(promises);
    }
    // Execute with concurrency limit
    const results = [];
    const executing = [];
    for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        const promise = (async () => {
            try {
                const result = await operation();
                results[i] = result;
            }
            catch (error) {
                if (!continueOnError) {
                    throw error;
                }
                logger_1.logger.error('[Parallel] Operation failed', {
                    index: i,
                    error: error instanceof Error ? error.message : String(error),
                });
                throw error;
            }
        })();
        executing.push(promise);
        // If we've reached max concurrency, wait for one to complete
        if (executing.length >= maxConcurrency) {
            await Promise.race(executing);
            // Remove completed promises
            for (let j = executing.length - 1; j >= 0; j--) {
                if (executing[j] !== promise) {
                    try {
                        await executing[j];
                    }
                    catch {
                        // Already handled above
                    }
                    executing.splice(j, 1);
                    break;
                }
            }
        }
    }
    // Wait for all remaining operations
    await Promise.all(executing);
    return results;
}
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
async function sequential(operations) {
    const results = [];
    for (const operation of operations) {
        const result = await operation();
        results.push(result);
    }
    return results;
}
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
async function batch(items, processor, options = {}) {
    const { batchSize = items.length, maxConcurrency, continueOnError = false } = options;
    if (items.length === 0) {
        return [];
    }
    const results = [];
    const batches = [];
    // Split items into batches
    for (let i = 0; i < items.length; i += batchSize) {
        batches.push(items.slice(i, i + batchSize));
    }
    // Process batches
    for (const batchItems of batches) {
        const batchOperations = batchItems.map((item, index) => {
            const globalIndex = results.length + index;
            return () => processor(item, globalIndex);
        });
        const batchResults = await parallel(batchOperations, {
            continueOnError,
            maxConcurrency,
        });
        results.push(...batchResults);
    }
    return results;
}
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
async function asyncMap(items, mapper, options = {}) {
    const operations = items.map((item, index) => () => mapper(item, index));
    return parallel(operations, options);
}
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
async function asyncFilter(items, predicate, options = {}) {
    const operations = items.map((item, index) => async () => {
        const keep = await predicate(item, index);
        return { item, keep };
    });
    const results = await parallel(operations, options);
    return results.filter(result => result.keep).map(result => result.item);
}
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
async function asyncReduce(items, reducer, initialValue) {
    let accumulator = initialValue;
    for (let i = 0; i < items.length; i++) {
        accumulator = await reducer(accumulator, items[i], i);
    }
    return accumulator;
}
//# sourceMappingURL=asyncHelpers.js.map