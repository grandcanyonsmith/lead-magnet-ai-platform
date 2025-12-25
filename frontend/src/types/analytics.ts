/**
 * Analytics-related types
 */

export interface AnalyticsOverview {
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  pending_jobs: number;
  success_rate: number;
  avg_processing_time_seconds: number;
  total_submissions: number;
  total_workflows: number;
  active_workflows: number;
}

export interface AnalyticsResponse {
  overview: AnalyticsOverview;
  [key: string]: unknown;
}
