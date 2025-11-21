/**
 * Standardized response helpers
 */
import { RouteResponse } from '../routes';
/**
 * Create a success response
 */
export declare function success<T>(data: T, statusCode?: number): RouteResponse;
/**
 * Create a created response (201)
 */
export declare function created<T>(data: T): RouteResponse;
/**
 * Create a no content response (204)
 */
export declare function noContent(): RouteResponse;
/**
 * Create a paginated list response
 */
export declare function paginatedList<T>(items: T[], options?: {
    total?: number;
    offset?: number;
    limit?: number;
    hasMore?: boolean;
    resourceName?: string;
}): RouteResponse;
/**
 * Create a list response
 */
export declare function listResponse<T>(items: T[], resourceName?: string): RouteResponse;
/**
 * Add headers to a response
 */
export declare function withHeaders<T extends RouteResponse>(response: T, headers: Record<string, string>): T;
/**
 * Set content type on response
 */
export declare function withContentType<T extends RouteResponse>(response: T, contentType: string): T;
//# sourceMappingURL=response.d.ts.map