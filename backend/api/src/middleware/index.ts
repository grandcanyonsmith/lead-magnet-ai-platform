import { Middleware } from "../types/api";
import { RouteResponse } from "../routes";
import { logger } from "../utils/logger";
import { ApiError } from "../utils/errors";

/**
 * Middleware system for request processing.
 * Provides authentication, validation, logging, and error handling.
 */

/**
 * Request logging middleware.
 * Logs incoming requests for debugging and monitoring.
 */
export const loggingMiddleware: Middleware = async (
  event,
  tenantId,
  next,
): Promise<RouteResponse | void> => {
  const startTime = Date.now();
  const method = event.requestContext.http.method;
  const path = event.rawPath;

  logger.info("[Middleware] Request started", {
    method,
    path,
    tenantId,
    requestId: event.requestContext.requestId,
  });

  if (next) {
    try {
      const response = await next();
      const duration = Date.now() - startTime;
      logger.info("[Middleware] Request completed", {
        method,
        path,
        tenantId,
        statusCode: response.statusCode,
        duration: `${duration}ms`,
      });
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("[Middleware] Request failed", {
        method,
        path,
        tenantId,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
};

/**
 * Authentication middleware.
 * Validates that tenantId is present for protected routes.
 */
export const authMiddleware: Middleware = async (
  _event,
  tenantId,
  next,
): Promise<RouteResponse | void> => {
  if (!tenantId) {
    throw new ApiError("Please sign in to access this page", 401);
  }

  if (next) {
    return await next();
  }
};

/**
 * Error handling middleware.
 * Catches and formats errors consistently.
 */
export const errorMiddleware: Middleware = async (
  event,
  tenantId,
  next,
): Promise<RouteResponse | void> => {
  if (!next) {
    return;
  }

  try {
    return await next();
  } catch (error) {
    // Re-throw ApiError as-is (already formatted)
    if (error instanceof ApiError) {
      throw error;
    }

    // Format unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("[Middleware] Unexpected error", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      path: event.rawPath,
      tenantId,
    });

    throw new ApiError("Internal server error", 500);
  }
};

/**
 * Body parsing middleware.
 * Ensures request body is parsed if present.
 */
export const bodyParsingMiddleware: Middleware = async (
  _event,
  _tenantId,
  next,
): Promise<RouteResponse | void> => {
  // Body is already parsed in routes/index.ts, but this middleware
  // can be used for additional validation or transformation
  if (next) {
    return await next();
  }
};

/**
 * Compose multiple middleware functions.
 */
export function composeMiddleware(...middlewares: Middleware[]): Middleware {
  return async (event, tenantId, next) => {
    let index = 0;

    const runNext = async (): Promise<RouteResponse> => {
      if (index < middlewares.length) {
        const middleware = middlewares[index++];
        const result = await middleware(event, tenantId, runNext);
        if (result) {
          return result;
        }
      }

      // If no middleware handled it and we have a next handler, call it
      if (next) {
        return await next();
      }

      throw new ApiError("No handler found", 500);
    };

    return await runNext();
  };
}
