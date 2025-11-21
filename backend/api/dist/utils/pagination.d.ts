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
export declare function parsePaginationParams(queryParams: Record<string, unknown>, maxLimit?: number): PaginationParams;
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
export declare function createPaginatedResponse<T>(items: T[], limit: number, offset: number, totalCount?: number): PaginatedResult<T>;
/**
 * Query with pagination support.
 * Fetches items with limit and offset, handling pagination automatically.
 */
export declare function queryWithPagination<T>(tableName: string, indexName: string | undefined, keyCondition: string, expressionAttributeValues: Record<string, any>, expressionAttributeNames?: Record<string, string>, paginationParams?: PaginationParams): Promise<PaginatedResult<T>>;
/**
 * Filter and paginate an array of items.
 */
export declare function paginateArray<T>(items: T[], paginationParams?: PaginationParams): PaginatedResult<T>;
//# sourceMappingURL=pagination.d.ts.map