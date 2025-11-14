/**
 * Data transformation utilities for common data manipulation tasks.
 * Provides functions for normalizing, sanitizing, and merging data structures.
 */

import { isObject, isArray } from './validators';

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
export function normalizeKeys<T extends Record<string, unknown>>(
  obj: T,
  format: 'camelCase' | 'snake_case' | 'kebab-case' = 'camelCase'
): Record<string, unknown> {
  if (!isObject(obj)) {
    return obj;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    let normalizedKey = key;

    switch (format) {
      case 'camelCase':
        normalizedKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
          .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        break;
      case 'snake_case':
        normalizedKey = key.replace(/([A-Z])/g, '_$1')
          .replace(/-/g, '_')
          .toLowerCase();
        break;
      case 'kebab-case':
        normalizedKey = key.replace(/([A-Z])/g, '-$1')
          .replace(/_/g, '-')
          .toLowerCase();
        break;
    }

    // Recursively normalize nested objects
    if (isObject(value)) {
      result[normalizedKey] = normalizeKeys(value as Record<string, unknown>, format);
    } else if (isArray(value)) {
      result[normalizedKey] = (value as unknown[]).map(item =>
        isObject(item) ? normalizeKeys(item as Record<string, unknown>, format) : item
      );
    } else {
      result[normalizedKey] = value;
    }
  }

  return result;
}

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
export function sanitizeInput(
  input: unknown,
  options: {
    removeHtml?: boolean;
    trimWhitespace?: boolean;
    maxLength?: number;
  } = {}
): unknown {
  const { removeHtml = true, trimWhitespace = true, maxLength } = options;

  if (typeof input === 'string') {
    let sanitized = input;

    if (trimWhitespace) {
      sanitized = sanitized.trim();
    }

    if (removeHtml) {
      // Remove HTML tags (basic sanitization)
      sanitized = sanitized.replace(/<[^>]*>/g, '');
      // Decode HTML entities
      sanitized = sanitized
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }

    if (maxLength !== undefined && sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
  }

  if (isObject(input)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      result[key] = sanitizeInput(value, options);
    }
    return result;
  }

  if (isArray(input)) {
    return input.map(item => sanitizeInput(item, options));
  }

  return input;
}

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
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: Partial<T>[]
): T {
  if (!sources.length) {
    return target;
  }

  const result = { ...target };

  for (const source of sources) {
    if (!isObject(source)) {
      continue;
    }

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = source[key];
        const targetValue = result[key];

        if (isObject(sourceValue) && isObject(targetValue)) {
          result[key] = deepMerge(
            targetValue as Record<string, unknown>,
            sourceValue as Record<string, unknown>
          ) as T[Extract<keyof T, string>];
        } else {
          result[key] = sourceValue as T[Extract<keyof T, string>];
        }
      }
    }
  }

  return result;
}

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
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;

  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }

  return result;
}

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
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };

  for (const key of keys) {
    delete result[key];
  }

  return result;
}

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
export function flatten(obj: Record<string, unknown>, prefix: string = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (isObject(value)) {
      Object.assign(result, flatten(value as Record<string, unknown>, newKey));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

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
export function unflatten(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const keys = key.split('.');
    let current = result;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || !isObject(current[k])) {
        current[k] = {};
      }
      current = current[k] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;
  }

  return result;
}

