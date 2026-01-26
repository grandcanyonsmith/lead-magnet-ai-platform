import { ulid } from "ulid";
import { db } from "@utils/db";
import { logger } from "@utils/logger";
import { env } from "@utils/env";
import { ApiError } from "@utils/errors";
import { JobProcessingUtils } from "./workflow/workflowJobProcessingService";
import { getOpenAIClient } from "@services/openaiService";
import { WorkflowAIService, WorkflowAIEditRequest } from "./workflowAIService";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getPromptOverridesFromSettings } from "@services/promptOverrides";
import { s3Service } from "@services/s3Service";

const JOBS_TABLE = env.jobsTable;
const WORKFLOWS_TABLE = env.workflowsTable;

type ToolChoiceValue = NonNullable<WorkflowAIEditRequest["defaultToolChoice"]>;
type ServiceTier = "auto" | "default" | "flex" | "scale" | "priority";
type ReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh";
type TextVerbosity = "low" | "medium" | "high";

const VALID_TOOL_CHOICES = new Set<ToolChoiceValue>([
  "auto",
  "required",
  "none",
]);
const VALID_SERVICE_TIERS = new Set<ServiceTier>([
  "auto",
  "default",
  "flex",
  "scale",
  "priority",
]);
const VALID_REASONING_EFFORTS = new Set<ReasoningEffort>([
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
]);
const VALID_TEXT_VERBOSITIES = new Set<TextVerbosity>([
  "low",
  "medium",
  "high",
]);
const DEFAULT_REVIEW_SERVICE_TIER: ServiceTier = "priority";
const DEFAULT_REVIEW_REASONING_EFFORT: ReasoningEffort = "high";
const MAX_INLINE_PROMPT_BYTES = 200 * 1024;
const PROMPT_PREVIEW_CHARS = 2000;
const PROMPT_STORAGE_CATEGORY = "workflow-ai-edit-prompts";

type ExecutionHistory = NonNullable<WorkflowAIEditRequest["executionHistory"]>;
type ReferenceExample = NonNullable<WorkflowAIEditRequest["referenceExamples"]>[number];
type ReviewerUser = NonNullable<WorkflowAIEditRequest["reviewerUser"]>;

type WorkflowAIEditRuntimeSettings = {
  defaultToolChoice?: ToolChoiceValue;
  defaultServiceTier?: ServiceTier;
  defaultTextVerbosity?: TextVerbosity;
  reviewServiceTier: ServiceTier;
  reviewReasoningEffort: ReasoningEffort;
  reviewUserId?: string;
  promptOverrides?: ReturnType<typeof getPromptOverridesFromSettings>;
};

type StartWorkflowAIEditInput = {
  tenantId: string;
  workflowId: string;
  userPrompt: string;
  contextJobId?: string;
  requestedByUserId?: string;
};

type ImprovementStatus = "pending" | "approved" | "denied";

class WorkflowAIEditJobService {
  private getSetting<T extends string>(
    value: unknown,
    validSet: Set<T>,
  ): T | undefined {
    if (typeof value !== "string") return undefined;
    return validSet.has(value as T) ? (value as T) : undefined;
  }

  private getSettingOrDefault<T extends string>(
    value: unknown,
    validSet: Set<T>,
    fallback: T,
  ): T {
    return this.getSetting(value, validSet) ?? fallback;
  }

  private resolveReviewUserId(
    settings: Record<string, any> | null | undefined,
    job: Record<string, any>,
  ): string | undefined {
    const reviewUserIdValue =
      typeof settings?.default_workflow_improvement_user_id === "string"
        ? settings.default_workflow_improvement_user_id.trim()
        : "";
    if (reviewUserIdValue && reviewUserIdValue !== "auto") {
      return reviewUserIdValue;
    }
    return typeof job?.requested_by_user_id === "string"
      ? job.requested_by_user_id
      : undefined;
  }

