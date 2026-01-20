import { RouteResponse } from "../routes";
import { logger } from "../utils/logger";
import { env } from "../utils/env";
import { ApiError } from "../utils/errors";
import { CloudWatchLogsClient, FilterLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { db } from "../utils/db";

const cloudwatchLogs = new CloudWatchLogsClient({ region: env.awsRegion });
const JOBS_TABLE = env.jobsTable;
const LOG_GROUP_NAME = "/aws/lambda/leadmagnet-shell-executor";

export class JobLogsController {
  /**
   * Get recent logs for a job from CloudWatch Logs
   * Returns logs in SSE format for streaming
   */
  async getLogs(
    tenantId: string,
    jobId: string,
    since?: number, // Unix timestamp in milliseconds
    limit: number = 100
  ): Promise<RouteResponse> {
    // Verify job belongs to tenant
    const job = await db.get(JOBS_TABLE, { job_id: jobId });
    if (!job) {
      throw new ApiError("Job not found", 404);
    }
    if (job.tenant_id !== tenantId) {
      throw new ApiError("You don't have permission to access this job", 403);
    }

    const startTime = since || Date.now() - 300000; // Default: last 5 minutes

    try {
      // Filter logs containing the job ID
      // The shell executor logs include job_id in log messages and structured fields
      // Try multiple filter patterns to catch different log formats
      const filterPatterns = [
        `"${jobId}"`, // Direct job ID match
        `"job_id": "${jobId}"`, // JSON structured log
        `"JOB_ID": "${jobId}"`, // Environment variable format
      ];

      // Try first pattern, fallback to others if needed
      let command = new FilterLogEventsCommand({
        logGroupName: LOG_GROUP_NAME,
        startTime,
        filterPattern: filterPatterns[0],
        limit,
      });

      let response;
      try {
        response = await cloudwatchLogs.send(command);
      } catch (error: any) {
        // If filter pattern fails, try without filter (get all logs and filter client-side)
        logger.warn("[JobLogsController] Filter pattern failed, fetching all logs", {
          error: error.message,
          jobId,
        });
        command = new FilterLogEventsCommand({
          logGroupName: LOG_GROUP_NAME,
          startTime,
          limit: limit * 2, // Get more logs to filter client-side
        });
        response = await cloudwatchLogs.send(command);
      }

      const events = response.events || [];

      // Filter events client-side if filter pattern didn't work well
      const filteredEvents = events.filter((event) => {
        const message = event.message || "";
        return (
          message.includes(jobId) ||
          message.includes(`job_id: ${jobId}`) ||
          message.includes(`JOB_ID: ${jobId}`)
        );
      });

      // Format logs as SSE events
      const logs = filteredEvents.map((event) => ({
        type: "log",
        timestamp: event.timestamp ? event.timestamp / 1000 : Date.now() / 1000,
        level: this._parseLogLevel(event.message || ""),
        message: event.message || "",
      }));

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
        },
        body: {
          logs,
          nextToken: response.nextToken,
          hasMore: !!response.nextToken,
          filteredCount: filteredEvents.length,
          totalCount: events.length,
        },
      };
    } catch (error: any) {
      logger.error("[JobLogsController] Error fetching logs", {
        error: error.message,
        jobId,
        stack: error.stack,
      });

      // If log group doesn't exist, return empty logs
      if (error.name === "ResourceNotFoundException") {
        return {
          statusCode: 200,
          body: {
            logs: [],
            nextToken: undefined,
            hasMore: false,
          },
        };
      }

      throw new ApiError(`Failed to fetch logs: ${error.message}`, 500);
    }
  }

  /**
   * Stream logs via Server-Sent Events (SSE)
   * Note: API Gateway Lambda proxy doesn't support true streaming,
   * so this returns logs in SSE format that frontend can parse
   */
  async streamLogs(
    tenantId: string,
    jobId: string,
    since?: number
  ): Promise<RouteResponse> {
    // Verify job belongs to tenant
    const job = await db.get(JOBS_TABLE, { job_id: jobId });
    if (!job) {
      throw new ApiError("Job not found", 404);
    }
    if (job.tenant_id !== tenantId) {
      throw new ApiError("You don't have permission to access this job", 403);
    }

    const startTime = since || Date.now() - 300000; // Default: last 5 minutes

    try {
      // Use same filtering logic as getLogs
      const filterPatterns = [
        `"${jobId}"`,
        `"job_id": "${jobId}"`,
        `"JOB_ID": "${jobId}"`,
      ];

      let command = new FilterLogEventsCommand({
        logGroupName: LOG_GROUP_NAME,
        startTime,
        filterPattern: filterPatterns[0],
        limit: 500,
      });

      let response;
      try {
        response = await cloudwatchLogs.send(command);
      } catch (error: any) {
        logger.warn("[JobLogsController] Filter pattern failed for stream", {
          error: error.message,
          jobId,
        });
        command = new FilterLogEventsCommand({
          logGroupName: LOG_GROUP_NAME,
          startTime,
          limit: 1000,
        });
        response = await cloudwatchLogs.send(command);
      }

      const events = response.events || [];
      
      // Filter client-side
      const filteredEvents = events.filter((event) => {
        const message = event.message || "";
        return (
          message.includes(jobId) ||
          message.includes(`job_id: ${jobId}`) ||
          message.includes(`JOB_ID: ${jobId}`)
        );
      });

      // Format as SSE stream
      const sseData = filteredEvents.map((event) => {
        const log = {
          type: "log",
          timestamp: event.timestamp ? event.timestamp / 1000 : Date.now() / 1000,
          level: this._parseLogLevel(event.message || ""),
          message: event.message || "",
        };
        return `data: ${JSON.stringify(log)}\n\n`;
      }).join("");

      // Add completion event
      const completeEvent = `data: ${JSON.stringify({ type: "complete" })}\n\n`;

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
        body: sseData + completeEvent,
      };
    } catch (error: any) {
      logger.error("[JobLogsController] Error streaming logs", {
        error: error.message,
        jobId,
        stack: error.stack,
      });

      if (error.name === "ResourceNotFoundException") {
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
          },
          body: `data: ${JSON.stringify({ type: "complete" })}\n\n`,
        };
      }

      const errorEvent = `data: ${JSON.stringify({
        type: "error",
        message: error.message || "Failed to fetch logs",
      })}\n\n`;

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "text/event-stream",
        },
        body: errorEvent,
      };
    }
  }

  private _parseLogLevel(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes("error") || lower.includes("exception") || lower.includes("failed")) {
      return "error";
    }
    if (lower.includes("warn") || lower.includes("warning")) {
      return "warn";
    }
    return "info";
  }
}

export const jobLogsController = new JobLogsController();
