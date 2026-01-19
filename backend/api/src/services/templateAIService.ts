import { patchHtmlWithOpenAI } from "./htmlPatchService";
import OpenAI from "openai";
import { getOpenAIClient } from "./openaiService";
import { stripMarkdownCodeFences } from "../utils/openaiHelpers";
import { calculateOpenAICost } from "./costService";
import {
  usageTrackingService,
  type UsageTrackingParams,
} from "./usageTrackingService";
import { logger } from "../utils/logger";
import { ApiError } from "../utils/errors";
import {
  getPromptOverridesForTenant,
  resolvePromptOverride,
  type PromptOverrides,
} from "./promptOverrides";

export interface UsageInfo {
  service_type: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface TemplateGenerationRequest {
  description: string;
  model?: string;
  tenantId: string;
  jobId?: string;
  brandContext?: string;
  icpContext?: string;
  promptOverrides?: PromptOverrides;
}

export interface TemplateRefinementRequest {
  current_html: string;
  edit_prompt: string;
  model?: string;
  tenantId: string;
  jobId?: string;
  selectors?: string[];
  promptOverrides?: PromptOverrides;
}

export type StoreUsageRecordFn = (params: UsageTrackingParams) => Promise<void>;

export type TemplateAIServiceDeps = {
  /**
   * Optional injected OpenAI client (useful in job-style flows where a client is already created).
   */
  openai?: OpenAI;
  /**
   * Optional injected usage recorder (defaults to usageTrackingService.storeUsageRecord).
   */
  storeUsageRecord?: StoreUsageRecordFn;
};

/**
 * Service for generating and refining templates using AI.
 */
export class TemplateAIService {
  constructor(private readonly deps: TemplateAIServiceDeps = {}) {}

  /**
   * Generate template HTML only.
   * Used by workflow generation and by the templates endpoint (via generateWithAI).
   */
  async generateTemplateHTML(
    request: TemplateGenerationRequest,
  ): Promise<{ htmlContent: string; usageInfo: UsageInfo }> {
    const {
      description,
      tenantId,
      jobId,
      brandContext,
      icpContext,
      promptOverrides,
    } = request;
    const model = "gpt-5.2";

    if (!description || !description.trim()) {
      throw new ApiError("Description is required", 400);
    }

    const contextSection = this.buildContextSection(brandContext, icpContext);
    const prompt = `You are a World-Class UI/UX Designer and Frontend Developer.
Task: Create a stunning, high-converting HTML template for a lead magnet described as: "${description}"${contextSection}

## Design Philosophy
- **Modern & Clean**: Use ample whitespace, professional typography, and a refined color palette.
- **Conversion Focused**: The design should encourage reading and engagement.
- **Mobile-First**: It must look perfect on phones.
- **Brand Aligned**: If brand context is provided, strictly adhere to it.

## Technical Requirements
1. **Valid HTML5**: Semantic tags (<header>, <main>, <article>, <footer>).
2. **Inline CSS**: All styling must be in a <style> block within the <head>. No external links.
3. **Responsive**: Use media queries for mobile/tablet layouts.
4. **Typography**: Use system fonts or import a Google Font in the <style> tag.
5. **No Placeholders**: Use *realistic* sample content (headings, paragraphs, lists) that fits the description.
6. **Structure**:
   - **Hero Section**: Title, subtitle.
   - **Content Body**: Readable width (max-width: 800px), good line-height.
   - **Key Takeaways/Summary Box**: Distinct styling.
   - **Call to Action (CTA)**: A placeholder button or link at the bottom.

## Output
Return ONLY the raw HTML code. No Markdown code blocks.`;

    const overrides =
      promptOverrides ?? (await getPromptOverridesForTenant(tenantId));
    const resolved = resolvePromptOverride({
      key: "template_html_generation",
      defaults: {
        instructions:
          "You are an expert HTML template designer. Return only valid HTML code without markdown formatting.",
        prompt,
      },
      overrides,
      variables: {
        description,
        brand_context: brandContext,
        icp_context: icpContext,
        context_section: contextSection,
      },
    });

    logger.info(
      "[Template Generation] Calling OpenAI for template HTML generation...",
      {
        tenantId,
        model,
        jobId,
        promptLength: resolved.prompt?.length || 0,
      },
    );

    const openai = await this.getOpenAI();
    const startTime = Date.now();

    const completionParams: any = {
      model,
      instructions: resolved.instructions,
      input: resolved.prompt,
      service_tier: "priority",
      reasoning: { effort: "high" },
    };
    // gpt-5.1-codex handles temperature differently or defaults are fine
    // if (!model.startsWith('gpt-5')) {
    //   completionParams.temperature = 0.7;
    // }

    const completion = await openai.responses.create(completionParams);

    const duration = Date.now() - startTime;
    const modelUsed = (completion as any).model || model;
    logger.info("[Template Generation] Template HTML generation completed", {
      tenantId,
      jobId,
      durationMs: duration,
      tokensUsed: (completion as any).usage?.total_tokens,
      modelUsed,
    });

    const usageInfo = await this.trackUsage({
      tenantId,
      jobId,
      serviceType: "openai_template_generate",
      modelUsed,
      usage: (completion as any).usage,
    });

    if (!(completion as any).output_text) {
      throw new ApiError(
        "OpenAI Responses API returned empty response. output_text is missing for template HTML generation.",
        500,
      );
    }

    const cleanedHtml = stripMarkdownCodeFences(
      (completion as any).output_text,
    );
    return { htmlContent: cleanedHtml, usageInfo };
  }

