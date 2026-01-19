import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { logger } from "../utils/logger";
import { env } from "../utils/env";
import { htmlPatcher, PatchOperation } from "./html/patcher";
import { getOpenAIClient } from "./openaiService";
import { stripMarkdownCodeFences } from "../utils/openaiHelpers";
import { ApiError } from "../utils/errors";
import {
  getPromptOverridesForTenant,
  resolvePromptOverride,
  type PromptOverrides,
} from "./promptOverrides";

const ARTIFACTS_BUCKET = env.artifactsBucket;
const s3Client = new S3Client({ region: env.awsRegion });

export class HtmlPatchService {
  /**
   * Patch an HTML file in S3 with a set of operations.
   */
  async patchHtmlArtifact(
    _tenantId: string,
    s3Key: string,
    patches: PatchOperation[]
  ): Promise<string> {
    logger.info("Patching HTML artifact", { s3Key, patchesCount: patches.length });

    // 1. Fetch original HTML
    let originalHtml = "";
    try {
      const response = await s3Client.send(
        new GetObjectCommand({
          Bucket: ARTIFACTS_BUCKET,
          Key: s3Key,
        })
      );
      originalHtml = await response.Body?.transformToString() || "";
    } catch (error: any) {
      logger.error("Failed to fetch original HTML for patching", { error, s3Key });
      throw new Error(`Failed to fetch original HTML: ${error.message}`);
    }

    // 2. Apply patches
    const patchedHtml = htmlPatcher.applyPatches(originalHtml, patches);

    // 3. Upload patched HTML
    // We overwrite the original key for "patching" semantics, or could save as new version
    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: ARTIFACTS_BUCKET,
          Key: s3Key,
          Body: patchedHtml,
          ContentType: "text/html",
          CacheControl: "no-cache", // Important for immediate updates
        })
      );
    } catch (error: any) {
      logger.error("Failed to upload patched HTML", { error, s3Key });
      throw new Error(`Failed to upload patched HTML: ${error.message}`);
    }

    return patchedHtml;
  }
}

export const htmlPatchService = new HtmlPatchService();

export interface PatchHtmlWithOpenAIParams {
  html: string;
  prompt: string;
  selector?: string | null;
  selectedOuterHtml?: string | null;
  pageUrl?: string | null;
  model?: string | null;
  reasoningEffort?: string | null;
  tenantId?: string;
  promptOverrides?: PromptOverrides;
}

export interface PatchHtmlWithOpenAIResult {
  patchedHtml: string;
  summary: string;
}

/**
 * Patch HTML using OpenAI Responses API.
 * This function takes HTML content and a prompt, then uses OpenAI to modify the HTML accordingly.
 */
export async function patchHtmlWithOpenAI(
  params: PatchHtmlWithOpenAIParams
): Promise<PatchHtmlWithOpenAIResult> {
  const {
    html,
    prompt,
    selector,
    selectedOuterHtml,
    pageUrl,
    model = "gpt-5.2",
    reasoningEffort = "high",
    tenantId,
    promptOverrides,
  } = params;

  if (!html || !html.trim()) {
    throw new ApiError("HTML content is required", 400);
  }

  if (!prompt || !prompt.trim()) {
    throw new ApiError("Prompt is required", 400);
  }

  logger.info("[HtmlPatchService] Starting HTML patch with OpenAI", {
    htmlLength: html.length,
    promptLength: prompt.length,
    model,
    hasSelector: !!selector,
    hasSelectedOuterHtml: !!selectedOuterHtml,
    hasPageUrl: !!pageUrl,
  });

  try {
    const openai = await getOpenAIClient();

    // Build the instruction prompt for OpenAI
    let instruction = "You are an expert HTML editor. Modify the HTML according to the user's request while preserving all functionality, structure, and styling.";
    
    if (selector) {
      instruction += `\n\nFocus on the element(s) matching this CSS selector: ${selector}`;
    }

    if (selectedOuterHtml) {
      instruction += `\n\nThe user has selected this specific HTML element:\n${selectedOuterHtml}`;
    }

    if (pageUrl) {
      instruction += `\n\nThe page URL is: ${pageUrl}`;
    }

    instruction += "\n\nReturn ONLY the complete modified HTML. Do not include explanations, markdown code blocks, or any other text. Just return the raw HTML.";

    // Build the input prompt
    let inputPrompt = `Here is the HTML to modify:\n\n${html}\n\nUser's request: ${prompt}`;

    if (selector) {
      inputPrompt += `\n\nFocus on elements matching: ${selector}`;
    }

    const overrides =
      promptOverrides ?? (tenantId ? await getPromptOverridesForTenant(tenantId) : undefined);
    const resolved = resolvePromptOverride({
      key: "html_patch",
      defaults: {
        instructions: instruction,
        prompt: inputPrompt,
      },
      overrides,
      variables: {
        html,
        user_prompt: prompt,
        selector: selector || undefined,
        selected_outer_html: selectedOuterHtml || undefined,
        page_url: pageUrl || undefined,
        input_prompt: inputPrompt,
      },
    });

    const completionParams: any = {
      model,
      instructions: resolved.instructions,
      input: resolved.prompt,
      service_tier: "priority",
      reasoning: { effort: reasoningEffort },
    };

    const startTime = Date.now();
    const completion = await openai.responses.create(completionParams);
    const duration = Date.now() - startTime;

    logger.info("[HtmlPatchService] OpenAI patch completed", {
      durationMs: duration,
      tokensUsed: (completion as any).usage?.total_tokens,
      modelUsed: (completion as any).model || model,
    });

    if (!(completion as any).output_text) {
      throw new ApiError(
        "OpenAI Responses API returned empty response. output_text is missing.",
        500,
      );
    }

    const patchedHtml = stripMarkdownCodeFences((completion as any).output_text);

    // Generate a brief summary
    const summary = `HTML patched using ${model} with ${reasoningEffort} reasoning effort. ${selector ? `Target selector: ${selector}. ` : ""}Original HTML length: ${html.length} chars, patched HTML length: ${patchedHtml.length} chars.`;

    return {
      patchedHtml,
      summary,
    };
  } catch (error: any) {
    logger.error("[HtmlPatchService] Error patching HTML with OpenAI", {
      error: error.message,
      errorStack: error.stack,
    });
    throw new ApiError(
      error.message || "Failed to patch HTML with OpenAI",
      500,
    );
  }
}
