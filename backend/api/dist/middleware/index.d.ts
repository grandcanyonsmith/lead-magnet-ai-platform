import { Middleware } from '../types/api';
/**
 * Middleware system for request processing.
 * Provides authentication, validation, logging, and error handling.
 */
/**
 * Request logging middleware.
 * Logs incoming requests for debugging and monitoring.
 */
export declare const loggingMiddleware: Middleware;
/**
 * Authentication middleware.
 * Validates that tenantId is present for protected routes.
 */
export declare const authMiddleware: Middleware;
/**
 * Error handling middleware.
 * Catches and formats errors consistently.
 */
export declare const errorMiddleware: Middleware;
/**
 * Body parsing middleware.
 * Ensures request body is parsed if present.
 */
export declare const bodyParsingMiddleware: Middleware;
/**
 * Compose multiple middleware functions.
 */
export declare function composeMiddleware(...middlewares: Middleware[]): Middleware;
//# sourceMappingURL=index.d.ts.map