  /**
   * Generate template name + description only.
   * Used by workflow generation and by the templates endpoint (via generateWithAI).
   */
  async generateTemplateMetadata(
    request: TemplateGenerationRequest,
  ): Promise<{
    templateName: string;
    templateDescription: string;
    usageInfo: UsageInfo;
  }> {
    const {
      description,
      tenantId,
      jobId,
      brandContext,
      icpContext,
      promptOverrides,
    } = request;
    const model = "gpt-5.2";

    if (!description || !description.trim()) {
      throw new ApiError("Description is required", 400);
    }

    const contextSection = this.buildContextSection(brandContext, icpContext);
    const prompt = `Based on this lead magnet: "${description}"${contextSection}, generate:
1. A short, descriptive template name (2-4 words max)
2. A brief template description (1-2 sentences)

## Guidelines
- **Name**: Should be evocative (e.g., "Minimalist Growth", "Corporate Insight").
- **Description**: Highlight who it's for and the vibe (e.g., "Clean layout perfect for B2B whitepapers.").

Return JSON format: {"name": "...", "description": "..."}`;

    const overrides =
      promptOverrides ?? (await getPromptOverridesForTenant(tenantId));
    const resolved = resolvePromptOverride({
      key: "template_metadata_generation",
      defaults: { prompt },
      overrides,
      variables: {
        description,
        brand_context: brandContext,
        icp_context: icpContext,
        context_section: contextSection,
      },
    });

    logger.info(
      "[Template Generation] Calling OpenAI for template name/description generation...",
      {
        tenantId,
        model,
        jobId,
        promptLength: resolved.prompt?.length || 0,
      },
    );

    const openai = await this.getOpenAI();
    const startTime = Date.now();

    const completionParams: any = {
      model,
      input: resolved.prompt,
      service_tier: "priority",
      reasoning: { effort: "high" },
    };
    if (resolved.instructions) {
      completionParams.instructions = resolved.instructions;
    }
    // if (!model.startsWith('gpt-5')) {
    //   completionParams.temperature = 0.5;
    // }

    const completion = await openai.responses.create(completionParams);

    const duration = Date.now() - startTime;
    const modelUsed = (completion as any).model || model;
    logger.info(
      "[Template Generation] Template name/description generation completed",
      {
        tenantId,
        jobId,
        durationMs: duration,
        modelUsed,
      },
    );

    const usageInfo = await this.trackUsage({
      tenantId,
      jobId,
      serviceType: "openai_template_generate",
      modelUsed,
      usage: (completion as any).usage,
    });

    if (!(completion as any).output_text) {
      throw new ApiError(
        "OpenAI Responses API returned empty response. output_text is missing for template name generation.",
        500,
      );
    }

    const content = String((completion as any).output_text);
    let templateName = "Generated Template";
    let templateDescription =
      "A professional HTML template for displaying lead magnet content";

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        templateName = parsed.name || templateName;
        templateDescription = parsed.description || templateDescription;
      }
    } catch (e) {
      logger.warn(
        "[Template Generation] Failed to parse template name JSON, using defaults",
        {
          tenantId,
          jobId,
          error: e instanceof Error ? e.message : String(e),
        },
      );
    }