  private async storeUserPromptIfNeeded(params: {
    tenantId: string;
    jobId: string;
    userPrompt: string;
  }): Promise<{
    storedPrompt: string;
    s3Key?: string;
    truncated: boolean;
  }> {
    const { tenantId, jobId, userPrompt } = params;
    if (!userPrompt) {
      return { storedPrompt: userPrompt, truncated: false };
    }

    const promptBytes = Buffer.byteLength(userPrompt, "utf8");
    if (promptBytes <= MAX_INLINE_PROMPT_BYTES) {
      return { storedPrompt: userPrompt, truncated: false };
    }

    const preview = userPrompt.slice(0, PROMPT_PREVIEW_CHARS);
    if (!env.artifactsBucket) {
      logger.warn("[Workflow AI Edit] Large prompt exceeds inline limit", {
        jobId,
        promptBytes,
        hasArtifactsBucket: false,
      });
      return { storedPrompt: preview, truncated: true };
    }

    try {
      const filename = `${jobId}.txt`;
      const s3Key = await s3Service.uploadFile(
        tenantId,
        Buffer.from(userPrompt, "utf8"),
        filename,
        PROMPT_STORAGE_CATEGORY,
        "text/plain",
      );
      logger.info("[Workflow AI Edit] Stored large prompt in S3", {
        jobId,
        promptBytes,
        s3Key,
      });
      return { storedPrompt: preview, s3Key, truncated: true };
    } catch (error: any) {
      logger.warn("[Workflow AI Edit] Failed to store large prompt in S3", {
        jobId,
        promptBytes,
        error: error?.message || String(error),
      });
      return { storedPrompt: preview, truncated: true };
    }
  }

  private resolveRuntimeSettings(
    settings: Record<string, any> | null | undefined,
    job: Record<string, any>,
  ): WorkflowAIEditRuntimeSettings {
    const defaultToolChoice = this.getSetting(
      settings?.default_tool_choice,
      VALID_TOOL_CHOICES,
    );
    const defaultServiceTier = this.getSetting(
      settings?.default_service_tier,
      VALID_SERVICE_TIERS,
    );
    const defaultTextVerbosity = this.getSetting(
      settings?.default_text_verbosity,
      VALID_TEXT_VERBOSITIES,
    );
    const reviewServiceTier = this.getSettingOrDefault(
      settings?.default_workflow_improvement_service_tier,
      VALID_SERVICE_TIERS,
      DEFAULT_REVIEW_SERVICE_TIER,
    );
    const reviewReasoningEffort = this.getSettingOrDefault(
      settings?.default_workflow_improvement_reasoning_effort,
      VALID_REASONING_EFFORTS,
      DEFAULT_REVIEW_REASONING_EFFORT,
    );
    const reviewUserId = this.resolveReviewUserId(settings, job);
    const promptOverrides = getPromptOverridesFromSettings(settings || undefined);

    return {
      defaultToolChoice,
      defaultServiceTier,
      defaultTextVerbosity,
      reviewServiceTier,
      reviewReasoningEffort,
      reviewUserId,
      promptOverrides,
    };
  }

  private async loadReviewerUser(
    tenantId: string,
    reviewUserId: string | undefined,
    usersTable?: string,
  ): Promise<ReviewerUser | undefined> {
    if (!reviewUserId || !usersTable) return undefined;

    try {
      const reviewer = await db.get(usersTable, { user_id: reviewUserId });
      if (reviewer && reviewer.customer_id === tenantId) {
        return {
          user_id: reviewer.user_id,
          name: reviewer.name,
          email: reviewer.email,
          role: reviewer.role,
        };
      }
    } catch (err: any) {
      logger.warn("[Workflow AI Edit] Failed to load reviewer user", {
        reviewUserId,
        error: err?.message || String(err),
      });
    }

    return undefined;
  }

  private async fetchS3Json(
    s3Client: S3Client,
    bucket: string | undefined,
    key: string,
  ): Promise<any | null> {
    try {
      const cmd = new GetObjectCommand({ Bucket: bucket as string, Key: key });
      const res = await s3Client.send(cmd);
      if (res.Body) {
        const str = await res.Body.transformToString();
        return JSON.parse(str);
      }
    } catch (e: any) {
      logger.warn("[WorkflowAI Edit Job] Failed to fetch S3 JSON", {
        key,
        error: e.message,
      });
    }
    return null;
  }

  private async fetchS3Text(
    s3Client: S3Client,
    bucket: string | undefined,
    key: string,
  ): Promise<string | null> {
    try {
      const cmd = new GetObjectCommand({ Bucket: bucket as string, Key: key });
      const res = await s3Client.send(cmd);
      if (res.Body) {
        return await res.Body.transformToString();
      }
    } catch (e: any) {
      logger.warn("[WorkflowAI Edit Job] Failed to fetch S3 Text", {
        key,
        error: e.message,
      });
    }
    return null;
  }

