import { db } from "../utils/db";
import { ApiError } from "../utils/errors";
import { RouteResponse } from "../routes";
import { artifactsController } from "./artifacts";
import { ulid } from "ulid";
import { logger } from "../utils/logger";
import { env } from "../utils/env";
import { jobExecutionService } from "../services/jobExecutionService";
import { jobService } from "../services/jobs/jobService";
import { submissionPreviewService } from "../services/jobs/submissionPreviewService";
import { shellExecutorUploadsService } from "../services/shellExecutorUploadsService";
import { RequestContext } from "../routes/router";

const JOBS_TABLE = env.jobsTable;
const SUBMISSIONS_TABLE = env.submissionsTable;
const ARTIFACTS_TABLE = env.artifactsTable;
const PRIMARY_DOCUMENT_ARTIFACT_TYPES = new Set([
  "html_final",
  "markdown_final",
  "json_final",
]);
const PRIMARY_DOCUMENT_FILE_NAMES = new Set([
  "final.html",
  "final.htm",
  "final.md",
  "final.markdown",
  "final.json",
]);

class JobsController {
  private buildStatusPayload(job: any) {
    return {
      job_id: job.job_id,
      status: job.status,
      updated_at: job.updated_at,
      started_at: job.started_at || null,
      completed_at: job.completed_at || null,
      failed_at: job.failed_at || null,
      live_step: job.live_step ?? null,
      execution_steps_s3_key: job.execution_steps_s3_key || null,
    };
  }

  private isTerminalStatus(status: unknown): boolean {
    return status !== "pending" && status !== "processing";
  }

  private getArtifactFileName(artifact: any): string {
    return String(artifact?.artifact_name || artifact?.file_name || "")
      .trim()
      .toLowerCase();
  }

  private isInternalReportArtifact(artifact: any): boolean {
    const artifactType = String(artifact?.artifact_type || "").toLowerCase();
    const fileName = this.getArtifactFileName(artifact);

    return artifactType === "report_markdown" || fileName.includes("report.md");
  }

  private isPrimaryDocumentArtifact(artifact: any): boolean {
    const artifactType = String(artifact?.artifact_type || "").toLowerCase();
    const fileName = this.getArtifactFileName(artifact);

    return (
      PRIMARY_DOCUMENT_ARTIFACT_TYPES.has(artifactType) ||
      PRIMARY_DOCUMENT_FILE_NAMES.has(fileName)
    );
  }

  private async resolveDocumentArtifactId(job: any): Promise<string | null> {
    if (!ARTIFACTS_TABLE) {
      throw new ApiError(
        "ARTIFACTS_TABLE environment variable is not configured",
        500,
      );
    }

    const artifactIds = Array.isArray(job?.artifacts)
      ? job.artifacts.filter(
          (artifactId: unknown): artifactId is string =>
            typeof artifactId === "string" && artifactId.trim() !== "",
        )
      : [];

    if (artifactIds.length === 0) {
      return null;
    }

    let artifacts: any[] = [];

    try {
      artifacts = await db.batchGet(
        ARTIFACTS_TABLE,
        artifactIds.map((artifactId: string) => ({ artifact_id: artifactId })),
      );
    } catch (error) {
      logger.warn(
        `[JobsController] Failed to batch fetch artifacts for job ${job.job_id}`,
        { error },
      );
    }

    const artifactMap = new Map(
      artifacts
        .filter((artifact) => artifact?.artifact_id)
        .map((artifact) => [artifact.artifact_id, artifact]),
    );
    const artifactsInJobOrder = artifactIds
      .map((artifactId: string) => artifactMap.get(artifactId))
      .filter(Boolean);

    const outputUrl = String(job?.output_url || "").trim();
    if (outputUrl) {
      const matchingArtifact = artifactsInJobOrder.find((artifact: any) => {
        const publicUrl = String(artifact?.public_url || "").trim();
        const objectUrl = String(artifact?.object_url || "").trim();
        return publicUrl === outputUrl || objectUrl === outputUrl;
      });

      if (matchingArtifact?.artifact_id) {
        return matchingArtifact.artifact_id;
      }
    }

    const primaryArtifact = artifactsInJobOrder.find((artifact: any) =>
      this.isPrimaryDocumentArtifact(artifact),
    );
    if (primaryArtifact?.artifact_id) {
      return primaryArtifact.artifact_id;
    }

    const fallbackArtifact = artifactsInJobOrder.find(
      (artifact: any) => !this.isInternalReportArtifact(artifact),
    );
    if (fallbackArtifact?.artifact_id) {
      return fallbackArtifact.artifact_id;
    }

    return artifactIds[1] || artifactIds[0] || null;
  }

