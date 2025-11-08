/**
 * Error handling utilities
 */

import { ApiError } from '@/lib/api/errors'

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  
  if (error instanceof Error) {
    return error.message
  }
  
  if (typeof error === 'string') {
    return error
  }
  
  return 'An unexpected error occurred'
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function getErrorCode(error: unknown): string | undefined {
  if (error instanceof ApiError) {
    return error.code
  }
  return undefined
}

export function getErrorDetails(error: unknown): Record<string, unknown> | undefined {
  if (error instanceof ApiError) {
    return error.details
  }
  return undefined
}

