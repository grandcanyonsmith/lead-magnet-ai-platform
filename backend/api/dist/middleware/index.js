"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bodyParsingMiddleware = exports.errorMiddleware = exports.authMiddleware = exports.loggingMiddleware = void 0;
exports.composeMiddleware = composeMiddleware;
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
/**
 * Middleware system for request processing.
 * Provides authentication, validation, logging, and error handling.
 */
/**
 * Request logging middleware.
 * Logs incoming requests for debugging and monitoring.
 */
const loggingMiddleware = async (event, tenantId, next) => {
    const startTime = Date.now();
    const method = event.requestContext.http.method;
    const path = event.rawPath;
    logger_1.logger.info('[Middleware] Request started', {
        method,
        path,
        tenantId,
        requestId: event.requestContext.requestId,
    });
    if (next) {
        try {
            const response = await next();
            const duration = Date.now() - startTime;
            logger_1.logger.info('[Middleware] Request completed', {
                method,
                path,
                tenantId,
                statusCode: response.statusCode,
                duration: `${duration}ms`,
            });
            return response;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            logger_1.logger.error('[Middleware] Request failed', {
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
exports.loggingMiddleware = loggingMiddleware;
/**
 * Authentication middleware.
 * Validates that tenantId is present for protected routes.
 */
const authMiddleware = async (_event, tenantId, next) => {
    if (!tenantId) {
        throw new errors_1.ApiError('Please sign in to access this page', 401);
    }
    if (next) {
        return await next();
    }
};
exports.authMiddleware = authMiddleware;
/**
 * Error handling middleware.
 * Catches and formats errors consistently.
 */
const errorMiddleware = async (event, tenantId, next) => {
    if (!next) {
        return;
    }
    try {
        return await next();
    }
    catch (error) {
        // Re-throw ApiError as-is (already formatted)
        if (error instanceof errors_1.ApiError) {
            throw error;
        }
        // Format unexpected errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.logger.error('[Middleware] Unexpected error', {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            path: event.rawPath,
            tenantId,
        });
        throw new errors_1.ApiError('Internal server error', 500);
    }
};
exports.errorMiddleware = errorMiddleware;
/**
 * Body parsing middleware.
 * Ensures request body is parsed if present.
 */
const bodyParsingMiddleware = async (_event, _tenantId, next) => {
    // Body is already parsed in routes/index.ts, but this middleware
    // can be used for additional validation or transformation
    if (next) {
        return await next();
    }
};
exports.bodyParsingMiddleware = bodyParsingMiddleware;
/**
 * Compose multiple middleware functions.
 */
function composeMiddleware(...middlewares) {
    return async (event, tenantId, next) => {
        let index = 0;
        const runNext = async () => {
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
            throw new errors_1.ApiError('No handler found', 500);
        };
        return await runNext();
    };
}
//# sourceMappingURL=index.js.map