  async list(
    tenantId: string,
    queryParams: Record<string, any>,
  ): Promise<RouteResponse> {
    const { jobs, totalCount, hasMore, offset, limit } = await jobService.listJobs(tenantId, queryParams);
    
    // Enrich with submission previews
    const jobsWithSubmissions = await submissionPreviewService.attachPreviewsToJobs(jobs);

    return {
      statusCode: 200,
      body: {
        jobs: jobsWithSubmissions,
        count: jobsWithSubmissions.length,
        total: totalCount,
        offset: offset || 0,
        limit: limit || 20,
        has_more: hasMore,
      },
    };
  }

  async get(tenantId: string, jobId: string): Promise<RouteResponse> {
    const job = await jobService.getJob(tenantId, jobId);

    return {
      statusCode: 200,
      body: job,
    };
  }

  async getStatus(tenantId: string, jobId: string): Promise<RouteResponse> {
    const job = await db.get(JOBS_TABLE, { job_id: jobId });

    if (!job) {
      throw new ApiError("This generated lead magnet doesn't exist", 404);
    }

    if (job.tenant_id !== tenantId) {
      throw new ApiError(
        "You don't have permission to access this lead magnet",
        403,
      );
    }

    return {
      statusCode: 200,
      body: this.buildStatusPayload(job),
    };
  }