  private async resolveUserPrompt(params: {
    userPrompt: string;
    job: Record<string, any>;
    s3Client: S3Client;
    artifactsBucket: string | undefined;
  }): Promise<string> {
    const { userPrompt, job, s3Client, artifactsBucket } = params;
    const s3Key =
      typeof job?.user_prompt_s3_key === "string"
        ? job.user_prompt_s3_key.trim()
        : "";

    if (s3Key && artifactsBucket) {
      const s3Prompt = await this.fetchS3Text(s3Client, artifactsBucket, s3Key);
      if (s3Prompt) {
        return s3Prompt;
      }
    }

    if (userPrompt) {
      return userPrompt;
    }

    return typeof job?.user_prompt === "string" ? job.user_prompt : "";
  }

  private async loadExecutionHistory(params: {
    contextJobId?: string;
    tenantId: string;
    submissionsTable: string | undefined;
    artifactsTable: string | undefined;
    artifactsBucket: string | undefined;
    s3Client: S3Client;
  }): Promise<ExecutionHistory | undefined> {
    const {
      contextJobId,
      tenantId,
      submissionsTable,
      artifactsTable,
      artifactsBucket,
      s3Client,
    } = params;
    if (!contextJobId) return undefined;

    try {
      const ctxJob = await db.get(JOBS_TABLE, { job_id: contextJobId });
      if (!ctxJob || ctxJob.tenant_id !== tenantId) {
        return undefined;
      }

      const history: ExecutionHistory = {};
      const submissionPromise = ctxJob.submission_id
        ? db.get(submissionsTable as string, { submission_id: ctxJob.submission_id })
        : Promise.resolve(null);
      const stepsPromise = ctxJob.execution_steps_s3_key
        ? this.fetchS3Json(
            s3Client,
            artifactsBucket,
            String(ctxJob.execution_steps_s3_key),
          )
        : Promise.resolve(ctxJob.execution_steps || null);
      let artifactPromise: Promise<string | null> = Promise.resolve(null);
      if (
        artifactsTable &&
        ctxJob.artifacts &&
        Array.isArray(ctxJob.artifacts) &&
        ctxJob.artifacts.length > 0
      ) {
        const finalArtifactId = ctxJob.artifacts[ctxJob.artifacts.length - 1];
        artifactPromise = db
          .get(artifactsTable, { artifact_id: finalArtifactId })
          .then((artifact) => {
            if (artifact && artifact.s3_key) {
              return this.fetchS3Text(
                s3Client,
                artifactsBucket,
                String(artifact.s3_key),
              );
            }
            return null;
          });
      }

      const [submission, steps, finalArtifactText] = await Promise.all([
        submissionPromise,
        stepsPromise,
        artifactPromise,
      ]);

      if (submission) {
        history.submissionData = submission.submission_data;
      }
      if (steps) {
        history.stepExecutionResults = steps;
      }
      if (finalArtifactText) {
        history.finalArtifactSummary = finalArtifactText;
      }

      return history;
    } catch (err: any) {
      logger.error("[WorkflowAI Edit Job] Failed to fetch context job", {
        contextJobId,
        error: err.message,
      });
    }

    return undefined;
  }

