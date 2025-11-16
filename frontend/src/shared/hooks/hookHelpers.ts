/**
 * Shared hook utilities
 * Provides common patterns for API hooks
 */

import { getErrorMessage } from '@/shared/utils/api-helpers'

/**
 * Standardize error handling across hooks
 * Converts various error types to a consistent string format
 */
export function normalizeError(error: unknown): string | null {
  if (!error) return null
  return getErrorMessage(error)
}

/**
 * Standardize loading state
 */
export function normalizeLoading(isLoading: boolean): boolean {
  return isLoading
}

/**
 * Standardize refetch function
 */
export function normalizeRefetch(refetch: () => void): () => void {
  return () => refetch()
}

/**
 * Extract data from query response with fallback
 */
export function extractData<T>(
  data: T | undefined | null,
  fallback: T
): T {
  return data ?? fallback
}

/**
 * Extract array data from list response
 */
export function extractListData<T>(
  data: { [key: string]: T[] } | undefined | null,
  listKey: string,
  fallback: T[] = []
): T[] {
  if (!data) return fallback
  return data[listKey] ?? fallback
}

