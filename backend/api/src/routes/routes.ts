/**
 * Route response interface.
 * Standard response format for route handlers.
 */
export interface RouteResponse {
  statusCode: number;
  body: any;
  headers?: Record<string, string>;
}
