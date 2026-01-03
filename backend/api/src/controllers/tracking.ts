/**
 * Tracking Controller
 * Handles tracking event recording and analytics endpoints.
 */

import { RouteResponse } from "../routes";
import { ApiError } from "../utils/errors";
import { logger } from "../utils/logger";
import { trackingService } from "../services/trackingService";
import { s3Service } from "../services/s3Service";
import { db } from "../utils/db";
import { env } from "../utils/env";

const JOBS_TABLE = env.jobsTable;

class TrackingController {
  /**
   * Get a presigned URL for uploading session recording (public endpoint)
   */
  async getRecordingUploadUrl(body: any): Promise<RouteResponse> {
    logger.info("[Tracking Controller] Getting recording upload URL", {
      jobId: body.job_id,
      sessionId: body.session_id,
      part: body.part_number,
    });

    if (!body.job_id || !body.session_id) {
      throw new ApiError("Missing required fields: job_id, session_id", 400);
    }

    // Verify job exists (security check)
    const job = await db.get(JOBS_TABLE, { job_id: body.job_id });
    if (!job) {
      throw new ApiError("Job not found", 404);
    }

    const tenantId = job.tenant_id;
    // Use fixed bucket as requested
    // Ensure this bucket is accessible by the lambda role
    const bucket = "cc360-pages"; 
    const timestamp = body.timestamp || Date.now();
    const contentType = body.content_type || "application/json";
    
    // Determine extension based on content type
    let ext = "json";
    if (contentType.includes("video/webm")) ext = "webm";
    else if (contentType.includes("video/mp4")) ext = "mp4";
    else if (contentType.includes("image/png")) ext = "png";
    else if (contentType.includes("image/jpeg")) ext = "jpg";
    
    const part = body.part_number ? `_${body.part_number}` : "";
    
    // Key structure: leadmagnet/recordings/{tenantId}/{jobId}/{sessionId}/{timestamp}{part}.{ext}
    const key = `leadmagnet/recordings/${tenantId}/${body.job_id}/${body.session_id}/${timestamp}${part}.${ext}`;

    // Generate presigned URL (valid for 15 minutes)
    const uploadUrl = await s3Service.getPresignedPutUrl(
      bucket,
      key,
      contentType,
      900,
    );

    return {
      statusCode: 200,
      body: {
        uploadUrl,
        key,
      },
    };
  }

  /**
   * Record a tracking event (public endpoint, no auth required).
   */
  async recordEvent(
    body: any,
    sourceIp: string,
    userAgent?: string,
    referrer?: string,
  ): Promise<RouteResponse> {
    logger.info("[Tracking Controller] Recording event", {
      eventType: body.event_type,
      jobId: body.job_id,
      sessionId: body.session_id,
      sourceIp,
    });

    // Validate required fields
    if (!body.job_id || !body.event_type || !body.session_id) {
      throw new ApiError(
        "Missing required fields: job_id, event_type, session_id",
        400,
      );
    }

    // Verify job exists and get tenant_id
    const job = await db.get(JOBS_TABLE, { job_id: body.job_id });
    if (!job) {
      throw new ApiError("Job not found", 404);
    }

    const tenantId = job.tenant_id;
    if (!tenantId) {
      throw new ApiError("Job missing tenant_id", 500);
    }

    // Extract IP from body if provided, otherwise use source IP
    const ipAddress = body.ip_address || sourceIp;

    // Record the event
    const eventId = await trackingService.recordEvent({
      job_id: body.job_id,
      tenant_id: tenantId,
      event_type: body.event_type,
      ip_address: ipAddress,
      user_agent: userAgent || body.user_agent,
      referrer: referrer || body.referrer,
      location: body.location, // Optional, will be looked up if not provided
      session_id: body.session_id,
      session_start_time: body.session_start_time,
      session_duration_seconds: body.session_duration_seconds,
      page_url: body.page_url,
      page_title: body.page_title,
      recording_url: body.recording_url,
      recording_key: body.recording_key,
    });

    return {
      statusCode: 200,
      body: {
        event_id: eventId,
        success: true,
      },
    };
  }

  /**
   * Get tracking statistics for a job (requires auth).
   */
  async getJobStats(tenantId: string, jobId: string): Promise<RouteResponse> {
    logger.info("[Tracking Controller] Getting job stats", { tenantId, jobId });

    // Verify job belongs to tenant
    const job = await db.get(JOBS_TABLE, { job_id: jobId });
    if (!job) {
      throw new ApiError("Job not found", 404);
    }

    if (job.tenant_id !== tenantId) {
      throw new ApiError(
        "You do not have permission to access this job",
        403,
      );
    }

    const stats = await trackingService.getJobStats(jobId, tenantId);

    return {
      statusCode: 200,
      body: stats,
    };
  }

  /**
   * Get tracking events for a job (requires auth).
   */
  async getJobEvents(
    tenantId: string,
    jobId: string,
    queryParams: Record<string, any>,
  ): Promise<RouteResponse> {
    logger.info("[Tracking Controller] Getting job events", {
      tenantId,
      jobId,
      queryParams,
    });

    // Verify job belongs to tenant
    const job = await db.get(JOBS_TABLE, { job_id: jobId });
    if (!job) {
      throw new ApiError("Job not found", 404);
    }

    if (job.tenant_id !== tenantId) {
      throw new ApiError(
        "You do not have permission to access this job",
        403,
      );
    }

    const limit = queryParams.limit ? parseInt(queryParams.limit) : 100;
    const lastEvaluatedKey = queryParams.lastEvaluatedKey
      ? JSON.parse(decodeURIComponent(queryParams.lastEvaluatedKey))
      : undefined;

    const result = await trackingService.getJobEvents(
      jobId,
      tenantId,
      limit,
      lastEvaluatedKey,
    );

    return {
      statusCode: 200,
      body: result,
    };
  }

  /**
   * Get session recordings for a job (requires auth).
   */
  async getJobRecordings(
    tenantId: string,
    jobId: string,
    queryParams: Record<string, any>,
  ): Promise<RouteResponse> {
    logger.info("[Tracking Controller] Getting job recordings", {
      tenantId,
      jobId,
    });

    // Verify job belongs to tenant
    const job = await db.get(JOBS_TABLE, { job_id: jobId });
    if (!job) {
      throw new ApiError("Job not found", 404);
    }

    if (job.tenant_id !== tenantId) {
      throw new ApiError(
        "You do not have permission to access this job",
        403,
      );
    }

    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;

    // Fetch raw events
    const { events } = await trackingService.getJobEvents(
      jobId,
      tenantId,
      1000, // Fetch more to filter down
    );

    // Filter for recording uploads
    const recordings = events
      .filter((e) => e.event_type === "recording_uploaded")
      .map((e) => ({
        event_id: e.event_id,
        session_id: e.session_id,
        created_at: e.created_at,
        recording_url: e.recording_url,
        recording_key: e.recording_key,
        page_url: e.page_url,
      }))
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, limit);

    return {
      statusCode: 200,
      body: {
        recordings,
        count: recordings.length,
      },
    };
  }
}

export const trackingController = new TrackingController();
