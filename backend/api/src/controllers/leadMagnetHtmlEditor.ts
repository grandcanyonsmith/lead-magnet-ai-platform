import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { ulid } from "ulid";
import { env } from "../utils/env";
import { db } from "../utils/db";
import { ApiError } from "../utils/errors";
import { logger } from "../utils/logger";
import type { RouteResponse } from "../routes";
import { invalidateCloudFrontPaths } from "../services/cloudfrontInvalidationService";
import { stripTemplatePlaceholders } from "../utils/htmlSanitizer";

const JOBS_TABLE = env.jobsTable;
const ARTIFACTS_TABLE = env.artifactsTable;
const ARTIFACTS_BUCKET = env.artifactsBucket;
const HTML_PATCH_REQUESTS_TABLE = env.htmlPatchRequestsTable;
const s3Client = new S3Client({ region: env.awsRegion });
const lambdaClient = new LambdaClient({ region: env.awsRegion });

async function fetchFinalHtmlFromS3(
  tenantId: string,
  jobId: string,
): Promise<string> {
  if (!ARTIFACTS_BUCKET) {
    throw new ApiError(
      "ARTIFACTS_BUCKET environment variable is not configured",
      500,
    );
  }

  const s3Key = `${tenantId}/jobs/${jobId}/final.html`;

  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: ARTIFACTS_BUCKET,
      Key: s3Key,
    }),
  );

  if (!response.Body) {
    throw new ApiError("Final HTML not found", 404);
  }

  return await response.Body.transformToString();
}

function extractInjectedBlocks(html: string): string[] {
  const blocks: string[] = [];
  const patterns: RegExp[] = [
    /<!--\s*Lead Magnet Editor Overlay\s*-->[\s\S]*?<\/script>\s*/i,
    /<!--\s*Lead Magnet Tracking Script\s*-->[\s\S]*?<\/script>\s*/i,
  ];

  for (const re of patterns) {
    const match = html.match(re);
    if (match && match[0]) {
      blocks.push(match[0]);
    }
  }
  return blocks;
}

