/**
 * Data transformation utilities for common data manipulation tasks.
 * Provides functions for normalizing, sanitizing, and merging data structures.
 */
/**
 * Normalizes object keys to a consistent format (e.g., camelCase, snake_case).
 *
 * @param obj - Object to normalize
 * @param format - Target key format ('camelCase' | 'snake_case' | 'kebab-case')
 * @returns Object with normalized keys
 *
 * @example
 * ```typescript
 * const normalized = normalizeKeys(
 *   { user_name: 'John', user_email: 'john@example.com' },
 *   'camelCase'
 * ); // { userName: 'John', userEmail: 'john@example.com' }
 * ```
 */
export declare function normalizeKeys<T extends Record<string, unknown>>(obj: T, format?: 'camelCase' | 'snake_case' | 'kebab-case'): Record<string, unknown>;
/**
 * Sanitizes input by removing potentially dangerous characters and trimming whitespace.
 *
 * @param input - Input to sanitize (string or object)
 * @param options - Sanitization options
 * @returns Sanitized input
 *
 * @example
 * ```typescript
 * const sanitized = sanitizeInput('<script>alert("xss")</script>');
 * // Returns: 'alert("xss")'
 * ```
 */
export declare function sanitizeInput(input: unknown, options?: {
    removeHtml?: boolean;
    trimWhitespace?: boolean;
    maxLength?: number;
}): unknown;
/**
 * Deep merges multiple objects, with later objects taking precedence.
 *
 * @param target - Target object to merge into
 * @param sources - Source objects to merge
 * @returns Merged object
 *
 * @example
 * ```typescript
 * const merged = deepMerge(
 *   { a: 1, b: { c: 2 } },
 *   { b: { d: 3 }, e: 4 }
 * );
 * // Returns: { a: 1, b: { c: 2, d: 3 }, e: 4 }
 * ```
 */
export declare function deepMerge<T extends Record<string, unknown>>(target: T, ...sources: Partial<T>[]): T;
/**
 * Picks specified keys from an object.
 *
 * @param obj - Object to pick from
 * @param keys - Keys to pick
 * @returns Object with only specified keys
 *
 * @example
 * ```typescript
 * const picked = pick({ a: 1, b: 2, c: 3 }, ['a', 'c']);
 * // Returns: { a: 1, c: 3 }
 * ```
 */
export declare function pick<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>;
/**
 * Omits specified keys from an object.
 *
 * @param obj - Object to omit from
 * @param keys - Keys to omit
 * @returns Object without specified keys
 *
 * @example
 * ```typescript
 * const omitted = omit({ a: 1, b: 2, c: 3 }, ['b']);
 * // Returns: { a: 1, c: 3 }
 * ```
 */
export declare function omit<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K>;
/**
 * Flattens a nested object into a single level with dot-notation keys.
 *
 * @param obj - Object to flatten
 * @param prefix - Key prefix (used for recursion)
 * @returns Flattened object
 *
 * @example
 * ```typescript
 * const flattened = flatten({ a: { b: { c: 1 } } });
 * // Returns: { 'a.b.c': 1 }
 * ```
 */
export declare function flatten(obj: Record<string, unknown>, prefix?: string): Record<string, unknown>;
/**
 * Unflattens a flat object with dot-notation keys into a nested structure.
 *
 * @param obj - Flat object to unflatten
 * @returns Nested object
 *
 * @example
 * ```typescript
 * const unflattened = unflatten({ 'a.b.c': 1 });
 * // Returns: { a: { b: { c: 1 } } }
 * ```
 */
export declare function unflatten(obj: Record<string, unknown>): Record<string, unknown>;
//# sourceMappingURL=transformers.d.ts.map