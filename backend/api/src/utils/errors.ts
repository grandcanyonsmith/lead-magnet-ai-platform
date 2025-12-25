import { logger } from './logger';
import { env } from './env';

/**
 * Base API error class.
 * All API errors should extend this class for consistent error handling.
 */
export class ApiError extends Error {
  public readonly timestamp: string;
  public readonly requestId?: string;
  public readonly userId?: string;
  public readonly tenantId?: string;

  constructor(
    message: string,
    public statusCode: number = 400,
    public code?: string,
    public details?: Record<string, any>,
    context?: {
      requestId?: string;
      userId?: string;
      tenantId?: string;
    }
  ) {
    super(message);
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
  toLogObject(): Record<string, any> {
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
 * Error tracking hook - can be extended to send errors to monitoring services
 */
let errorTrackingHook: ((error: ApiError, context?: Record<string, any>) => void) | null = null;

/**
 * Set a custom error tracking hook for monitoring services
 */
export function setErrorTrackingHook(
  hook: (error: ApiError, context?: Record<string, any>) => void
): void {
  errorTrackingHook = hook;
}

/**
 * Handle errors and convert them to API responses.
 * Provides consistent error formatting across the application.
 */
export const handleError = (
  error: unknown,
  context?: {
    requestId?: string;
    userId?: string;
    tenantId?: string;
    path?: string;
    method?: string;
  }
): { statusCode: number; body: any } => {
  // ApiError instances are already formatted
  if (error instanceof ApiError) {
    // Log with full context
    logger.debug('[Error Handler] API Error', {
      ...error.toLogObject(),
      ...(context && { context }),
    });

    // Call error tracking hook if set
    if (errorTrackingHook) {
      try {
        errorTrackingHook(error, context);
      } catch (trackingError) {
        logger.warn('[Error Handler] Error tracking hook failed', {
          error: trackingError instanceof Error ? trackingError.message : String(trackingError),
        });
      }
    }

    return {
      statusCode: error.statusCode,
      body: {
        error: error.message,
        message: error.message,
        code: error.code,
        ...(error.details && { details: error.details }),
        ...(context?.requestId && { requestId: context.requestId }),
      },
    };
  }

  // Standard Error instances
  if (error instanceof Error) {
    logger.error('[Error Handler] Unexpected error', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      ...(context && { context }),
    });

    // Convert to ApiError for consistent handling
    const apiError = new InternalServerError(
      'An unexpected error occurred',
      {
        originalError: error.message,
        ...(context && { context }),
      }
    );

    // Call error tracking hook if set
    if (errorTrackingHook) {
      try {
        errorTrackingHook(apiError, context);
      } catch (trackingError) {
        logger.warn('[Error Handler] Error tracking hook failed', {
          error: trackingError instanceof Error ? trackingError.message : String(trackingError),
        });
      }
    }

    // Don't expose internal error details in production
    // In normal runtime, env.nodeEnv is stable. In tests, NODE_ENV may be mutated after env is instantiated.
    // Honor the live process.env.NODE_ENV to keep error output expectations deterministic.
    const isDevelopment = env.isDevelopment() || process.env.NODE_ENV === 'development';
    
    return {
      statusCode: 500,
      body: {
        error: 'Internal server error',
        message: isDevelopment ? error.message : 'Internal server error',
        code: 'INTERNAL_ERROR',
        ...(context?.requestId && { requestId: context.requestId }),
        ...(isDevelopment && {
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
      message: 'Unknown error occurred',
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
      message,
      ...(code && { code }),
      ...(details && { details }),
    },
  };
}
