import { APIGatewayProxyResultV2 } from 'aws-lambda';
import { db } from '../utils/db';
import { logger } from '../utils/logger';
import { env } from '../utils/env';
import { patchHtmlWithOpenAI } from '../services/htmlPatchService';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const HTML_PATCH_REQUESTS_TABLE = env.htmlPatchRequestsTable;
const ARTIFACTS_BUCKET = env.artifactsBucket;
const s3Client = new S3Client({ region: env.awsRegion });

async function fetchFinalHtmlFromS3(tenantId: string, jobId: string): Promise<string> {
  if (!ARTIFACTS_BUCKET) {
    throw new Error("ARTIFACTS_BUCKET environment variable is not configured");
  }

  const s3Key = `${tenantId}/jobs/${jobId}/final.html`;
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: ARTIFACTS_BUCKET,
      Key: s3Key,
    }),
  );

  if (!response.Body) {
    throw new Error("Final HTML not found");
  }

  return await response.Body.transformToString();
}

export async function handleHtmlPatchRequest(event: any): Promise<APIGatewayProxyResultV2> {
  const patchId = event.patch_id;
  const jobId = event.job_id;
  const tenantId = event.tenant_id;

  if (!patchId || !jobId || !tenantId) {
    logger.error('[HtmlPatchHandler] Missing required fields', { event });
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields' }),
    };
  }

  try {
    // Update status to processing
    await db.update(
      HTML_PATCH_REQUESTS_TABLE,
      { patch_id: patchId },
      {
        status: 'processing',
        updated_at: new Date().toISOString(),
      },
    );

    // Get the patch request details
    const patchRequest = await db.get(HTML_PATCH_REQUESTS_TABLE, { patch_id: patchId });
    if (!patchRequest) {
      throw new Error(`Patch request ${patchId} not found`);
    }

    // Fetch HTML from S3
    const html = await fetchFinalHtmlFromS3(tenantId, jobId);

    // Process the patch
    const result = await patchHtmlWithOpenAI({
      html,
      prompt: patchRequest.prompt,
      selector: patchRequest.selector || null,
      selectedOuterHtml: patchRequest.selected_outer_html || null,
      pageUrl: patchRequest.page_url || null,
      model: patchRequest.model || null,
      reasoningEffort: patchRequest.reasoning_effort || null,
    });

    // Store result in S3
    if (!ARTIFACTS_BUCKET) {
      throw new Error("ARTIFACTS_BUCKET environment variable is not configured");
    }

    const resultS3Key = `${tenantId}/patches/${patchId}/result.html`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: ARTIFACTS_BUCKET,
        Key: resultS3Key,
        Body: result.patchedHtml,
        ContentType: 'text/html; charset=utf-8',
      }),
    );

    // Update patch request with success
    const now = new Date().toISOString();
    await db.update(
      HTML_PATCH_REQUESTS_TABLE,
      { patch_id: patchId },
      {
        status: 'completed',
        s3_key: resultS3Key,
        summary: result.summary,
        updated_at: now,
        completed_at: now,
      },
    );

    logger.info('[HtmlPatchHandler] Patch completed successfully', {
      patchId,
      jobId,
      tenantId,
      summaryLength: result.summary.length,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, patchId }),
    };
  } catch (error: any) {
    logger.error('[HtmlPatchHandler] Patch failed', {
      patchId,
      jobId,
      tenantId,
      error: error.message,
      stack: error.stack,
    });

    // Update patch request with failure
    await db.update(
      HTML_PATCH_REQUESTS_TABLE,
      { patch_id: patchId },
      {
        status: 'failed',
        error_message: error.message || String(error),
        updated_at: new Date().toISOString(),
      },
    );

    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Patch processing failed' }),
    };
  }
}