  async streamStatus(
    tenantId: string,
    jobId: string,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    const job = await db.get(JOBS_TABLE, { job_id: jobId });

    if (!job) {
      throw new ApiError("This generated lead magnet doesn't exist", 404);
    }

    if (job.tenant_id !== tenantId) {
      throw new ApiError(
        "You don't have permission to access this lead magnet",
        403,
      );
    }

    const res = (context as RequestContext & { res?: any } | undefined)?.res;
    const initialPayload = this.buildStatusPayload(job);

    if (!res) {
      return {
        statusCode: 202,
        body: {
          fallback: true,
          message: "Live streaming unavailable in this runtime. Use polling instead.",
          ...initialPayload,
        },
      };
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    const sendEvent = (eventName: string, payload: Record<string, any>) => {
      if (res.writableEnded) {
        return;
      }
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const sendHeartbeat = () => {
      if (!res.writableEnded) {
        res.write(": keep-alive\n\n");
      }
    };

    sendEvent("snapshot", initialPayload);

    if (this.isTerminalStatus(initialPayload.status)) {
      sendEvent("complete", initialPayload);
      res.end();
      return { statusCode: 200, body: { handled: true } };
    }

    await new Promise<void>((resolve) => {
      let closed = false;
      let pollTimer: ReturnType<typeof setTimeout> | null = null;
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
      let lastSerialized = JSON.stringify(initialPayload);

      const cleanup = () => {
        if (closed) {
          return;
        }
        closed = true;
        if (pollTimer) {
          clearTimeout(pollTimer);
          pollTimer = null;
        }
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        res.off?.("close", cleanup);
        res.off?.("error", onStreamError);
        resolve();
      };

      const onStreamError = (error: unknown) => {
        logger.warn("[JobsController] Job status SSE stream error", {
          jobId,
          error: error instanceof Error ? error.message : String(error),
        });
        cleanup();
      };

      const endStream = () => {
        if (!res.writableEnded) {
          res.end();
        }
        cleanup();
      };

      const schedulePoll = () => {
        pollTimer = setTimeout(() => {
          void pollForUpdates();
        }, 750);
      };

      const pollForUpdates = async () => {
        if (closed || res.writableEnded) {
          cleanup();
          return;
        }

        try {
          const nextJob = await db.get(JOBS_TABLE, { job_id: jobId });
          if (!nextJob) {
            sendEvent("error", {
              job_id: jobId,
              message: "Job no longer exists",
            });
            endStream();
            return;
          }

          if (nextJob.tenant_id !== tenantId) {
            sendEvent("error", {
              job_id: jobId,
              message: "You don't have permission to access this lead magnet",
            });
            endStream();
            return;
          }

          const nextPayload = this.buildStatusPayload(nextJob);
          const nextSerialized = JSON.stringify(nextPayload);
          if (nextSerialized !== lastSerialized) {
            lastSerialized = nextSerialized;
            sendEvent("update", nextPayload);
          }

          if (this.isTerminalStatus(nextPayload.status)) {
            sendEvent("complete", nextPayload);
            endStream();
            return;
          }
        } catch (error) {
          logger.error("[JobsController] Failed to stream job status", {
            jobId,
            error: error instanceof Error ? error.message : String(error),
          });
          sendEvent("error", {
            job_id: jobId,
            message:
              error instanceof Error
                ? error.message
                : "Failed to stream job updates",
          });
          endStream();
          return;
        }

        schedulePoll();
      };

      res.on?.("close", cleanup);
      res.on?.("error", onStreamError);

      heartbeatTimer = setInterval(sendHeartbeat, 15000);
      schedulePoll();
    });

    return { statusCode: 200, body: { handled: true } };
  }

  async getAutoUploads(
    tenantId: string,
    jobId: string,
    query: Record<string, any>,
  ): Promise<RouteResponse> {
    const job = await db.get(JOBS_TABLE, { job_id: jobId });

    if (!job) {
      throw new ApiError("Job not found", 404);
    }

    if (job.tenant_id !== tenantId) {
      throw new ApiError(
        "You don't have permission to access this lead magnet",
        403,
      );
    }

    const subdir =
      typeof query?.subdir === "string" && query.subdir.trim()
        ? query.subdir.trim()
        : undefined;

    const result = await shellExecutorUploadsService.listJobUploads({
      tenantId: job.tenant_id,
      jobId: job.job_id,
      subdir,
    });

    return {
      statusCode: 200,
      body: result,
    };
  }

  async getAutoUploadContent(
    tenantId: string,
    jobId: string,
    query: Record<string, any>,
  ): Promise<RouteResponse> {
    const job = await db.get(JOBS_TABLE, { job_id: jobId });

    if (!job) {
      throw new ApiError("Job not found", 404);
    }

    if (job.tenant_id !== tenantId) {
      throw new ApiError(
        "You don't have permission to access this lead magnet",
        403,
      );
    }

    const key =
      typeof query?.key === "string" && query.key.trim() ? query.key.trim() : "";

    if (!key) {
      throw new ApiError("Auto upload key is required", 400);
    }

    const result = await shellExecutorUploadsService.getJobUploadContent({
      tenantId: job.tenant_id,
      jobId: job.job_id,
      key,
    });

    const contentType = result.contentType.includes("charset")
      ? result.contentType
      : `${result.contentType}; charset=utf-8`;

    return {
      statusCode: 200,
      body: result.content,
      headers: {
        "Content-Type": contentType,
      },
    };
  }


  /**
   * Get the final document for a job by serving the final artifact content.
   * This endpoint proxies the artifact content to avoid CloudFront redirect issues.
   */
  async getDocument(tenantId: string, jobId: string): Promise<RouteResponse> {
    const job = await db.get(JOBS_TABLE, { job_id: jobId });

    if (!job) {
      throw new ApiError("Job not found", 404);
    }

    if (job.tenant_id !== tenantId) {
      throw new ApiError("You don't have permission to access this job", 403);
    }

    // Find the final artifact (typically the last one, or one with type 'html_final' or 'markdown_final')
    if (
      !job.artifacts ||
      !Array.isArray(job.artifacts) ||
      job.artifacts.length === 0
    ) {
      throw new ApiError("No artifacts found for this job", 404);
    }

    const finalArtifactId = await this.resolveDocumentArtifactId(job);

    if (!finalArtifactId) {
      throw new ApiError("Final artifact not found", 404);
    }

    // Use artifacts controller to get content
    return await artifactsController.getContent(tenantId, finalArtifactId);
  }

  async getPublicStatus(jobId: string): Promise<RouteResponse> {
    const job = await db.get(JOBS_TABLE, { job_id: jobId });

    if (!job) {
      throw new ApiError("Job not found", 404);
    }

    // Return only public status information (no sensitive data)
    return {
      statusCode: 200,
      body: {
        job_id: job.job_id,
        status: job.status,
        output_url: job.output_url || null,
        error_message: job.error_message || null,
        created_at: job.created_at,
        completed_at: job.completed_at || null,
      },
    };
  }

  async resubmit(tenantId: string, jobId: string): Promise<RouteResponse> {
    // Get the original job
    const originalJob = await db.get(JOBS_TABLE, { job_id: jobId });

    if (!originalJob) {
      throw new ApiError("This generated lead magnet doesn't exist", 404);
    }

    if (originalJob.tenant_id !== tenantId) {
      throw new ApiError(
        "You don't have permission to resubmit this lead magnet",
        403,
      );
    }

    // Get the submission data
    if (!originalJob.submission_id) {
      throw new ApiError("Cannot resubmit: original submission not found", 400);
    }

    const submission = await db.get(SUBMISSIONS_TABLE, {
      submission_id: originalJob.submission_id,
    });
    if (!submission) {
      throw new ApiError("Cannot resubmit: submission data not found", 404);
    }

    if (submission.tenant_id !== tenantId) {
      throw new ApiError(
        "You don't have permission to resubmit this lead magnet",
        403,
      );
    }

    // Create a new submission record (copy of the original)
    const newSubmissionId = `sub_${ulid()}`;
    const newSubmission = {
      submission_id: newSubmissionId,
      tenant_id: submission.tenant_id,
      form_id: submission.form_id,
      workflow_id: submission.workflow_id,
      submission_data: submission.submission_data,
      submitter_ip: submission.submitter_ip || null,
      submitter_email: submission.submitter_email || null,
      submitter_phone: submission.submitter_phone || null,
      submitter_name: submission.submitter_name || null,
      created_at: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90 days
    };

    await db.put(SUBMISSIONS_TABLE, newSubmission);

    // Create new job record
    const newJobId = `job_${ulid()}`;
    const apiUrl = (env.apiGatewayUrl || env.apiUrl || "").replace(/\/$/, "");
    const newJob = {
      job_id: newJobId,
      tenant_id: originalJob.tenant_id,
      workflow_id: originalJob.workflow_id,
      submission_id: newSubmissionId,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Preserve job-scoped api_url when resubmitting so downstream tracking injection works.
      ...(originalJob.api_url
        ? { api_url: originalJob.api_url }
        : apiUrl
          ? { api_url: apiUrl }
          : {}),
    };

    await db.put(JOBS_TABLE, newJob);

    // Update submission with job_id
    await db.update(
      SUBMISSIONS_TABLE,
      { submission_id: newSubmissionId },
      { job_id: newJobId },
    );

    // Start job processing
    await jobExecutionService.startJobProcessing({
      jobId: newJobId,
      tenantId: originalJob.tenant_id,
      workflowId: originalJob.workflow_id,
      submissionId: newSubmissionId,
    });

    return {
      statusCode: 200,
      body: {
        job_id: newJobId,
        status: "pending",
        message: "Job resubmitted successfully",
      },
    };
  }

  /**
   * Public document endpoint.
   *
   * This proxies the final artifact content by job ID without requiring auth.
   * It is safe because the final output URL is already treated as public (via CloudFront/S3).
   */
  async getPublicDocument(jobId: string): Promise<RouteResponse> {
    const job = await db.get(JOBS_TABLE, { job_id: jobId });

    if (!job) {
      throw new ApiError("Job not found", 404);
    }

    const tenantId = job.tenant_id;
    if (!tenantId) {
      throw new ApiError("Job tenant not found", 404);
    }

    // Reuse the same logic as the authenticated document endpoint: prefer html_final/markdown_final.
    if (
      !job.artifacts ||
      !Array.isArray(job.artifacts) ||
      job.artifacts.length === 0
    ) {
      throw new ApiError("No artifacts found for this job", 404);
    }

    const finalArtifactId = await this.resolveDocumentArtifactId(job);
    if (!finalArtifactId) {
      throw new ApiError("Final artifact not found", 404);
    }

    return await artifactsController.getContent(tenantId, finalArtifactId);
  }
}

export const jobsController = new JobsController();
