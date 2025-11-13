import { db } from './db';

/**
 * Pagination utilities for database queries.
 * Provides helpers for consistent pagination across controllers.
 */

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  items: T[];
  count: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Parse pagination parameters from query string.
 */
export function parsePaginationParams(queryParams: Record<string, any>): PaginationParams {
  const limit = queryParams.limit ? Math.min(parseInt(queryParams.limit, 10), 100) : 20;
  const offset = queryParams.offset ? Math.max(parseInt(queryParams.offset, 10), 0) : 0;

  return { limit, offset };
}

/**
 * Create a paginated response.
 */
export function createPaginatedResponse<T>(
  items: T[],
  limit: number,
  offset: number,
  totalCount?: number
): PaginatedResult<T> {
  const count = totalCount !== undefined ? totalCount : items.length;
  const hasMore = totalCount !== undefined ? offset + items.length < totalCount : items.length === limit;

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

