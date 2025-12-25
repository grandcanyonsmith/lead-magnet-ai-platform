/**
 * Common API helper functions
 * Provides reusable utilities for API interactions
 */

import { ApiError } from "@/lib/api/errors";

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred";
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.statusCode === 0 || error.statusCode === undefined;
  }
  return false;
}

/**
 * Check if error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.statusCode === 401 || error.statusCode === 403;
  }
  return false;
}

/**
 * Format API response for display
 */
export function formatApiResponse<T>(
  data: T | null | undefined,
  fallback: T,
): T {
  return data ?? fallback;
}
