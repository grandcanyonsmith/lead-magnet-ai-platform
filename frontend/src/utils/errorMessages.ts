/**
 * User-friendly error messages with actionable guidance
 */

import { ApiError } from "@/lib/api/errors";

export interface ErrorMessage {
  title: string;
  message: string;
  action?: string;
  actionLabel?: string;
}

/**
 * Get user-friendly error message from an error
 */
export function getErrorMessage(error: unknown): ErrorMessage {
  // Handle ApiError instances
  if (error instanceof ApiError) {
    return getApiErrorMessage(error);
  }

  // Handle standard Error instances
  if (error instanceof Error) {
    return {
      title: "Something went wrong",
      message: error.message || "An unexpected error occurred. Please try again.",
      action: "retry",
      actionLabel: "Try Again",
    };
  }

  // Unknown error type
  return {
    title: "Unknown error",
    message: "An unexpected error occurred. Please try again or contact support if the problem persists.",
    action: "retry",
    actionLabel: "Try Again",
  };
}

/**
 * Get user-friendly error message from ApiError
 */
function getApiErrorMessage(error: ApiError): ErrorMessage {
  const statusCode = error.statusCode;
  const code = error.code;
  const message = error.message;

  // Network errors
  if (statusCode === undefined || statusCode === 0) {
    return {
      title: "Connection error",
      message: "Unable to connect to the server. Please check your internet connection and try again.",
      action: "retry",
      actionLabel: "Retry",
    };
  }

  // 4xx Client errors
  if (statusCode >= 400 && statusCode < 500) {
    switch (statusCode) {
      case 401:
        return {
          title: "Authentication required",
          message: "Your session has expired. Please sign in again to continue.",
          action: "signin",
          actionLabel: "Sign In",
        };

      case 403:
        return {
          title: "Access denied",
          message: "You don't have permission to perform this action. Please contact your administrator if you believe this is an error.",
          action: "contact",
          actionLabel: "Contact Support",
        };

      case 404:
        return {
          title: "Not found",
          message: "The resource you're looking for doesn't exist or has been removed.",
          action: "navigate",
          actionLabel: "Go Back",
        };

      case 409:
        return {
          title: "Conflict",
          message: message || "This action conflicts with the current state. Please refresh and try again.",
          action: "refresh",
          actionLabel: "Refresh",
        };

      case 422:
        return {
          title: "Validation error",
          message: message || "Please check your input and try again.",
          action: "fix",
          actionLabel: "Fix Input",
        };

      case 429:
        return {
          title: "Too many requests",
          message: "You're making requests too quickly. Please wait a moment and try again.",
          action: "wait",
          actionLabel: "Wait",
        };

      default:
        return {
          title: "Request error",
          message: message || "There was an error with your request. Please check your input and try again.",
          action: "retry",
          actionLabel: "Try Again",
        };
    }
  }

  // 5xx Server errors
  if (statusCode >= 500) {
    switch (code) {
      case "DATABASE_ERROR":
        return {
          title: "Database error",
          message: "We're experiencing database issues. Our team has been notified. Please try again in a few moments.",
          action: "retry",
          actionLabel: "Try Again",
        };

      case "EXTERNAL_SERVICE_ERROR":
        return {
          title: "Service unavailable",
          message: "An external service is temporarily unavailable. Please try again in a few moments.",
          action: "retry",
          actionLabel: "Try Again",
        };

      case "TIMEOUT":
        return {
          title: "Request timeout",
          message: "The request took too long to complete. Please try again.",
          action: "retry",
          actionLabel: "Try Again",
        };

      default:
        return {
          title: "Server error",
          message: "We're experiencing technical difficulties. Our team has been notified. Please try again in a few moments.",
          action: "retry",
          actionLabel: "Try Again",
        };
    }
  }

  // Default fallback
  return {
    title: "Error",
    message: message || "An error occurred. Please try again.",
    action: "retry",
    actionLabel: "Try Again",
  };
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ApiError) {
    const statusCode = error.statusCode;
    const code = error.code;

    // Don't retry client errors (except 429)
    if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
      return false;
    }

    // Don't retry certain error codes
    if (code === "VALIDATION_ERROR" || code === "AUTHENTICATION_ERROR") {
      return false;
    }

    return true;
  }

  return true;
}

