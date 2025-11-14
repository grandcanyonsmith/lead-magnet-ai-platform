import { db } from './db';

/**
 * Pagination utilities for database queries.
 * Provides helpers for consistent pagination across controllers.
 * 
 * @module pagination
 */

import { validatePaginationParams as validateParams } from './validators';
import { ValidationError } from './errors';

/**
 * Pagination parameters for queries.
 */
export interface PaginationParams {
  limit: number;
  offset: number;
}

/**
 * Paginated result structure.
 */
export interface PaginatedResult<T> {
  items: T[];
  count: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Parse pagination parameters from query string.
 * 
 * Validates and normalizes pagination parameters from query string.
 * Defaults: limit=20, offset=0, maxLimit=100
 * 
 * @param queryParams - Query parameters object
 * @param maxLimit - Maximum allowed limit (default: 100)
 * @returns Normalized pagination parameters
 * @throws {ValidationError} If parameters are invalid
 * 
 * @example
 * ```typescript
 * const params = parsePaginationParams({ limit: '50', offset: '10' });
 * // Returns: { limit: 50, offset: 10 }
 * ```
 */
export function parsePaginationParams(
  queryParams: Record<string, unknown>,
  maxLimit: number = 100
): PaginationParams {
  try {
    return validateParams(queryParams.limit, queryParams.offset, maxLimit);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('Invalid pagination parameters');
  }
}

/**
 * Create a paginated response.
 * 
 * Constructs a standardized paginated result object with metadata.
 * 
 * @param items - Array of items for current page
 * @param limit - Page size limit
 * @param offset - Offset from start
 * @param totalCount - Total number of items (optional, for accurate hasMore calculation)
 * @returns Paginated result object
 * 
 * @example
 * ```typescript
 * const result = createPaginatedResponse(items, 20, 0, 100);
 * // Returns: { items, count: 100, limit: 20, offset: 0, hasMore: true }
 * ```
 */
export function createPaginatedResponse<T>(
  items: T[],
  limit: number,
  offset: number,
  totalCount?: number
): PaginatedResult<T> {
  if (!Array.isArray(items)) {
    throw new ValidationError('items must be an array');
  }

  if (typeof limit !== 'number' || limit < 1) {
    throw new ValidationError('limit must be a positive number');
  }

  if (typeof offset !== 'number' || offset < 0) {
    throw new ValidationError('offset must be a non-negative number');
  }

  const count = totalCount !== undefined ? totalCount : items.length;
  const hasMore = totalCount !== undefined 
    ? offset + items.length < totalCount 
    : items.length === limit;

  return {
    items,
    count,
    limit,
    offset,
    hasMore,
  };
}

/**
 * Query with pagination support.
 * Fetches items with limit and offset, handling pagination automatically.
 */
export async function queryWithPagination<T>(
  tableName: string,
  indexName: string | undefined,
  keyCondition: string,
  expressionAttributeValues: Record<string, any>,
  expressionAttributeNames?: Record<string, string>,
  paginationParams?: PaginationParams
): Promise<PaginatedResult<T>> {
  const { limit = 20, offset = 0 } = paginationParams || {};

  // Fetch one extra item to determine if there are more
  const fetchLimit = limit + 1;
  const fetchOffset = offset;

  const result = await db.query(
    tableName,
    indexName,
    keyCondition,
    expressionAttributeValues,
    expressionAttributeNames,
    fetchLimit,
    fetchOffset > 0 ? { offset: fetchOffset } : undefined
  );

  const items = (result.items || []) as T[];
  const hasMore = items.length > limit;
  const paginatedItems = hasMore ? items.slice(0, limit) : items;

  return createPaginatedResponse(paginatedItems, limit, offset);
}

/**
 * Filter and paginate an array of items.
 */
export function paginateArray<T>(
  items: T[],
  paginationParams?: PaginationParams
): PaginatedResult<T> {
  const { limit = 20, offset = 0 } = paginationParams || {};

  const start = offset;
  const end = offset + limit;
  const paginatedItems = items.slice(start, end);

  return createPaginatedResponse(paginatedItems, limit, offset, items.length);
}

