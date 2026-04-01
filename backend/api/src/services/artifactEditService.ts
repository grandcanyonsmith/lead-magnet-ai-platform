import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ulid } from "ulid";
import { db } from "../utils/db";
import { ApiError } from "../utils/errors";
import { env } from "../utils/env";
import { logger } from "../utils/logger";
import {
  RESPONSES_TIMEOUT_MS,
  callResponsesWithTimeout,
  stripMarkdownCodeFences,
} from "../utils/openaiHelpers";
import { ArtifactUrlService } from "./artifactUrlService";
import { invalidateCloudFrontPaths } from "./cloudfrontInvalidationService";
import { getOpenAIClient } from "./openaiService";

const ARTIFACTS_TABLE = env.artifactsTable;
const ARTIFACTS_BUCKET = env.artifactsBucket;
const JOBS_TABLE = env.jobsTable;
const ARTIFACT_EDIT_REQUESTS_TABLE = env.artifactEditRequestsTable;

const s3Client = new S3Client({ region: env.awsRegion });

const EDITABLE_CONTENT_TYPES = new Set([
  "text/html",
  "text/plain",
  "text/markdown",
  "application/json",
]);

export type ArtifactEditStatus =
  | "pending"
  | "fetching"
  | "editing"
  | "saving"
  | "completed"
  | "failed";

export interface ArtifactEditRequestRecord {
  edit_id: string;
  tenant_id: string;
  artifact_id: string;
  job_id?: string | null;
  s3_key: string;
  file_name: string;
  content_type: string;
  prompt: string;
  model: string;
  status: ArtifactEditStatus;
  message?: string | null;
  output_url?: string | null;
  error_message?: string | null;
  file_size_bytes?: number | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  ttl: number;
}

export interface ArtifactEditStatusPayload {
  edit_id: string;
  artifact_id: string;
  job_id?: string | null;
  file_name: string;
  content_type: string;
  model: string;
  status: ArtifactEditStatus;
  message?: string | null;
  output_url?: string | null;
  error_message?: string | null;
  file_size_bytes?: number | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

type OwnedArtifact = {
  artifact: Record<string, any>;
  fileName: string;
  contentType: string;
};

type SaveEditedArtifactArgs = {
  artifact: Record<string, any>;
  contentType: string;
  editedContent: string;
};

type SaveEditedArtifactResult = {
  fileSizeBytes: number;
  outputUrl: string | null;
};

function getArtifactsBucket(): string {
  if (!ARTIFACTS_BUCKET) {
    throw new ApiError(
      "ARTIFACTS_BUCKET environment variable is not configured",
      500,
    );
  }
  return ARTIFACTS_BUCKET;
}

function getArtifactsTable(): string {
  if (!ARTIFACTS_TABLE) {
    throw new ApiError(
      "ARTIFACTS_TABLE environment variable is not configured",
      500,
    );
  }
  return ARTIFACTS_TABLE;
}

function getArtifactEditRequestsTable(): string {
  if (!ARTIFACT_EDIT_REQUESTS_TABLE) {
    throw new ApiError(
      "ARTIFACT_EDIT_REQUESTS_TABLE environment variable is not configured",
      500,
    );
  }
  return ARTIFACT_EDIT_REQUESTS_TABLE;
}

function inferContentTypeFromFileName(fileName?: string | null): string | null {
  const lower = String(fileName || "").trim().toLowerCase();
  if (!lower) return null;
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
    return "text/markdown";
  }
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".txt")) return "text/plain";
  return null;
}

