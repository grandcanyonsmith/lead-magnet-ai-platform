import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { RouteResponse } from '../routes';

/**
 * Route handler function type.
 */
export type RouteHandler = (
  event: APIGatewayProxyEventV2,
  tenantId?: string
) => Promise<RouteResponse>;

/**
 * Middleware function type.
 */
export type Middleware = (
  event: APIGatewayProxyEventV2,
  tenantId?: string,
  next?: () => Promise<RouteResponse>
) => Promise<RouteResponse> | RouteResponse | void;

/**
 * Route definition interface.
 */
export interface RouteDefinition {
  method: string;
  path: string;
  handler: RouteHandler;
  middleware?: Middleware[];
  requiresAuth?: boolean;
  priority?: number; // Lower numbers = higher priority
}

/**
 * Path parameter extraction result.
 */
export interface PathParams {
  [key: string]: string;
}

/**
 * Route match result.
 */
export interface RouteMatch {
  route: RouteDefinition;
  params: PathParams;
}

