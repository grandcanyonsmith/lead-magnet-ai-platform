/**
 * Usage and billing-related types
 */

export interface UsageResponse {
  start_date: string
  end_date: string
  total_cost?: number
  total_requests?: number
  breakdown?: UsageBreakdown[]
}

export interface UsageBreakdown {
  date: string
  cost: number
  requests: number
  [key: string]: unknown
}