  private async loadReferenceExamples(params: {
    workflowId: string;
    contextJobId?: string;
    submissionsTable: string | undefined;
    artifactsTable: string | undefined;
    artifactsBucket: string | undefined;
    s3Client: S3Client;
  }): Promise<ReferenceExample[]> {
    const {
      workflowId,
      contextJobId,
      submissionsTable,
      artifactsTable,
      artifactsBucket,
      s3Client,
    } = params;

    try {
      const examplesRes = await db.query(
        JOBS_TABLE,
        "gsi_workflow_status",
        "workflow_id = :wId AND #s = :s",
        { ":wId": workflowId, ":s": "completed" },
        { "#s": "status" },
        5,
      );

      const potentialExamples = examplesRes.items || [];
      const filtered = potentialExamples.filter(
        (j: any) => j.job_id !== contextJobId,
      );

      const examplePromises = filtered.slice(0, 2).map(async (exJob: any) => {
        const exData: Partial<ReferenceExample> & { jobId: string } = {
          jobId: exJob.job_id,
        };

        const subPromise = exJob.submission_id
          ? db.get(submissionsTable as string, { submission_id: exJob.submission_id })
          : Promise.resolve(null);

        let artPromise: Promise<string | null> = Promise.resolve(null);
        if (
          artifactsTable &&
          exJob.artifacts &&
          Array.isArray(exJob.artifacts) &&
          exJob.artifacts.length > 0
        ) {
          const artId = exJob.artifacts[exJob.artifacts.length - 1];
          artPromise = db
            .get(artifactsTable, { artifact_id: artId })
            .then((art) => {
              if (art && art.s3_key) {
                return this.fetchS3Text(
                  s3Client,
                  artifactsBucket,
                  String(art.s3_key),
                );
              }
              return null;
            });
        }

        const [sub, txt] = await Promise.all([subPromise, artPromise]);
        if (sub) exData.submissionData = sub.submission_data;
        if (txt) exData.finalArtifactSummary = txt;

        if (exData.submissionData && exData.finalArtifactSummary) {
          return exData as ReferenceExample;
        }
        return null;
      });

      const results = await Promise.all(examplePromises);
      return results.filter(Boolean) as ReferenceExample[];
    } catch (err: any) {
      logger.warn("[WorkflowAI Edit Job] Failed to fetch reference examples", {
        error: err.message,
      });
    }

    return [];
  }

  private buildWorkflowAIEditRequest(params: {
    userPrompt: string;
    tenantId: string;
    workflowId: string;
    workflow: Record<string, any>;
    executionHistory?: ExecutionHistory;
    referenceExamples: ReferenceExample[];
    settings: WorkflowAIEditRuntimeSettings;
    reviewerUser?: ReviewerUser;
  }): WorkflowAIEditRequest {
    const {
      userPrompt,
      tenantId,
      workflowId,
      workflow,
      executionHistory,
      referenceExamples,
      settings,
      reviewerUser,
    } = params;
    return {
      userPrompt,
      defaultToolChoice: settings.defaultToolChoice,
      defaultServiceTier: settings.defaultServiceTier,
      defaultTextVerbosity: settings.defaultTextVerbosity,
      reviewServiceTier: settings.reviewServiceTier,
      reviewReasoningEffort: settings.reviewReasoningEffort,
      tenantId,
      promptOverrides: settings.promptOverrides,
      reviewerUser,
      workflowContext: {
        workflow_id: workflowId,
        workflow_name: workflow.workflow_name || "Untitled Workflow",
        workflow_description: workflow.workflow_description || "",
        template_id: workflow.template_id,
        current_steps: workflow.steps || [],
      },
      executionHistory,
      referenceExamples,
    };
  }

  private formatImprovementRecord(job: any): Record<string, any> {
    return {
      job_id: job.job_id,
      workflow_id: job.workflow_id,
      status: job.status,
      improvement_status:
        (job.improvement_status as ImprovementStatus) || "pending",
      created_at: job.created_at,
      updated_at: job.updated_at,
      reviewed_at: job.reviewed_at,
      approved_at: job.approved_at,
      denied_at: job.denied_at,
      user_prompt: job.user_prompt,
      context_job_id: job.context_job_id,
      result: job.result,
    };
  }