    return { templateName, templateDescription, usageInfo };
  }

  /**
   * Generate a template with AI.
   */
  async generateWithAI(request: TemplateGenerationRequest): Promise<{
    template_name: string;
    template_description: string;
    html_content: string;
    placeholder_tags: string[];
  }> {
    const { tenantId, model = "gpt-5.2", jobId } = request;

    logger.info("[Template Generation] Starting AI generation", {
      tenantId,
      model,
      jobId,
      descriptionLength: request.description?.length,
      timestamp: new Date().toISOString(),
    });

    const htmlResult = await this.generateTemplateHTML(request);
    const metadataResult = await this.generateTemplateMetadata(request);

    // Placeholder extraction disabled - no longer using placeholder syntax.
    const placeholderTags: string[] = [];

    return {
      template_name: metadataResult.templateName,
      template_description: metadataResult.templateDescription,
      html_content: htmlResult.htmlContent,
      placeholder_tags: placeholderTags,
    };
  }

  /**
   * Refine a template with AI.
   */
  async refineWithAI(request: TemplateRefinementRequest): Promise<{
    html_content: string;
    placeholder_tags: string[];
  }> {
    const {
      current_html,
      edit_prompt,
      model = "gpt-5.2",
      tenantId,
      jobId,
      selectors,
      promptOverrides,
    } = request;

    if (!current_html || !current_html.trim()) {
      throw new ApiError("Current HTML content is required", 400);
    }

    if (!edit_prompt || !edit_prompt.trim()) {
      throw new ApiError("Edit prompt is required", 400);
    }

    logger.info("[Template Refinement] Starting refinement", {
      tenantId,
      model,
      jobId,
      currentHtmlLength: current_html.length,
      editPromptLength: edit_prompt.length,
      selectorsCount: selectors?.length,
      timestamp: new Date().toISOString(),
    });

    try {
      const selector =
        selectors && selectors.length > 0 ? selectors.join(", ") : undefined;

      // Check if user wants to remove placeholders
      const shouldRemovePlaceholders =
        edit_prompt.toLowerCase().includes("remove placeholder") ||
        edit_prompt.toLowerCase().includes("no placeholder") ||
        edit_prompt.toLowerCase().includes("dont use placeholder") ||
        edit_prompt.toLowerCase().includes("don't use placeholder");

      let augmentedPrompt = edit_prompt;
      if (shouldRemovePlaceholders) {
        augmentedPrompt +=
          "\n\nIMPORTANT: REMOVE all placeholder syntax {{PLACEHOLDER_NAME}} and replace with actual content or real values.";
      } else {
        augmentedPrompt +=
          "\n\nIMPORTANT: Keep all placeholder syntax {{PLACEHOLDER_NAME}} exactly as they are unless specifically asked to remove them.";
      }

      const result = await patchHtmlWithOpenAI({
        html: current_html,
        prompt: augmentedPrompt,
        selector,
        tenantId,
        promptOverrides,
      });

      const cleanedHtml = result.patchedHtml;

      // Placeholder extraction disabled
      const placeholderTags: string[] = [];

      logger.info("[Template Refinement] Success!", {
        tenantId,
        htmlLength: cleanedHtml.length,
        summary: result.summary,
        timestamp: new Date().toISOString(),
      });

      return {
        html_content: cleanedHtml,
        placeholder_tags: placeholderTags,
      };
    } catch (error: any) {
      logger.error("[Template Refinement] Error occurred", {
        tenantId,
        jobId,
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
        timestamp: new Date().toISOString(),
      });
      throw new ApiError(
        error.message || "Failed to refine template with AI",
        500,
      );
    }
  }

  private buildContextSection(
    brandContext?: string,
    icpContext?: string,
  ): string {
    let contextSection = "";
    if (brandContext) {
      contextSection += `\n\n## Brand Context\n${brandContext}`;
    }
    if (icpContext) {
      contextSection += `\n\n## Ideal Customer Profile (ICP) Document\n${icpContext}`;
    }
    return contextSection;
  }

  private async getOpenAI(): Promise<OpenAI> {
    return this.deps.openai ?? (await getOpenAIClient());
  }

  private async trackUsage({
    tenantId,
    jobId,
    serviceType,
    modelUsed,
    usage,
  }: {
    tenantId: string;
    jobId?: string;
    serviceType: UsageTrackingParams["serviceType"];
    modelUsed: string;
    usage?: { input_tokens?: number; output_tokens?: number } | null;
  }): Promise<UsageInfo> {
    let usageInfo: UsageInfo = {
      service_type: serviceType,
      model: modelUsed,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
    };

    if (!usage) {
      return usageInfo;
    }

    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const costData = calculateOpenAICost(modelUsed, inputTokens, outputTokens);
    usageInfo = {
      service_type: serviceType,
      model: modelUsed,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costData.cost_usd,
    };

    const store =
      this.deps.storeUsageRecord ??
      usageTrackingService.storeUsageRecord.bind(usageTrackingService);
    await store({
      tenantId,
      serviceType,
      model: modelUsed,
      inputTokens,
      outputTokens,
      costUsd: costData.cost_usd,
      jobId,
    });

    return usageInfo;
  }
}

export const templateAIService = new TemplateAIService();
