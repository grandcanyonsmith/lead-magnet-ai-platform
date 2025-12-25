/**
 * Tracking API Client
 * Client for tracking-related API endpoints.
 */

import { api } from "./index";

const sendDebugLog = (payload: Record<string, unknown>) => {
  // Avoid mixed-content/CORS when served over HTTPS (production)
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    return;
  }
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/6252ee0a-6d2b-46d2-91c8-d377550bcc04", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
  // #endregion
};

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
  event_type:
    | "click"
    | "page_view"
    | "session_start"
    | "session_end"
    | "heartbeat";
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
  sendDebugLog({
    sessionId: "debug-session",
    runId: "run-tracking",
    hypothesisId: "C",
    location: "tracking.client.ts:63",
    message: "trackEvent called",
    data: { eventType: event.event_type, jobId: event.job_id },
    timestamp: Date.now(),
  });
  return api.post<{ event_id: string; success: boolean }>(
    "/v1/tracking/event",
    event,
  );
}

/**
 * Get tracking statistics for a job.
 */
export async function getJobStats(jobId: string): Promise<TrackingStats> {
  sendDebugLog({
    sessionId: "debug-session",
    runId: "run-tracking",
    hypothesisId: "D",
    location: "tracking.client.ts:75",
    message: "getJobStats called",
    data: { jobId },
    timestamp: Date.now(),
  });
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
  },
): Promise<TrackingEventsResponse> {
  sendDebugLog({
    sessionId: "debug-session",
    runId: "run-tracking",
    hypothesisId: "E",
    location: "tracking.client.ts:90",
    message: "getJobEvents called",
    data: { jobId, hasLimit: !!options?.limit },
    timestamp: Date.now(),
  });
  const params = new URLSearchParams();
  if (options?.limit) {
    params.append("limit", options.limit.toString());
  }
  if (options?.lastEvaluatedKey) {
    params.append(
      "lastEvaluatedKey",
      encodeURIComponent(JSON.stringify(options.lastEvaluatedKey)),
    );
  }

  const queryString = params.toString();
  const url = `/admin/tracking/jobs/${jobId}/events${queryString ? `?${queryString}` : ""}`;

  return api.get<TrackingEventsResponse>(url);
}