  async startWorkflowAIEdit({
    tenantId,
    workflowId,
    userPrompt,
    contextJobId,
    requestedByUserId,
  }: StartWorkflowAIEditInput): Promise<{ jobId: string }> {
    const jobId = `wfaiedit_${ulid()}`;
    const now = new Date().toISOString();
    const promptStorage = await this.storeUserPromptIfNeeded({
      tenantId,
      jobId,
      userPrompt,
    });

    const jobRecord: Record<string, any> = {
      job_id: jobId,
      tenant_id: tenantId,
      workflow_id: workflowId,
      job_type: "workflow_ai_edit",
      status: "pending",
      model: "gpt-5.2",
      user_prompt: promptStorage.storedPrompt,
      user_prompt_s3_key: promptStorage.s3Key,
      user_prompt_truncated: promptStorage.truncated ? true : undefined,
      context_job_id: contextJobId || null,
      requested_by_user_id: requestedByUserId || null,
      result: null,
      error_message: null,
      created_at: now,
      updated_at: now,
    };

    await db.put(JOBS_TABLE, jobRecord);
    logger.info("[Workflow AI Edit] Created job record", {
      jobId,
      tenantId,
      workflowId,
      hasContextJobId: !!contextJobId,
      hasRequestedByUserId: !!requestedByUserId,
    });

    await JobProcessingUtils.triggerAsyncProcessing(
      jobId,
      tenantId,
      {
        source: "workflow-ai-edit-job",
        workflow_id: workflowId,
        user_prompt: promptStorage.storedPrompt,
        context_job_id: contextJobId || null,
      },
      async (localJobId: string, localTenantId: string) => {
        await this.processWorkflowAIEditJob(
          localJobId,
          localTenantId,
          workflowId,
          userPrompt,
          contextJobId,
        );
      },
    );

    return { jobId };
  }

  async getJob(jobId: string): Promise<Record<string, any> | null> {
    const job = await db.get(JOBS_TABLE, { job_id: jobId });
    return job ?? null;
  }

  async ensureLocalProcessing(job: Record<string, any>): Promise<void> {
    if (!job || job.status !== "pending" || !env.isDevelopment()) {
      return;
    }

    const createdAt = new Date(job.created_at).getTime();
    const ageSeconds = (Date.now() - createdAt) / 1000;

    if (Number.isNaN(ageSeconds) || ageSeconds <= 30 || job.processing_attempted) {
      return;
    }

    logger.info("[Workflow AI Edit] Job stuck in pending, attempting to process", {
      jobId: job.job_id,
      ageSeconds,
    });

    await db.update(JOBS_TABLE, { job_id: job.job_id }, {
      processing_attempted: true,
      updated_at: new Date().toISOString(),
    });

    const workflowId = String(job.workflow_id || "");
    const userPrompt = String(job.user_prompt || "");
    const contextJobId = job.context_job_id ? String(job.context_job_id) : undefined;

    setImmediate(async () => {
      try {
        await this.processWorkflowAIEditJob(
          job.job_id,
          job.tenant_id,
          workflowId,
          userPrompt,
          contextJobId,
        );
      } catch (error: any) {
        logger.error("[Workflow AI Edit] Error processing stuck job", {
          jobId: job.job_id,
          error: error.message,
          stack: error.stack,
        });
      }
    });
  }

  async processWorkflowAIEditJob(
    jobId: string,
    tenantId: string,
    workflowId: string,
    userPrompt: string,
    contextJobId?: string,
  ): Promise<void> {
    const submissionsTable = env.submissionsTable;
    const artifactsTable = env.artifactsTable;
    const artifactsBucket = env.artifactsBucket;
    const usersTable = env.usersTable;

    logger.info("[Workflow AI Edit] Processing job", {
      jobId,
      tenantId,
      workflowId,
      hasContextJobId: !!contextJobId,
    });

    const job = await db.get(JOBS_TABLE, { job_id: jobId });
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    try {
      await db.update(JOBS_TABLE, { job_id: jobId }, {
        status: "processing",
        updated_at: new Date().toISOString(),
      });

      // Validate workflow belongs to tenant
      const workflow = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });
      if (!workflow || workflow.deleted_at) {
        throw new Error("This lead magnet doesn't exist or has been removed");
      }
      if (workflow.tenant_id !== tenantId) {
        throw new Error("Unauthorized");
      }

      // ---------------------------------------------------------
      // CONTEXT GATHERING (Parallelized)
      // ---------------------------------------------------------
      const s3Client = new S3Client({ region: env.awsRegion });
      const resolvedUserPrompt = await this.resolveUserPrompt({
        userPrompt,
        job,
        s3Client,
        artifactsBucket,
      });
      const [executionHistory, referenceExamples] = await Promise.all([
        this.loadExecutionHistory({
          contextJobId,
          tenantId,
          submissionsTable,
          artifactsTable,
          artifactsBucket,
          s3Client,
        }),
        this.loadReferenceExamples({
          workflowId,
          contextJobId,
          submissionsTable,
          artifactsTable,
          artifactsBucket,
          s3Client,
        }),
      ]);