function normalizeContentType(
  contentType?: string | null,
  fileName?: string | null,
): string {
  const normalized = String(contentType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  return normalized || inferContentTypeFromFileName(fileName) || "text/plain";
}

function withUtf8Charset(contentType: string): string {
  const normalized = normalizeContentType(contentType);
  if (normalized.startsWith("text/") || normalized === "application/json") {
    return `${normalized}; charset=utf-8`;
  }
  return normalized;
}

function buildCacheBustedUrl(url: string, cacheBuster: string): string {
  if (ArtifactUrlService.isPresignedUrl(url)) {
    return url;
  }

  try {
    const parsed = new URL(url);
    parsed.searchParams.set("v", cacheBuster);
    return parsed.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}v=${encodeURIComponent(cacheBuster)}`;
  }
}

function truncateMessage(value: string, maxLength: number = 160): string {
  const normalized = String(value || "").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function buildEditInstructions(contentType: string, fileName: string): string {
  const normalized = normalizeContentType(contentType, fileName);
  const formatLabel =
    normalized === "application/json"
      ? "JSON document"
      : normalized === "text/html"
        ? "HTML document"
        : normalized === "text/markdown"
          ? "Markdown document"
          : "plain text document";

  const formatSpecificGuard =
    normalized === "application/json"
      ? "Return valid JSON only."
      : normalized === "text/html"
        ? "Return the full updated HTML document."
        : normalized === "text/markdown"
          ? "Return the full updated Markdown file."
          : "Return the full updated text file.";

  return [
    "You are editing a single file based on a user's request.",
    `The file is a ${formatLabel} named "${fileName || "artifact"}".`,
    "Return only the updated file contents.",
    "Do not wrap the result in markdown code fences.",
    "Do not add explanations, commentary, or changelogs.",
    "Preserve unchanged content unless the user explicitly requests otherwise.",
    formatSpecificGuard,
  ].join("\n");
}

function buildEditPrompt(params: {
  fileName: string;
  contentType: string;
  userPrompt: string;
  originalContent: string;
}): string {
  return [
    `File name: ${params.fileName || "artifact"}`,
    `Content type: ${params.contentType}`,
    "",
    "User request:",
    params.userPrompt,
    "",
    "Current file contents:",
    params.originalContent,
  ].join("\n");
}

function isTerminalStatus(status: ArtifactEditStatus): boolean {
  return status === "completed" || status === "failed";
}

export function isEditableArtifactContentType(
  contentType?: string | null,
  fileName?: string | null,
): boolean {
  return EDITABLE_CONTENT_TYPES.has(normalizeContentType(contentType, fileName));
}

export function buildArtifactEditStatusPayload(
  request: ArtifactEditRequestRecord,
): ArtifactEditStatusPayload {
  return {
    edit_id: request.edit_id,
    artifact_id: request.artifact_id,
    job_id: request.job_id || null,
    file_name: request.file_name,
    content_type: request.content_type,
    model: request.model,
    status: request.status,
    message: request.message || null,
    output_url: request.output_url || null,
    error_message: request.error_message || null,
    file_size_bytes: request.file_size_bytes ?? null,
    created_at: request.created_at,
    updated_at: request.updated_at,
    completed_at: request.completed_at || null,
  };
}

export class ArtifactEditService {
  async getOwnedEditableArtifact(
    tenantId: string,
    artifactId: string,
  ): Promise<OwnedArtifact> {
    const artifactsTable = getArtifactsTable();

    const artifact = await db.get(artifactsTable, { artifact_id: artifactId });
    if (!artifact) {
      throw new ApiError("Artifact not found", 404);
    }

    if (artifact.tenant_id !== tenantId) {
      throw new ApiError(
        "You don't have permission to edit this artifact",
        403,
      );
    }

    if (!artifact.s3_key) {
      throw new ApiError("Artifact file is missing storage metadata", 400);
    }

    const fileName =
      String(artifact.artifact_name || artifact.file_name || "").trim() ||
      "artifact";
    if (
      fileName.includes("report.md") ||
      artifact.artifact_type === "report_markdown"
    ) {
      throw new ApiError("This file is not available for editing", 404);
    }

    const contentType = normalizeContentType(
      artifact.mime_type || artifact.content_type,
      fileName,
    );

    if (!isEditableArtifactContentType(contentType, fileName)) {
      throw new ApiError(
        "Only HTML, plain text, Markdown, and JSON artifacts can be edited",
        400,
      );
    }

    return {
      artifact,
      fileName,
      contentType,
    };
  }

  async createRequest(params: {
    tenantId: string;
    artifactId: string;
    prompt: string;
    model: string;
  }): Promise<ArtifactEditRequestRecord> {
    const requestsTable = getArtifactEditRequestsTable();

    const prompt = String(params.prompt || "").trim();
    if (!prompt) {
      throw new ApiError("prompt is required", 400);
    }

    const model = String(params.model || "").trim();
    if (!model) {
      throw new ApiError("model is required", 400);
    }

    const ownedArtifact = await this.getOwnedEditableArtifact(
      params.tenantId,
      params.artifactId,
    );

    const now = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    const request: ArtifactEditRequestRecord = {
      edit_id: `edit_${ulid()}`,
      tenant_id: params.tenantId,
      artifact_id: params.artifactId,
      job_id: ownedArtifact.artifact.job_id || null,
      s3_key: ownedArtifact.artifact.s3_key,
      file_name: ownedArtifact.fileName,
      content_type: ownedArtifact.contentType,
      prompt,
      model,
      status: "pending",
      message: "Queued for editing",
      created_at: now,
      updated_at: now,
      ttl,
    };

    await db.put(requestsTable, request);
    return request;
  }

  async getOwnedRequest(
    tenantId: string,
    editId: string,
  ): Promise<ArtifactEditRequestRecord> {
    const requestsTable = getArtifactEditRequestsTable();

    const request = (await db.get(requestsTable, {
      edit_id: editId,
    })) as ArtifactEditRequestRecord | undefined;

    if (!request || request.tenant_id !== tenantId) {
      throw new ApiError("Artifact edit request not found", 404);
    }

    return request;
  }

  async updateRequest(
    editId: string,
    updates: Partial<ArtifactEditRequestRecord>,
  ): Promise<ArtifactEditRequestRecord> {
    const requestsTable = getArtifactEditRequestsTable();
    return (await db.update(
      requestsTable,
      { edit_id: editId },
      updates,
    )) as ArtifactEditRequestRecord;
  }

  async processRequest(editId: string): Promise<void> {
    const requestsTable = getArtifactEditRequestsTable();
    const request = (await db.get(requestsTable, {
      edit_id: editId,
    })) as ArtifactEditRequestRecord | undefined;

    if (!request) {
      throw new Error(`Artifact edit request ${editId} not found`);
    }

    if (isTerminalStatus(request.status)) {
      logger.info("[ArtifactEditService] Request already terminal, skipping", {
        editId,
        status: request.status,
      });
      return;
    }

    const ownedArtifact = await this.getOwnedEditableArtifact(
      request.tenant_id,
      request.artifact_id,
    );

    try {
      await this.updateRequest(editId, {
        status: "fetching",
        message: "Loading file from storage",
        updated_at: new Date().toISOString(),
      });

      const originalContent = await this.fetchArtifactSource(ownedArtifact.artifact);

      await this.updateRequest(editId, {
        status: "editing",
        message: `Editing ${ownedArtifact.fileName} with ${request.model}`,
        updated_at: new Date().toISOString(),
      });

      const editedContent = await this.generateEditedContent({
        fileName: ownedArtifact.fileName,
        contentType: ownedArtifact.contentType,
        originalContent,
        userPrompt: request.prompt,
        model: request.model,
      });

      await this.updateRequest(editId, {
        status: "saving",
        message: "Saving edited file",
        updated_at: new Date().toISOString(),
      });

      const saveResult = await this.saveEditedArtifact({
        artifact: ownedArtifact.artifact,
        contentType: ownedArtifact.contentType,
        editedContent,
      });

      const completedAt = new Date().toISOString();
      await this.updateRequest(editId, {
        status: "completed",
        message: "File updated and uploaded",
        output_url: saveResult.outputUrl,
        file_size_bytes: saveResult.fileSizeBytes,
        updated_at: completedAt,
        completed_at: completedAt,
        error_message: null,
      });

      if (ownedArtifact.artifact.job_id) {
        await this.touchJob(ownedArtifact.artifact.job_id, completedAt);
      }

      await this.createNotification({
        tenantId: request.tenant_id,
        type: "artifact_edit_completed",
        title: "File edit completed",
        message: `${ownedArtifact.fileName} was updated and saved successfully.`,
        jobId: request.job_id || ownedArtifact.artifact.job_id || null,
      });
    } catch (error: any) {
      const message =
        error instanceof Error ? error.message : "Artifact edit failed";
      logger.error("[ArtifactEditService] Failed to process request", {
        editId,
        artifactId: request.artifact_id,
        error: message,
        stack: error instanceof Error ? error.stack : undefined,
      });

      await this.updateRequest(editId, {
        status: "failed",
        message: "File edit failed",
        error_message: message,
        updated_at: new Date().toISOString(),
      });

      await this.createNotification({
        tenantId: request.tenant_id,
        type: "artifact_edit_failed",
        title: "File edit failed",
        message: `${ownedArtifact.fileName} could not be updated: ${truncateMessage(message)}`,
        jobId: request.job_id || ownedArtifact.artifact.job_id || null,
      });

      throw error;
    }
  }

  private async fetchArtifactSource(artifact: Record<string, any>): Promise<string> {
    const artifactsBucket = getArtifactsBucket();

    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: artifactsBucket,
        Key: artifact.s3_key,
      }),
    );

    if (!response.Body) {
      throw new Error(`Artifact content missing for key ${artifact.s3_key}`);
    }

    return await response.Body.transformToString();
  }

  private async generateEditedContent(params: {
    fileName: string;
    contentType: string;
    originalContent: string;
    userPrompt: string;
    model: string;
  }): Promise<string> {
    const openai = await getOpenAIClient();

    const response = await callResponsesWithTimeout(
      () =>
        openai.responses.create({
          model: params.model,
          instructions: buildEditInstructions(
            params.contentType,
            params.fileName,
          ),
          input: buildEditPrompt(params),
          reasoning: { effort: "high" },
          service_tier: "priority",
          max_output_tokens: 20_000,
        } as any),
      "Artifact edit",
      RESPONSES_TIMEOUT_MS,
    );

    const edited = stripMarkdownCodeFences(
      String((response as any)?.output_text || ""),
    );

    if (!edited.trim()) {
      throw new Error("The model returned an empty file");
    }

    const normalizedContentType = normalizeContentType(
      params.contentType,
      params.fileName,
    );

    if (normalizedContentType === "application/json") {
      try {
        const parsed = JSON.parse(edited);
        return `${JSON.stringify(parsed, null, 2)}\n`;
      } catch (error: any) {
        throw new Error(
          `The edited JSON is invalid: ${error?.message || "parse failure"}`,
        );
      }
    }

    return edited.trim();
  }

  private async saveEditedArtifact(
    params: SaveEditedArtifactArgs,
  ): Promise<SaveEditedArtifactResult> {
    const artifactsBucket = getArtifactsBucket();
    const artifactsTable = getArtifactsTable();

    const now = new Date().toISOString();
    const fileSizeBytes = Buffer.byteLength(params.editedContent, "utf8");

    await s3Client.send(
      new PutObjectCommand({
        Bucket: artifactsBucket,
        Key: params.artifact.s3_key,
        Body: params.editedContent,
        ContentType: withUtf8Charset(params.contentType),
      }),
    );

    let generatedUrl: string | null = null;
    let urlExpiresAt: string | null = null;
    try {
      const generated = await ArtifactUrlService.generateUrl(
        params.artifact.s3_key,
        params.artifact,
      );
      generatedUrl = generated.url;
      urlExpiresAt = generated.expiresAt;
    } catch (error: any) {
      logger.warn("[ArtifactEditService] Failed to generate refreshed artifact URL", {
        artifactId: params.artifact.artifact_id,
        s3Key: params.artifact.s3_key,
        error: error?.message || String(error),
      });
    }

    const publicUrl = generatedUrl
      ? buildCacheBustedUrl(generatedUrl, String(Date.now()))
      : params.artifact.public_url || params.artifact.object_url || null;

    const artifactUpdates: Record<string, any> = {
      file_size_bytes: fileSizeBytes,
      size_bytes: fileSizeBytes,
      mime_type: params.contentType,
      content_type: params.contentType,
      public_url: publicUrl,
      updated_at: now,
    };

    if (urlExpiresAt) {
      artifactUpdates.url_expires_at = urlExpiresAt;
    }

    await db.update(
      artifactsTable,
      { artifact_id: params.artifact.artifact_id },
      artifactUpdates,
    );

    try {
      await invalidateCloudFrontPaths([`/${params.artifact.s3_key}`]);
    } catch (error: any) {
      logger.warn("[ArtifactEditService] CloudFront invalidation failed", {
        artifactId: params.artifact.artifact_id,
        s3Key: params.artifact.s3_key,
        error: error?.message || String(error),
      });
    }

    return {
      fileSizeBytes,
      outputUrl: publicUrl,
    };
  }

  private async touchJob(jobId: string, updatedAt: string): Promise<void> {
    if (!JOBS_TABLE) {
      return;
    }

    try {
      await db.update(
        JOBS_TABLE,
        { job_id: jobId },
        {
          updated_at: updatedAt,
        },
      );
    } catch (error: any) {
      logger.warn("[ArtifactEditService] Failed to update job timestamp", {
        jobId,
        error: error?.message || String(error),
      });
    }
  }

  private async createNotification(params: {
    tenantId: string;
    type: "artifact_edit_completed" | "artifact_edit_failed";
    title: string;
    message: string;
    jobId?: string | null;
  }): Promise<void> {
    try {
      const { notificationsController } = await import("../controllers/notifications");
      await notificationsController.create(
        params.tenantId,
        params.type,
        params.title,
        params.message,
        params.jobId || undefined,
        params.jobId ? "job" : undefined,
      );
    } catch (error: any) {
      logger.warn("[ArtifactEditService] Failed to create notification", {
        tenantId: params.tenantId,
        type: params.type,
        jobId: params.jobId,
        error: error?.message || String(error),
      });
    }
  }
}

export const artifactEditService = new ArtifactEditService();