function ensureInjectedBlocks(patchedHtml: string, blocks: string[]): string {
  const html = patchedHtml;
  const toInject: string[] = [];

  for (const block of blocks) {
    if (block.includes("Lead Magnet Editor Overlay")) {
      if (!/Lead Magnet Editor Overlay/i.test(html)) {
        toInject.push(block);
      }
      continue;
    }
    if (block.includes("Lead Magnet Tracking Script")) {
      if (!/Lead Magnet Tracking Script/i.test(html)) {
        toInject.push(block);
      }
      continue;
    }
  }

  if (toInject.length === 0) {
    return html;
  }

  const insertion = `\n${toInject.join("\n")}\n`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${insertion}</body>`);
  }
  return html + insertion;
}

class LeadMagnetHtmlEditorController {
  async patch(jobId: string, body: any): Promise<RouteResponse> {
    if (!jobId) {
      throw new ApiError("Job ID is required", 400);
    }

    const prompt = typeof body?.prompt === "string" ? body.prompt : "";
    if (!prompt || prompt.trim().length === 0) {
      throw new ApiError("prompt is required", 400);
    }

    const job = await db.get(JOBS_TABLE, { job_id: jobId });
    if (!job) {
      throw new ApiError("Job not found", 404);
    }

    const tenantId = job.tenant_id;
    if (!tenantId) {
      throw new ApiError("Job tenant not found", 404);
    }

    // Create patch request
    const patchId = `patch_${ulid()}`;
    const now = new Date().toISOString();
    const selector = typeof body?.selector === "string" ? body.selector : null;
    const selectedOuterHtml =
      typeof body?.selected_outer_html === "string"
        ? body.selected_outer_html
        : null;
    const pageUrl = typeof body?.page_url === "string" ? body.page_url : null;
    // Force GPT-5.2 with max reasoning for all HTML patch requests.
    const model = "gpt-5.2";
    const reasoningEffort = "high";

    // IMPORTANT: Use the latest HTML from the client (unsaved edits included) when provided.
    // This ensures sequential AI edits build on each other without requiring a save between prompts.
    const clientHtml =
      typeof body?.html === "string" && body.html.trim().length > 0
        ? String(body.html)
        : null;

    let inputS3Key: string | null = null;
    if (clientHtml) {
      if (!ARTIFACTS_BUCKET) {
        throw new ApiError(
          "ARTIFACTS_BUCKET environment variable is not configured",
          500,
        );
      }
      inputS3Key = `${tenantId}/patches/${patchId}/input.html`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: ARTIFACTS_BUCKET,
          Key: inputS3Key,
          Body: clientHtml,
          ContentType: "text/html; charset=utf-8",
        }),
      );
    }

    // TTL: 24 hours from now (Unix timestamp)
    const ttl = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

    const patchRequest = {
      patch_id: patchId,
      job_id: jobId,
      tenant_id: tenantId,
      prompt,
      selector,
      selected_outer_html: selectedOuterHtml,
      page_url: pageUrl,
      model,
      reasoning_effort: reasoningEffort,
      ...(inputS3Key ? { input_s3_key: inputS3Key } : {}),
      status: "pending",
      created_at: now,
      updated_at: now,
      ttl,
    };

    // Trigger async processing
    try {
      await db.put(HTML_PATCH_REQUESTS_TABLE, patchRequest);

      if (env.isDevelopment()) {
        // In development, process synchronously to ensure completion before Lambda/process exit
        logger.info("[LeadMagnetHtmlEditor] Local mode - processing patch synchronously", {
          patchId,
          jobId,
        });
        try {
          const { handleHtmlPatchRequest } = await import("./htmlPatchHandler");
          await handleHtmlPatchRequest({
            patch_id: patchId,
            job_id: jobId,
            tenant_id: tenantId,
          });
        } catch (error: any) {
          logger.error("[LeadMagnetHtmlEditor] Error processing patch in local mode", {
            patchId,
            error: error.message,
          });
        }
      } else {
        // In production, invoke Lambda asynchronously
        const functionArn = env.getLambdaFunctionArn();
        const invokeCommand = new InvokeCommand({
          FunctionName: functionArn,
          InvocationType: "Event",
          Payload: JSON.stringify({
            source: "html-patch-request",
            patch_id: patchId,
            job_id: jobId,
            tenant_id: tenantId,
          }),
        });

        await lambdaClient.send(invokeCommand);
        logger.info("[LeadMagnetHtmlEditor] Triggered async patch processing", {
          patchId,
          jobId,
          functionArn,
        });
      }
    } catch (error: any) {
      logger.error("[LeadMagnetHtmlEditor] Failed to trigger async processing", {
        patchId,
        jobId,
        error: error.message,
      });
      await db.update(
        HTML_PATCH_REQUESTS_TABLE,
        { patch_id: patchId },
        {
          status: "failed",
          error_message: `Failed to start processing: ${error.message}`,
          updated_at: new Date().toISOString(),
        },
      );
      throw new ApiError("Failed to start patch processing", 500);
    }

    // Return 202 Accepted with patch ID
    return {
      statusCode: 202,
      body: {
        patch_id: patchId,
        status: "pending",
        message: "Patch request accepted and processing",
      },
    };
  }

  async getPatchStatus(patchId: string): Promise<RouteResponse> {
    if (!patchId) {
      throw new ApiError("Patch ID is required", 400);
    }

    const patchRequest = await db.get(HTML_PATCH_REQUESTS_TABLE, {
      patch_id: patchId,
    });

    if (!patchRequest) {
      throw new ApiError("Patch request not found", 404);
    }

    const response: any = {
      patch_id: patchId,
      status: patchRequest.status,
      created_at: patchRequest.created_at,
      updated_at: patchRequest.updated_at,
    };

    if (patchRequest.status === "completed") {
      // Fetch result from S3 if available
      if (patchRequest.s3_key && ARTIFACTS_BUCKET) {
        try {
          const s3Response = await s3Client.send(
            new GetObjectCommand({
              Bucket: ARTIFACTS_BUCKET,
              Key: patchRequest.s3_key,
            }),
          );

          if (s3Response.Body) {
            const patchedHtml = await s3Response.Body.transformToString();
            response.patched_html = patchedHtml;
            response.summary = patchRequest.summary || null;
          }
        } catch (error: any) {
          logger.error("[LeadMagnetHtmlEditor] Failed to fetch patch result from S3", {
            patchId,
            s3Key: patchRequest.s3_key,
            error: error.message,
          });
          // Don't fail the request, just omit the HTML
        }
      }
    } else if (patchRequest.status === "failed") {
      response.error_message = patchRequest.error_message || null;
    }

    return {
      statusCode: 200,
      body: response,
    };
  }

  async save(jobId: string, body: any): Promise<RouteResponse> {
    if (!jobId) {
      throw new ApiError("Job ID is required", 400);
    }

    const patchedHtml =
      typeof body?.patched_html === "string" ? body.patched_html : "";
    if (!patchedHtml || patchedHtml.trim().length === 0) {
      throw new ApiError("patched_html is required", 400);
    }

    if (!ARTIFACTS_BUCKET) {
      throw new ApiError(
        "ARTIFACTS_BUCKET environment variable is not configured",
        500,
      );
    }
    if (!ARTIFACTS_TABLE) {
      throw new ApiError(
        "ARTIFACTS_TABLE environment variable is not configured",
        500,
      );
    }

    const job = await db.get(JOBS_TABLE, { job_id: jobId });
    if (!job) {
      throw new ApiError("Job not found", 404);
    }

    const tenantId = job.tenant_id;
    if (!tenantId) {
      throw new ApiError("Job tenant not found", 404);
    }

    // Preserve injected scripts (tracking + editor overlay) even if the patched HTML omitted them.
    const currentHtml = await fetchFinalHtmlFromS3(tenantId, jobId);
    const injectedBlocks = extractInjectedBlocks(currentHtml);
    const htmlToSave = ensureInjectedBlocks(patchedHtml, injectedBlocks);
    const sanitizedHtml = stripTemplatePlaceholders(htmlToSave);

    const s3Key = `${tenantId}/jobs/${jobId}/final.html`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: ARTIFACTS_BUCKET,
        Key: s3Key,
        Body: sanitizedHtml,
        ContentType: "text/html; charset=utf-8",
      }),
    );

    const now = new Date().toISOString();
    const artifactId = `art_${ulid()}`;
    const fileSizeBytes = Buffer.byteLength(sanitizedHtml, "utf8");

    const publicUrl =
      (typeof job.output_url === "string" && job.output_url.trim().length > 0
        ? job.output_url.trim()
        : env.cloudfrontDomain
          ? `https://${env.cloudfrontDomain}/${s3Key}`
          : null) || null;

    const artifact = {
      artifact_id: artifactId,
      tenant_id: tenantId,
      job_id: jobId,
      artifact_type: "html_final",
      artifact_name: "final.html",
      s3_key: s3Key,
      s3_url: `s3://${ARTIFACTS_BUCKET}/${s3Key}`,
      public_url: publicUrl,
      is_public: true,
      file_size_bytes: fileSizeBytes,
      mime_type: "text/html",
      created_at: now,
    };

    await db.put(ARTIFACTS_TABLE, artifact);

    const existingArtifacts = Array.isArray(job.artifacts) ? job.artifacts : [];
    const updatedArtifacts = [...existingArtifacts, artifactId];

    await db.update(
      JOBS_TABLE,
      { job_id: jobId },
      {
        artifacts: updatedArtifacts,
        updated_at: now,
        ...(publicUrl ? { output_url: publicUrl } : {}),
      },
    );

    // Invalidate the specific CloudFront path so the saved HTML shows up immediately.
    try {
      await invalidateCloudFrontPaths([`/${s3Key}`]);
    } catch (error: any) {
      logger.error("[LeadMagnetHtmlEditor] CloudFront invalidation failed", {
        jobId,
        tenantId,
        s3Key,
        error: error?.message || String(error),
      });
      // Non-fatal: the new HTML is saved, but CloudFront may serve cached content until TTL expires.
    }

    logger.info("[LeadMagnetHtmlEditor] Saved patched HTML", {
      jobId,
      tenantId,
      s3Key,
      artifactId,
      fileSizeBytes,
    });

    return {
      statusCode: 200,
      body: {
        message: "Saved",
        artifact_id: artifactId,
        output_url: publicUrl,
      },
    };
  }
}

export const leadMagnetHtmlEditorController =
  new LeadMagnetHtmlEditorController();
