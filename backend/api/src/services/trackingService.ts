/**
 * Tracking Service
 * Handles storage and retrieval of lead magnet tracking events.
 */

import { ulid } from 'ulid';
import { db } from '../utils/db';
import { logger } from '../utils/logger';
import { env } from '../utils/env';
import { ipGeolocationService } from './ipGeolocationService';

const TRACKING_EVENTS_TABLE = env.trackingEventsTable;

if (!TRACKING_EVENTS_TABLE) {
  logger.error('[Tracking Service] TRACKING_EVENTS_TABLE environment variable is not set');
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
  ttl?: number; // Unix timestamp for TTL (1 year from creation)
}

export interface TrackingStats {
  total_clicks: number;
  unique_clicks: number; // Unique IP addresses
  total_sessions: number;
  unique_visitors: number; // Unique IP addresses
  average_session_duration_seconds: number;
  total_page_views: number;
  average_page_views_per_session: number;
  location_breakdown: Record<string, number>; // Country -> count
}

export class TrackingService {
  /**
   * Record a tracking event.
   */
  async recordEvent(event: Omit<TrackingEvent, 'event_id' | 'created_at' | 'ttl'>): Promise<string> {
    if (!TRACKING_EVENTS_TABLE) {
      throw new Error('TRACKING_EVENTS_TABLE environment variable is not set');
    }

    const eventId = `evt_${ulid()}`;
    const createdAt = new Date().toISOString();
    
    // Set TTL to 1 year from now (Unix timestamp)
    const ttl = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60);

    // Get location from IP if not provided
    let location = event.location;
    if (!location && event.ip_address) {
      location = await ipGeolocationService.getLocationFromIP(event.ip_address) || undefined;
    }

    const trackingEvent: TrackingEvent = {
      event_id: eventId,
      ...event,
      location,
      created_at: createdAt,
      ttl,
    };

    await db.put(TRACKING_EVENTS_TABLE, trackingEvent);

    logger.info('[Tracking Service] Event recorded', {
      eventId,
      jobId: event.job_id,
      eventType: event.event_type,
      ipAddress: event.ip_address,
      sessionId: event.session_id,
    });

    return eventId;
  }

  /**
   * Get aggregated statistics for a job.
   */
  async getJobStats(jobId: string, tenantId: string): Promise<TrackingStats> {
    if (!TRACKING_EVENTS_TABLE) {
      throw new Error('TRACKING_EVENTS_TABLE environment variable is not set');
    }

    // Query all events for this job using GSI
    const events = await db.query(
      TRACKING_EVENTS_TABLE,
      {
        IndexName: 'gsi_job_created',
        KeyConditionExpression: 'job_id = :jobId',
        ExpressionAttributeValues: {
          ':jobId': jobId,
        },
      }
    );

    // Filter by tenant_id (safety check)
    const tenantEvents = events.filter((e: any) => e.tenant_id === tenantId);

    // Calculate statistics
    const uniqueIPs = new Set<string>();
    const uniqueSessions = new Set<string>();
    const sessionDurations: number[] = [];
    const locationCounts: Record<string, number> = {};
    let totalClicks = 0;
    let totalPageViews = 0;

    // Group events by session
    const sessions = new Map<string, { startTime?: string; endTime?: string; pageViews: number }>();

    for (const event of tenantEvents) {
      const e = event as TrackingEvent;

      // Track unique IPs
      if (e.ip_address) {
        uniqueIPs.add(e.ip_address);
      }

      // Track unique sessions
      if (e.session_id) {
        uniqueSessions.add(e.session_id);
      }

      // Count clicks
      if (e.event_type === 'click') {
        totalClicks++;
      }

      // Count page views
      if (e.event_type === 'page_view') {
        totalPageViews++;
      }

      // Track session data
      if (e.session_id) {
        if (!sessions.has(e.session_id)) {
          sessions.set(e.session_id, { pageViews: 0 });
        }
        const session = sessions.get(e.session_id)!;
        
        if (e.event_type === 'session_start' && e.session_start_time) {
          session.startTime = e.session_start_time;
        }
        if (e.event_type === 'session_end' && e.session_duration_seconds) {
          session.endTime = e.created_at;
          sessionDurations.push(e.session_duration_seconds);
        }
        if (e.event_type === 'page_view') {
          session.pageViews++;
        }
      }

      // Track location breakdown
      if (e.location?.country) {
        locationCounts[e.location.country] = (locationCounts[e.location.country] || 0) + 1;
      }
    }

    // Calculate average session duration
    const avgSessionDuration = sessionDurations.length > 0
      ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length
      : 0;

    // Calculate average page views per session
    const sessionPageViewCounts = Array.from(sessions.values()).map(s => s.pageViews);
    const avgPageViewsPerSession = sessionPageViewCounts.length > 0
      ? sessionPageViewCounts.reduce((a, b) => a + b, 0) / sessionPageViewCounts.length
      : 0;

    return {
      total_clicks: totalClicks,
      unique_clicks: uniqueIPs.size,
      total_sessions: uniqueSessions.size,
      unique_visitors: uniqueIPs.size,
      average_session_duration_seconds: Math.round(avgSessionDuration),
      total_page_views: totalPageViews,
      average_page_views_per_session: Math.round(avgPageViewsPerSession * 100) / 100,
      location_breakdown: locationCounts,
    };
  }

  /**
   * Get raw events for a job (with pagination).
   */
  async getJobEvents(
    jobId: string,
    tenantId: string,
    limit: number = 100,
    lastEvaluatedKey?: any
  ): Promise<{ events: TrackingEvent[]; lastEvaluatedKey?: any }> {
    if (!TRACKING_EVENTS_TABLE) {
      throw new Error('TRACKING_EVENTS_TABLE environment variable is not set');
    }

    const queryParams: any = {
      IndexName: 'gsi_job_created',
      KeyConditionExpression: 'job_id = :jobId',
      ExpressionAttributeValues: {
        ':jobId': jobId,
      },
      Limit: limit,
      ScanIndexForward: false, // Most recent first
    };

    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = lastEvaluatedKey;
    }

    const result = await db.query(TRACKING_EVENTS_TABLE, queryParams);

    // Filter by tenant_id and map to TrackingEvent
    const events = result
      .filter((e: any) => e.tenant_id === tenantId)
      .map((e: any) => e as TrackingEvent);

    return {
      events,
      lastEvaluatedKey: result.lastEvaluatedKey,
    };
  }
}

export const trackingService = new TrackingService();
