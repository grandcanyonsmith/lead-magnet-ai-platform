/**
 * Backward compatibility layer for the old auth module
 * Re-exports from the new refactored auth structure
 * 
 * @deprecated Import from '@/lib/auth' instead. This file is kept for backward compatibility.
 */

// Re-export everything from the new auth module
export * from './auth/index'

// Explicitly export getIdToken to ensure it's available
export { getIdToken } from './auth/legacy'

