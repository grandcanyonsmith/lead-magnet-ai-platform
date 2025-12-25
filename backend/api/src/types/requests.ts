/**
 * Common request/response type definitions
 */

import { APIGatewayProxyEventV2 } from "aws-lambda";
import { RouteResponse } from "../routes";
import { AuthContext } from "../utils/authContext";

/**
 * Standard request handler signature
 */
export type RequestHandler = (
  params: Record<string, string>,
  body: any,
  query: Record<string, string | undefined>,
  tenantId?: string,
  context?: RequestContext,
) => Promise<RouteResponse>;

/**
 * Request context with commonly needed values
 */
export interface RequestContext {
  sourceIp: string;
  event: APIGatewayProxyEventV2;
  auth?: AuthContext;
  requestId?: string;
}

/**
 * Pagination query parameters
 */
export interface PaginationQuery {
  limit?: number;
  offset?: number;
}

/**
 * Standard paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  count: number;
  total?: number;
  offset?: number;
  limit?: number;
  has_more?: boolean;
}

/**
 * Standard list response
 */
export interface ListResponse<T> {
  items: T[];
  count: number;
}

/**
 * Standard create response
 */
export interface CreateResponse<T> {
  [key: string]: T;
}

/**
 * Standard update response
 */
export interface UpdateResponse<T> {
  [key: string]: T;
}

/**
 * Standard delete response (no content)
 */
export type DeleteResponse = void;

/**
 * Error response structure
 */
export interface ErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, any>;
  requestId?: string;
}
