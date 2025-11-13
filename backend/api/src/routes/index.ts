import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { RouteResponse } from '../routes';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';
import { routeRegistry } from './routeRegistry';
import { registerPublicRoutes } from './publicRoutes';
import { registerWorkflowRoutes } from './workflowRoutes';
import { registerFormRoutes } from './formRoutes';
import { registerTemplateRoutes } from './templateRoutes';
import { registerJobRoutes } from './jobRoutes';
import { registerAdminRoutes } from './adminRoutes';

// Register all routes on module load
registerPublicRoutes();
registerWorkflowRoutes();
registerFormRoutes();
registerTemplateRoutes();
registerJobRoutes();
registerAdminRoutes();

/**
 * Main router function that replaces the large if/else chain.
 * Uses the route registry to match requests to handlers.
 */
export const router = async (
  event: APIGatewayProxyEventV2,
  tenantId?: string
): Promise<RouteResponse> => {
  const method = event.requestContext.http.method;
  const path = event.rawPath;

  // Debug logging for route matching
  logger.info('[Router] Request received', {
    method,
    path,
    rawPath: event.rawPath,
    pathParameters: event.pathParameters,
    tenantId,
  });

  // Try to match a route
  const match = routeRegistry.match(event);

  if (!match) {
    throw new ApiError("This page doesn't exist", 404);
  }

  const { route, params } = match;

  // Check authentication requirement
  if (route.requiresAuth && !tenantId) {
    throw new ApiError('Please sign in to access this page', 401);
  }

  // Merge path parameters into event for handler access
  const eventWithParams = {
    ...event,
    pathParameters: {
      ...event.pathParameters,
      ...params,
    },
  };

  // Execute middleware if present
  if (route.middleware && route.middleware.length > 0) {
    let middlewareIndex = 0;
    const next = async (): Promise<RouteResponse> => {
      if (middlewareIndex < (route.middleware?.length || 0)) {
        const middleware = route.middleware![middlewareIndex++];
        const result = await middleware(eventWithParams, tenantId, next);
        if (result) {
          return result;
        }
      }
      // If no middleware handled it, call the handler
      return await route.handler(eventWithParams, tenantId);
    };
    return await next();
  }

  // Execute the route handler
  return await route.handler(eventWithParams, tenantId);
};

