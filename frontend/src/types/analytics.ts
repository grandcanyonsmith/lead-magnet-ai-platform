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
  trends: {
    jobs_by_day: Record<string, number>;
    submissions_by_day: Record<string, number>;
  };
  breakdown: {
    jobs_by_status: {
      completed: number;
      failed: number;
      pending: number;
    };
    jobs_by_workflow: Record<string, number>;
  };
  [key: string]: unknown;
}
