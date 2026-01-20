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
      // The shell executor logs include job_id in the log messages
      const command = new FilterLogEventsCommand({
        logGroupName: LOG_GROUP_NAME,
        startTime,
        filterPattern: `"${jobId}"`,
        limit,
      });

      const response = await cloudwatchLogs.send(command);
      const events = response.events || [];

      // Format logs as SSE events
      const logs = events.map((event) => ({
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
      const command = new FilterLogEventsCommand({
        logGroupName: LOG_GROUP_NAME,
        startTime,
        filterPattern: `"${jobId}"`,
        limit: 500, // Get more logs for streaming
      });

      const response = await cloudwatchLogs.send(command);
      const events = response.events || [];

      // Format as SSE stream (even though API Gateway doesn't support true streaming,
      // the frontend can parse this format)
      const sseData = events.map((event) => {
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
