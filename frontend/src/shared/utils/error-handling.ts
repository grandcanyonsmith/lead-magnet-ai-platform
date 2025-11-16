/**
 * Common error handling utilities
 * Provides consistent error handling patterns across the app
 */

import { toast } from 'react-hot-toast'
import { getErrorMessage, isNetworkError, isAuthError } from './api-helpers'

export interface ErrorHandlerOptions {
  showToast?: boolean
  toastMessage?: string
  logError?: boolean
  onError?: (error: unknown) => void
}

/**
 * Handle errors consistently across the app
 */
export function handleError(error: unknown, options: ErrorHandlerOptions = {}): string {
  const {
    showToast = true,
    toastMessage,
    logError = true,
    onError,
  } = options

  const errorMessage = toastMessage || getErrorMessage(error)

  if (logError) {
    console.error('Error:', error)
  }

  if (showToast) {
    if (isNetworkError(error)) {
      toast.error('Network error. Please check your connection.')
    } else if (isAuthError(error)) {
      toast.error('Authentication error. Please log in again.')
    } else {
      toast.error(errorMessage)
    }
  }

  if (onError) {
    onError(error)
  }

  return errorMessage
}

/**
 * Handle async errors with proper error handling
 */
export async function handleAsyncError<T>(
  asyncFn: () => Promise<T>,
  options: ErrorHandlerOptions = {}
): Promise<T | null> {
  try {
    return await asyncFn()
  } catch (error) {
    handleError(error, options)
    return null
  }
}

