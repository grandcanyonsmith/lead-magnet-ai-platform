/**
 * Backward compatibility layer for the old API client
 * Re-exports from the new refactored API structure
 *
 * @deprecated Import from '@/lib/api/index' instead. This file is kept for backward compatibility.
 */

// Re-export the new API client instance
export { api } from "./api/index";

// Re-export error types
export { ApiError } from "./api/errors";
