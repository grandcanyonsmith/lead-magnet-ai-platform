/**
 * Common utility types used across the application
 */

export type Status = "pending" | "processing" | "completed" | "failed";

export type SortDirection = "asc" | "desc";

export interface PaginatedResponse<T> {
  items: T[];
  total?: number;
  page?: number;
  page_size?: number;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface BaseEntity {
  created_at: string;
  updated_at?: string;
}
