/**
 * Tracking API Client
 * Client for tracking-related API endpoints.
 */

import { api } from './index';

export interface TrackingStats {
  total_clicks: number;
  unique_clicks: number;
  total_sessions: number;
  unique_visitors: number;
  average_session_duration_seconds: number;
  total_page_views: number;
  average_page_views_per_session: number;
  location_breakdown: Record<string, number>;
}

export interface TrackingEvent {
  event_id: string;
  job_id: string;
  tenant_id: string;
  event_type: 'click' | 'page_view' | 'session_start' | 'session_end' | 'heartbeat';
  ip_address: string;
  user_agent?: string;
  referrer?: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  session_id: string;
  session_start_time?: string;
  session_duration_seconds?: number;
  page_url?: string;
  page_title?: string;
  created_at: string;
}

export interface TrackingEventsResponse {
  events: TrackingEvent[];
  lastEvaluatedKey?: any;
}

/**
 * Track an event (public endpoint, no auth required).
 */
export async function trackEvent(event: {
  job_id: string;
  event_type: string;
  session_id: string;
  session_start_time?: string;
  session_duration_seconds?: number;
  page_url?: string;
  page_title?: string;
  ip_address?: string;
  user_agent?: string;
  referrer?: string;
}): Promise<{ event_id: string; success: boolean }> {
  const response = await fetch(`${api.baseUrl}/v1/tracking/event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    throw new Error(`Failed to track event: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get tracking statistics for a job.
 */
export async function getJobStats(jobId: string): Promise<TrackingStats> {
  return api.get<TrackingStats>(`/admin/tracking/jobs/${jobId}/stats`);
}

/**
 * Get tracking events for a job.
 */
export async function getJobEvents(
  jobId: string,
  options?: {
    limit?: number;
    lastEvaluatedKey?: any;
  }
): Promise<TrackingEventsResponse> {
  const params = new URLSearchParams();
  if (options?.limit) {
    params.append('limit', options.limit.toString());
  }
  if (options?.lastEvaluatedKey) {
    params.append('lastEvaluatedKey', encodeURIComponent(JSON.stringify(options.lastEvaluatedKey)));
  }

  const queryString = params.toString();
  const url = `/admin/tracking/jobs/${jobId}/events${queryString ? `?${queryString}` : ''}`;

  return api.get<TrackingEventsResponse>(url);
}