      // ---------------------------------------------------------
      // OPENAI CALL
      // ---------------------------------------------------------
      const settingsRecord = env.userSettingsTable
        ? await db.get(env.userSettingsTable, { tenant_id: tenantId })
        : null;
      const runtimeSettings = this.resolveRuntimeSettings(settingsRecord, job);
      const reviewerUser = await this.loadReviewerUser(
        tenantId,
        runtimeSettings.reviewUserId,
        usersTable,
      );

      const openai = await getOpenAIClient();
      const aiService = new WorkflowAIService(openai);

      const aiRequest = this.buildWorkflowAIEditRequest({
        userPrompt: resolvedUserPrompt,
        tenantId,
        workflowId,
        workflow,
        executionHistory,
        referenceExamples,
        settings: runtimeSettings,
        reviewerUser,
      });

      const result = await aiService.editWorkflow(aiRequest);

      await db.update(JOBS_TABLE, { job_id: jobId }, {
        status: "completed",
        result,
        improvement_status: "pending",
        updated_at: new Date().toISOString(),
      });

      logger.info("[Workflow AI Edit] Job completed successfully", {
        jobId,
        workflowId,
        stepCount: result.steps?.length,
      });
    } catch (error: any) {
      const errorMessage = error?.message || "Unknown error";
      logger.error("[Workflow AI Edit] Job failed", {
        jobId,
        workflowId,
        error: errorMessage,
        stack: error?.stack,
      });

      await db.update(JOBS_TABLE, { job_id: jobId }, {
        status: "failed",
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      });

      throw error;
    }
  }

  async listWorkflowAIImprovements(
    tenantId: string,
    workflowId: string,
  ): Promise<Record<string, any>[]> {
    if (!WORKFLOWS_TABLE) {
      throw new ApiError(
        "WORKFLOWS_TABLE environment variable is not configured",
        500,
      );
    }

    if (!JOBS_TABLE) {
      throw new ApiError(
        "JOBS_TABLE environment variable is not configured",
        500,
      );
    }

    const workflow = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });
    if (!workflow || workflow.deleted_at) {
      throw new ApiError("This lead magnet doesn't exist or has been removed", 404);
    }
    if (workflow.tenant_id !== tenantId) {
      throw new ApiError("Unauthorized", 403);
    }

    const result = await db.query(
      JOBS_TABLE,
      "gsi_workflow_status",
      "workflow_id = :workflow_id",
      { ":workflow_id": workflowId },
    );

    const improvements = (result.items || [])
      .filter(
        (job: any) =>
          job.job_type === "workflow_ai_edit" &&
          job.status === "completed" &&
          job.result,
      )
      .sort((a: any, b: any) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });

    return improvements.map((job: any) => this.formatImprovementRecord(job));
  }

  async updateImprovementStatus(
    tenantId: string,
    jobId: string,
    status: ImprovementStatus,
  ): Promise<Record<string, any>> {
    if (!JOBS_TABLE) {
      throw new ApiError(
        "JOBS_TABLE environment variable is not configured",
        500,
      );
    }

    const validStatuses: ImprovementStatus[] = ["pending", "approved", "denied"];
    if (!validStatuses.includes(status)) {
      throw new ApiError("Invalid improvement status", 400);
    }

    const job = await db.get(JOBS_TABLE, { job_id: jobId });
    if (!job) {
      throw new ApiError("Improvement not found", 404);
    }
    if (job.tenant_id !== tenantId) {
      throw new ApiError("Unauthorized", 403);
    }
    if (job.job_type !== "workflow_ai_edit") {
      throw new ApiError("Invalid improvement record", 400);
    }
    if (!job.result) {
      throw new ApiError("Improvement has no result to review", 409);
    }

    const now = new Date().toISOString();
    const updates: Record<string, any> = {
      improvement_status: status,
      updated_at: now,
    };

    if (status === "approved") {
      updates.reviewed_at = now;
      updates.approved_at = now;
    }

    if (status === "denied") {
      updates.reviewed_at = now;
      updates.denied_at = now;
    }

    const updated = await db.update(JOBS_TABLE, { job_id: jobId }, updates);

    return this.formatImprovementRecord(updated);
  }
}

export const workflowAIEditJobService = new WorkflowAIEditJobService();


