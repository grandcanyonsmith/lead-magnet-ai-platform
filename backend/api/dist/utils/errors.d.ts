/**
 * Base API error class.
 * All API errors should extend this class for consistent error handling.
 */
export declare class ApiError extends Error {
    statusCode: number;
    code?: string | undefined;
    details?: Record<string, any> | undefined;
    readonly timestamp: string;
    readonly requestId?: string;
    readonly userId?: string;
    readonly tenantId?: string;
    constructor(message: string, statusCode?: number, code?: string | undefined, details?: Record<string, any> | undefined, context?: {
        requestId?: string;
        userId?: string;
        tenantId?: string;
    });
    /**
     * Convert error to a loggable object with all context
     */
    toLogObject(): Record<string, any>;
}
/**
 * Authentication error (401).
 */
export declare class AuthenticationError extends ApiError {
    constructor(message?: string, details?: Record<string, any>);
}
/**
 * Authorization error (403).
 */
export declare class AuthorizationError extends ApiError {
    constructor(message?: string, details?: Record<string, any>);
}
/**
 * Not found error (404).
 */
export declare class NotFoundError extends ApiError {
    constructor(message?: string, details?: Record<string, any>);
}
/**
 * Validation error (400).
 */
export declare class ValidationError extends ApiError {
    constructor(message: string, details?: Record<string, any>);
}
/**
 * Conflict error (409).
 */
export declare class ConflictError extends ApiError {
    constructor(message: string, details?: Record<string, any>);
}
/**
 * Rate limit error (429).
 */
export declare class RateLimitError extends ApiError {
    constructor(message?: string, details?: Record<string, any>);
}
/**
 * Internal server error (500).
 */
export declare class InternalServerError extends ApiError {
    constructor(message?: string, details?: Record<string, any>);
}
/**
 * Service unavailable error (503).
 */
export declare class ServiceUnavailableError extends ApiError {
    constructor(message?: string, details?: Record<string, any>);
}
/**
 * Set a custom error tracking hook for monitoring services
 */
export declare function setErrorTrackingHook(hook: (error: ApiError, context?: Record<string, any>) => void): void;
/**
 * Handle errors and convert them to API responses.
 * Provides consistent error formatting across the application.
 */
export declare const handleError: (error: unknown, context?: {
    requestId?: string;
    userId?: string;
    tenantId?: string;
    path?: string;
    method?: string;
}) => {
    statusCode: number;
    body: any;
};
/**
 * Create a standardized error response.
 */
export declare function createErrorResponse(statusCode: number, message: string, code?: string, details?: Record<string, any>): {
    statusCode: number;
    body: any;
};
//# sourceMappingURL=errors.d.ts.map