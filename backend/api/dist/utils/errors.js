"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleError = exports.ServiceUnavailableError = exports.InternalServerError = exports.RateLimitError = exports.ConflictError = exports.ValidationError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ApiError = void 0;
exports.setErrorTrackingHook = setErrorTrackingHook;
exports.createErrorResponse = createErrorResponse;
const logger_1 = require("./logger");
const env_1 = require("./env");
/**
 * Base API error class.
 * All API errors should extend this class for consistent error handling.
 */
class ApiError extends Error {
    constructor(message, statusCode = 400, code, details, context) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.name = 'ApiError';
        this.timestamp = new Date().toISOString();
        this.requestId = context?.requestId;
        this.userId = context?.userId;
        this.tenantId = context?.tenantId;
        Error.captureStackTrace(this, this.constructor);
    }
    /**
     * Convert error to a loggable object with all context
     */
    toLogObject() {
        return {
            name: this.name,
            message: this.message,
            statusCode: this.statusCode,
            code: this.code,
            details: this.details,
            timestamp: this.timestamp,
            requestId: this.requestId,
            userId: this.userId,
            tenantId: this.tenantId,
            stack: this.stack,
        };
    }
}
exports.ApiError = ApiError;
/**
 * Authentication error (401).
 */
class AuthenticationError extends ApiError {
    constructor(message = 'Please sign in to access this page', details) {
        super(message, 401, 'AUTHENTICATION_REQUIRED', details);
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
/**
 * Authorization error (403).
 */
class AuthorizationError extends ApiError {
    constructor(message = 'You don\'t have permission to access this resource', details) {
        super(message, 403, 'AUTHORIZATION_FAILED', details);
        this.name = 'AuthorizationError';
    }
}
exports.AuthorizationError = AuthorizationError;
/**
 * Not found error (404).
 */
class NotFoundError extends ApiError {
    constructor(message = 'Resource not found', details) {
        super(message, 404, 'NOT_FOUND', details);
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
/**
 * Validation error (400).
 */
class ValidationError extends ApiError {
    constructor(message, details) {
        super(message, 400, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
/**
 * Conflict error (409).
 */
class ConflictError extends ApiError {
    constructor(message, details) {
        super(message, 409, 'CONFLICT', details);
        this.name = 'ConflictError';
    }
}
exports.ConflictError = ConflictError;
/**
 * Rate limit error (429).
 */
class RateLimitError extends ApiError {
    constructor(message = 'Rate limit exceeded', details) {
        super(message, 429, 'RATE_LIMIT_EXCEEDED', details);
        this.name = 'RateLimitError';
    }
}
exports.RateLimitError = RateLimitError;
/**
 * Internal server error (500).
 */
class InternalServerError extends ApiError {
    constructor(message = 'Internal server error', details) {
        super(message, 500, 'INTERNAL_ERROR', details);
        this.name = 'InternalServerError';
    }
}
exports.InternalServerError = InternalServerError;
/**
 * Service unavailable error (503).
 */
class ServiceUnavailableError extends ApiError {
    constructor(message = 'Service temporarily unavailable', details) {
        super(message, 503, 'SERVICE_UNAVAILABLE', details);
        this.name = 'ServiceUnavailableError';
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
/**
 * Error tracking hook - can be extended to send errors to monitoring services
 */
let errorTrackingHook = null;
/**
 * Set a custom error tracking hook for monitoring services
 */
function setErrorTrackingHook(hook) {
    errorTrackingHook = hook;
}
/**
 * Handle errors and convert them to API responses.
 * Provides consistent error formatting across the application.
 */
const handleError = (error, context) => {
    // ApiError instances are already formatted
    if (error instanceof ApiError) {
        // Log with full context
        logger_1.logger.debug('[Error Handler] API Error', {
            ...error.toLogObject(),
            ...(context && { context }),
        });
        // Call error tracking hook if set
        if (errorTrackingHook) {
            try {
                errorTrackingHook(error, context);
            }
            catch (trackingError) {
                logger_1.logger.warn('[Error Handler] Error tracking hook failed', {
                    error: trackingError instanceof Error ? trackingError.message : String(trackingError),
                });
            }
        }
        return {
            statusCode: error.statusCode,
            body: {
                error: error.message,
                code: error.code,
                ...(error.details && { details: error.details }),
                ...(context?.requestId && { requestId: context.requestId }),
            },
        };
    }
    // Standard Error instances
    if (error instanceof Error) {
        logger_1.logger.error('[Error Handler] Unexpected error', {
            error: error.message,
            stack: error.stack,
            name: error.name,
            ...(context && { context }),
        });
        // Convert to ApiError for consistent handling
        const apiError = new InternalServerError('An unexpected error occurred', {
            originalError: error.message,
            ...(context && { context }),
        });
        // Call error tracking hook if set
        if (errorTrackingHook) {
            try {
                errorTrackingHook(apiError, context);
            }
            catch (trackingError) {
                logger_1.logger.warn('[Error Handler] Error tracking hook failed', {
                    error: trackingError instanceof Error ? trackingError.message : String(trackingError),
                });
            }
        }
        // Don't expose internal error details in production
        const isDevelopment = env_1.env.isDevelopment();
        return {
            statusCode: 500,
            body: {
                error: 'Internal server error',
                code: 'INTERNAL_ERROR',
                ...(context?.requestId && { requestId: context.requestId }),
                ...(isDevelopment && {
                    message: error.message,
                    stack: error.stack,
                }),
            },
        };
    }
    // Unknown error type
    logger_1.logger.error('[Error Handler] Unknown error type', {
        error: String(error),
        type: typeof error,
    });
    return {
        statusCode: 500,
        body: {
            error: 'Unknown error occurred',
        },
    };
};
exports.handleError = handleError;
/**
 * Create a standardized error response.
 */
function createErrorResponse(statusCode, message, code, details) {
    return {
        statusCode,
        body: {
            error: message,
            ...(code && { code }),
            ...(details && { details }),
        },
    };
}
//# sourceMappingURL=errors.js.map