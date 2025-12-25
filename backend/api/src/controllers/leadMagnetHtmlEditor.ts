import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ulid } from 'ulid';
import { env } from '../utils/env';
import { db } from '../utils/db';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';
import type { RouteResponse } from '../routes';
import { patchHtmlWithOpenAI } from '../services/htmlPatchService';
import { invalidateCloudFrontPaths } from '../services/cloudfrontInvalidationService';

const JOBS_TABLE = env.jobsTable;
const ARTIFACTS_TABLE = env.artifactsTable;
const ARTIFACTS_BUCKET = env.artifactsBucket;
const s3Client = new S3Client({ region: env.awsRegion });

async function fetchFinalHtmlFromS3(tenantId: string, jobId: string): Promise<string> {
  if (!ARTIFACTS_BUCKET) {
    throw new ApiError('ARTIFACTS_BUCKET environment variable is not configured', 500);
  }

  const s3Key = `${tenantId}/jobs/${jobId}/final.html`;

  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: ARTIFACTS_BUCKET,
      Key: s3Key,
    })
  );

  if (!response.Body) {
    throw new ApiError('Final HTML not found', 404);
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
    if (block.includes('Lead Magnet Editor Overlay')) {
      if (!/Lead Magnet Editor Overlay/i.test(html)) {
        toInject.push(block);
      }
      continue;
    }
    if (block.includes('Lead Magnet Tracking Script')) {
      if (!/Lead Magnet Tracking Script/i.test(html)) {
        toInject.push(block);
      }
      continue;
    }
  }

  if (toInject.length === 0) {
    return html;
  }

  const insertion = `\n${toInject.join('\n')}\n`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${insertion}</body>`);
  }
  return html + insertion;
}

class LeadMagnetHtmlEditorController {
  async patch(jobId: string, body: any): Promise<RouteResponse> {
    if (!jobId) {
      throw new ApiError('Job ID is required', 400);
    }

    const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
    if (!prompt || prompt.trim().length === 0) {
      throw new ApiError('prompt is required', 400);
    }

    const job = await db.get(JOBS_TABLE, { job_id: jobId });
    if (!job) {
      throw new ApiError('Job not found', 404);
    }

    const tenantId = job.tenant_id;
    if (!tenantId) {
      throw new ApiError('Job tenant not found', 404);
    }

    const html = await fetchFinalHtmlFromS3(tenantId, jobId);

    const selector = typeof body?.selector === 'string' ? body.selector : null;
    const selectedOuterHtml =
      typeof body?.selected_outer_html === 'string' ? body.selected_outer_html : null;
    const pageUrl = typeof body?.page_url === 'string' ? body.page_url : null;
    const model = typeof body?.model === 'string' ? body.model : null;
    const reasoningEffort =
      body?.reasoning_effort === 'low' || body?.reasoning_effort === 'medium' || body?.reasoning_effort === 'high'
        ? body.reasoning_effort
        : null;

    // Guardrail: full-document rewrites can be slow/unreliable on large HTML.
    // Encourage element selection (snippet mode) for better latency and fewer upstream failures.
    const MAX_FULL_DOCUMENT_CHARS = 120_000;
    if (!selectedOuterHtml && html.length > MAX_FULL_DOCUMENT_CHARS) {
      throw new ApiError(
        'This lead magnet is large. Select an element before applying an AI patch (faster + more reliable), or use Code mode for full-page edits.',
        400,
        'SELECTION_REQUIRED',
        { htmlLength: html.length, maxFullDocumentChars: MAX_FULL_DOCUMENT_CHARS }
      );
    }

    let patchedHtml: string;
    let summary: string;

    try {
      const res = await patchHtmlWithOpenAI({
        html,
        prompt,
        selector,
        selectedOuterHtml,
        pageUrl,
        model,
        reasoningEffort,
      });
      patchedHtml = res.patchedHtml;
      summary = res.summary;
    } catch (error: any) {
      // Preserve our explicit ApiErrors (validation/config issues).
      if (error instanceof ApiError) {
        throw error;
      }

      const upstreamStatus =
        typeof error?.status === 'number'
          ? error.status
          : typeof error?.statusCode === 'number'
            ? error.statusCode
            : typeof error?.response?.status === 'number'
              ? error.response.status
              : undefined;

      const upstreamMessage = error?.message ? String(error.message) : String(error);

      // Convert transient upstream issues into a consistent, user-friendly error.
      if (upstreamStatus === 429 || upstreamStatus === 503 || (typeof upstreamStatus === 'number' && upstreamStatus >= 500)) {
        throw new ApiError(
          'AI editing is temporarily unavailable. Please try again in a moment.',
          503,
          'SERVICE_UNAVAILABLE',
          { upstreamStatus, upstreamMessage }
        );
      }

      // Unknown failure – treat as internal error.
      throw error;
    }

    logger.info('[LeadMagnetHtmlEditor] Patched HTML', {
      jobId,
      tenantId,
      summaryLength: summary.length,
      patchedLength: patchedHtml.length,
    });

    return {
      statusCode: 200,
      body: {
        patched_html: patchedHtml,
        summary,
      },
    };
  }

  async save(jobId: string, body: any): Promise<RouteResponse> {
    if (!jobId) {
      throw new ApiError('Job ID is required', 400);
    }

    const patchedHtml = typeof body?.patched_html === 'string' ? body.patched_html : '';
    if (!patchedHtml || patchedHtml.trim().length === 0) {
      throw new ApiError('patched_html is required', 400);
    }

    if (!ARTIFACTS_BUCKET) {
      throw new ApiError('ARTIFACTS_BUCKET environment variable is not configured', 500);
    }
    if (!ARTIFACTS_TABLE) {
      throw new ApiError('ARTIFACTS_TABLE environment variable is not configured', 500);
    }

    const job = await db.get(JOBS_TABLE, { job_id: jobId });
    if (!job) {
      throw new ApiError('Job not found', 404);
    }

    const tenantId = job.tenant_id;
    if (!tenantId) {
      throw new ApiError('Job tenant not found', 404);
    }

    // Preserve injected scripts (tracking + editor overlay) even if the patched HTML omitted them.
    const currentHtml = await fetchFinalHtmlFromS3(tenantId, jobId);
    const injectedBlocks = extractInjectedBlocks(currentHtml);
    const htmlToSave = ensureInjectedBlocks(patchedHtml, injectedBlocks);

    const s3Key = `${tenantId}/jobs/${jobId}/final.html`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: ARTIFACTS_BUCKET,
        Key: s3Key,
        Body: htmlToSave,
        ContentType: 'text/html; charset=utf-8',
      })
    );

    const now = new Date().toISOString();
    const artifactId = `art_${ulid()}`;
    const fileSizeBytes = Buffer.byteLength(htmlToSave, 'utf8');

    const publicUrl =
      (typeof job.output_url === 'string' && job.output_url.trim().length > 0
        ? job.output_url.trim()
        : env.cloudfrontDomain
          ? `https://${env.cloudfrontDomain}/${s3Key}`
          : null) || null;

    const artifact = {
      artifact_id: artifactId,
      tenant_id: tenantId,
      job_id: jobId,
      artifact_type: 'html_final',
      artifact_name: 'final.html',
      s3_key: s3Key,
      s3_url: `s3://${ARTIFACTS_BUCKET}/${s3Key}`,
      public_url: publicUrl,
      is_public: true,
      file_size_bytes: fileSizeBytes,
      mime_type: 'text/html',
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
      }
    );

    // Invalidate the specific CloudFront path so the saved HTML shows up immediately.
    try {
      await invalidateCloudFrontPaths([`/${s3Key}`]);
    } catch (error: any) {
      logger.error('[LeadMagnetHtmlEditor] CloudFront invalidation failed', {
        jobId,
        tenantId,
        s3Key,
        error: error?.message || String(error),
      });
      // Non-fatal: the new HTML is saved, but CloudFront may serve cached content until TTL expires.
    }

    logger.info('[LeadMagnetHtmlEditor] Saved patched HTML', {
      jobId,
      tenantId,
      s3Key,
      artifactId,
      fileSizeBytes,
    });

    return {
      statusCode: 200,
      body: {
        message: 'Saved',
        artifact_id: artifactId,
        output_url: publicUrl,
      },
    };
  }
}

export const leadMagnetHtmlEditorController = new LeadMagnetHtmlEditorController();


