/**
 * Tracking Controller
 * Handles tracking event recording and analytics endpoints.
 */

import { RouteResponse } from "../routes";
import { ApiError } from "../utils/errors";
import { logger } from "../utils/logger";
import { trackingService } from "../services/trackingService";
import { db } from "../utils/db";
import { env } from "../utils/env";
import fs from "fs";

const DEBUG_LOG_PATH = "/Users/canyonsmith/lead-magnent-ai/.cursor/debug.log";

const appendDebugLog = (payload: Record<string, unknown>) => {
  try {
    fs.appendFileSync(
      DEBUG_LOG_PATH,
      JSON.stringify({
        sessionId: "debug-session",
        runId: "run-tracking",
        ...payload,
        timestamp: Date.now(),
      }) + "\n",
      { encoding: "utf8" },
    );
  } catch {
    // swallow logging errors to avoid impacting handler
  }
};

const JOBS_TABLE = env.jobsTable;

class TrackingController {
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
    appendDebugLog({
      hypothesisId: "F",
      location: "tracking.ts:getJobStats:entry",
      data: { tenantId, jobId },
      message: "getJobStats entry",
    });
    logger.info("[Tracking Controller] Getting job stats", { tenantId, jobId });

    // Verify job belongs to tenant
    try {
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

      appendDebugLog({
        hypothesisId: "F",
        location: "tracking.ts:getJobStats:success",
        message: "getJobStats success",
        data: { jobId, tenantId, hasStats: !!stats },
      });

      return {
        statusCode: 200,
        body: stats,
      };
    } catch (err: any) {
      appendDebugLog({
        hypothesisId: "F",
        location: "tracking.ts:getJobStats:error",
        message: "getJobStats error",
        data: { jobId, tenantId, error: err?.message || String(err) },
      });
      throw err;
    }
  }

  /**
   * Get tracking events for a job (requires auth).
   */
  async getJobEvents(
    tenantId: string,
    jobId: string,
    queryParams: Record<string, any>,
  ): Promise<RouteResponse> {
    appendDebugLog({
      hypothesisId: "G",
      location: "tracking.ts:getJobEvents:entry",
      message: "getJobEvents entry",
      data: { tenantId, jobId, queryParams },
    });
    logger.info("[Tracking Controller] Getting job events", {
      tenantId,
      jobId,
      queryParams,
    });

    // Verify job belongs to tenant
    try {
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

      appendDebugLog({
        hypothesisId: "G",
        location: "tracking.ts:getJobEvents:success",
        message: "getJobEvents success",
        data: { jobId, tenantId, count: result?.events?.length || 0 },
      });

      return {
        statusCode: 200,
        body: result,
      };
    } catch (err: any) {
      appendDebugLog({
        hypothesisId: "G",
        location: "tracking.ts:getJobEvents:error",
        message: "getJobEvents error",
        data: { jobId, tenantId, error: err?.message || String(err) },
      });
      throw err;
    }
  }
}

export const trackingController = new TrackingController();
