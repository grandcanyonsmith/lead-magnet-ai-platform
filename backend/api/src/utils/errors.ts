import { logger } from './logger';

/**
 * Base API error class.
 * All API errors should extend this class for consistent error handling.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code?: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Authentication error (401).
 */
export class AuthenticationError extends ApiError {
  constructor(message: string = 'Please sign in to access this page', details?: Record<string, any>) {
    super(message, 401, 'AUTHENTICATION_REQUIRED', details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error (403).
 */
export class AuthorizationError extends ApiError {
  constructor(message: string = 'You don\'t have permission to access this resource', details?: Record<string, any>) {
    super(message, 403, 'AUTHORIZATION_FAILED', details);
    this.name = 'AuthorizationError';
  }
}

/**
 * Not found error (404).
 */
export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found', details?: Record<string, any>) {
    super(message, 404, 'NOT_FOUND', details);
    this.name = 'NotFoundError';
  }
}

/**
 * Validation error (400).
 */
export class ValidationError extends ApiError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * Conflict error (409).
 */
export class ConflictError extends ApiError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 409, 'CONFLICT', details);
    this.name = 'ConflictError';
  }
}

/**
 * Rate limit error (429).
 */
export class RateLimitError extends ApiError {
  constructor(message: string = 'Rate limit exceeded', details?: Record<string, any>) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', details);
    this.name = 'RateLimitError';
  }
}

/**
 * Internal server error (500).
 */
export class InternalServerError extends ApiError {
  constructor(message: string = 'Internal server error', details?: Record<string, any>) {
    super(message, 500, 'INTERNAL_ERROR', details);
    this.name = 'InternalServerError';
  }
}

/**
 * Service unavailable error (503).
 */
export class ServiceUnavailableError extends ApiError {
  constructor(message: string = 'Service temporarily unavailable', details?: Record<string, any>) {
    super(message, 503, 'SERVICE_UNAVAILABLE', details);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Handle errors and convert them to API responses.
 * Provides consistent error formatting across the application.
 */
export const handleError = (error: unknown): { statusCode: number; body: any } => {
  // ApiError instances are already formatted
  if (error instanceof ApiError) {
    logger.debug('[Error Handler] API Error', {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details,
    });

    return {
      statusCode: error.statusCode,
      body: {
        error: error.message,
        code: error.code,
        ...(error.details && { details: error.details }),
      },
    };
  }

  // Standard Error instances
  if (error instanceof Error) {
    logger.error('[Error Handler] Unexpected error', {
      error: error.message,
      stack: error.stack,
      name: error.name,
    });

    // Don't expose internal error details in production
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.IS_LOCAL === 'true';
    
    return {
      statusCode: 500,
      body: {
        error: 'Internal server error',
        ...(isDevelopment && {
          message: error.message,
          stack: error.stack,
        }),
      },
    };
  }

  // Unknown error type
  logger.error('[Error Handler] Unknown error type', {
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

/**
 * Create a standardized error response.
 */
export function createErrorResponse(
  statusCode: number,
  message: string,
  code?: string,
  details?: Record<string, any>
): { statusCode: number; body: any } {
  return {
    statusCode,
    body: {
      error: message,
      ...(code && { code }),
      ...(details && { details }),
    },
  };
}
