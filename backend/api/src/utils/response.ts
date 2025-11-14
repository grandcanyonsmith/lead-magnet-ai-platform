/**
 * Standardized response helpers
 */

import { RouteResponse } from '../routes';

/**
 * Create a success response
 */
export function success<T>(data: T, statusCode: number = 200): RouteResponse {
  return {
    statusCode,
    body: data,
  };
}

/**
 * Create a created response (201)
 */
export function created<T>(data: T): RouteResponse {
  return success(data, 201);
}

/**
 * Create a no content response (204)
 */
export function noContent(): RouteResponse {
  return {
    statusCode: 204,
    body: {},
  };
}

/**
 * Create a paginated list response
 */
export function paginatedList<T>(
  items: T[],
  options: {
    total?: number;
    offset?: number;
    limit?: number;
    hasMore?: boolean;
    resourceName?: string;
  } = {}
): RouteResponse {
  const { total, offset, limit, hasMore, resourceName = 'items' } = options;
  
  const response: any = {
    [resourceName]: items,
    count: items.length,
  };

  if (total !== undefined) {
    response.total = total;
  }
  if (offset !== undefined) {
    response.offset = offset;
  }
  if (limit !== undefined) {
    response.limit = limit;
  }
  if (hasMore !== undefined) {
    response.has_more = hasMore;
  }

  return {
    statusCode: 200,
    body: response,
  };
}

/**
 * Create a list response
 */
export function listResponse<T>(
  items: T[],
  resourceName: string = 'items'
): RouteResponse {
  return {
    statusCode: 200,
    body: {
      [resourceName]: items,
      count: items.length,
    },
  };
}

/**
 * Add headers to a response
 */
export function withHeaders<T extends RouteResponse>(
  response: T,
  headers: Record<string, string>
): T {
  return {
    ...response,
    headers: {
      ...response.headers,
      ...headers,
    },
  };
}

/**
 * Set content type on response
 */
export function withContentType<T extends RouteResponse>(
  response: T,
  contentType: string
): T {
  return withHeaders(response, { 'Content-Type': contentType });
}

