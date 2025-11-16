/**
 * Usage and billing-related types
 */

export interface ServiceUsage {
  service_type: string
  calls: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
  actual_cost: number
  upcharge_cost: number
}

export interface UsagePeriod {
  start: string
  end: string
}

export interface UsageSummary {
  total_calls: number
  total_tokens: number
  total_input_tokens: number
  total_output_tokens: number
}

export interface OpenAIUsage {
  by_service: Record<string, ServiceUsage>
  total_actual: number
  total_upcharge: number
}

export interface UsageResponse {
  openai: OpenAIUsage
  period: UsagePeriod
  summary: UsageSummary
}

export interface UsageBreakdown {
  date: string
  cost: number
  requests: number
  [key: string]: unknown
}

