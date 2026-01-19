import { getOpenAIClient } from "./openaiService";
import {
  callResponsesWithTimeout,
  stripMarkdownCodeFences,
} from "../utils/openaiHelpers";
import { calculateOpenAICost } from "./costService";
import { usageTrackingService } from "./usageTrackingService";
import { logger } from "../utils/logger";
import { ApiError } from "../utils/errors";
import {
  getPromptOverridesForTenant,
  resolvePromptOverride,
  type PromptOverrides,
} from "./promptOverrides";

export interface CSSGenerationRequest {
  form_fields_schema: {
    fields: Array<{
      field_type: string;
      label: string;
      required: boolean;
    }>;
  };
  css_prompt: string;
  model?: string;
  tenantId: string;
  promptOverrides?: PromptOverrides;
}

export interface CSSRefinementRequest {
  current_css: string;
  css_prompt: string;
  model?: string;
  tenantId: string;
  promptOverrides?: PromptOverrides;
}

/**
 * Service for generating and refining CSS using AI.
 */
export class CSSGenerationService {
  /**
   * Generate CSS for a form based on a description.
   */
  async generateCSS(request: CSSGenerationRequest): Promise<string> {
    const {
      form_fields_schema,
      css_prompt,
      tenantId,
      promptOverrides,
    } = request;
    const model = "gpt-5.2";

    if (
      !form_fields_schema ||
      !form_fields_schema.fields ||
      form_fields_schema.fields.length === 0
    ) {
      throw new ApiError("Form fields schema is required", 400);
    }

    if (!css_prompt || !css_prompt.trim()) {
      throw new ApiError("CSS prompt is required", 400);
    }

    logger.info("[Form CSS Generation] Starting CSS generation", {
      tenantId,
      model,
      fieldCount: form_fields_schema.fields.length,
      cssPromptLength: css_prompt.length,
      timestamp: new Date().toISOString(),
    });

    try {
      const openai = await getOpenAIClient();
      logger.info("[Form CSS Generation] OpenAI client initialized");

      const fieldsDescription = form_fields_schema.fields
        .map(
          (f: any) =>
            `- ${f.field_type}: ${f.label} (${f.required ? "required" : "optional"})`,
        )
        .join("\n");

      const prompt = `You are a Senior UI/UX Designer specializing in CSS.
Task: Generate professional, modern CSS for a form based on this description: "${css_prompt}"

Form Fields:
${fieldsDescription}

## Design Requirements
1. **Modern Aesthetics**: Use subtle shadows, rounded corners (border-radius), and adequate whitespace (padding/margin).
2. **Responsive**: Ensure full responsiveness for mobile devices (media queries).
3. **Interactive**: Include \`:hover\` and \`:focus\` states for inputs and buttons.
4. **Clean Code**: Generate valid, well-structured CSS.
5. **Scope**: Style the container, fields, labels, inputs, and the submit button.

Return ONLY the CSS code. No Markdown code blocks.`;
      const overrides =
        promptOverrides ?? (await getPromptOverridesForTenant(tenantId));
      const resolved = resolvePromptOverride({
        key: "form_css_generation",
        defaults: {
          instructions:
            "You are a Senior UI/UX Designer. Return only valid CSS code without markdown formatting.",
          prompt,
        },
        overrides,
        variables: {
          css_prompt,
          fields_description: fieldsDescription,
        },
      });

      logger.info("[Form CSS Generation] Calling OpenAI for CSS generation", {
        model,
        promptLength: prompt.length,
      });

      const cssStartTime = Date.now();
      const completionParams: any = {
        model,
        instructions: resolved.instructions,
        input: resolved.prompt,
        reasoning: { effort: "high" },
        service_tier: "priority",
      };
      const completion = await callResponsesWithTimeout(
        () => openai.responses.create(completionParams),
        "form CSS generation",
      );

      const cssDuration = Date.now() - cssStartTime;
      const cssModelUsed = (completion as any).model || model;
      logger.info("[Form CSS Generation] CSS generation completed", {
        duration: `${cssDuration}ms`,
        tokensUsed: completion.usage?.total_tokens,
        model: cssModelUsed,
      });

      // Track usage
      const usage = completion.usage;
      if (usage) {
        const inputTokens = usage.input_tokens || 0;
        const outputTokens = usage.output_tokens || 0;
        const costData = calculateOpenAICost(
          cssModelUsed,
          inputTokens,
          outputTokens,
        );

        await usageTrackingService.storeUsageRecord({
          tenantId,
          serviceType: "openai_form_css",
          model: cssModelUsed,
          inputTokens,
          outputTokens,
          costUsd: costData.cost_usd,
        });
      }

      // Validate response has output_text
      if (!completion.output_text) {
        throw new ApiError(
          "OpenAI Responses API returned empty response. output_text is missing for form CSS generation.",
          500,
        );
      }

      const cssContent = completion.output_text;
      logger.info("[Form CSS Generation] Raw CSS received", {
        cssLength: cssContent.length,
        firstChars: cssContent.substring(0, 100),
      });

      const cleanedCss = stripMarkdownCodeFences(cssContent);

      const totalDuration = Date.now() - cssStartTime;
      logger.info("[Form CSS Generation] Success!", {
        tenantId,
        cssLength: cleanedCss.length,
        totalDuration: `${totalDuration}ms`,
        timestamp: new Date().toISOString(),
      });

      return cleanedCss;
    } catch (error: any) {
      logger.error("[Form CSS Generation] Error occurred", {
        tenantId,
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
        timestamp: new Date().toISOString(),
      });
      throw new ApiError(
        error.message || "Failed to generate CSS with AI",
        500,
      );
    }
  }

  /**
   * Refine existing CSS based on a prompt.
   */
  async refineCSS(request: CSSRefinementRequest): Promise<string> {
    const { current_css, css_prompt, tenantId, promptOverrides } = request;
    const model = "gpt-5.2";

    if (!current_css || !current_css.trim()) {
      throw new ApiError("Current CSS is required", 400);
    }

    if (!css_prompt || !css_prompt.trim()) {
      throw new ApiError("CSS prompt is required", 400);
    }

    logger.info("[Form CSS Refinement] Starting refinement", {
      tenantId,
      model,
      currentCssLength: current_css.length,
      cssPromptLength: css_prompt.length,
      timestamp: new Date().toISOString(),
    });

    try {
      const openai = await getOpenAIClient();
      logger.info("[Form CSS Refinement] OpenAI client initialized");

      const prompt = `You are a Senior UI/UX Designer. Modify the following CSS based on these instructions: "${css_prompt}"

Current CSS:
${current_css}

## Requirements
1. **Precision**: Apply the requested changes while maintaining valid CSS syntax.
2. **Consistency**: Keep the overall design language unless asked to change it.
3. **Quality**: Ensure the resulting CSS is clean and readable.
4. **Output**: Return ONLY the modified CSS code. No Markdown code blocks.`;
      const overrides =
        promptOverrides ?? (await getPromptOverridesForTenant(tenantId));
      const resolved = resolvePromptOverride({
        key: "form_css_refine",
        defaults: {
          instructions:
            "You are a Senior UI/UX Designer. Return only valid CSS code without markdown formatting.",
          prompt,
        },
        overrides,
        variables: {
          css_prompt,
          current_css,
        },
      });

      logger.info("[Form CSS Refinement] Calling OpenAI for refinement", {
        model,
        promptLength: prompt.length,
      });

      const refineStartTime = Date.now();
      const completionParams: any = {
        model,
        instructions: resolved.instructions,
        input: resolved.prompt,
        reasoning: { effort: "high" },
        service_tier: "priority",
      };
      const completion = await callResponsesWithTimeout(
        () => openai.responses.create(completionParams),
        "form CSS refinement",
      );

      const refineDuration = Date.now() - refineStartTime;
      const refineCssModel = (completion as any).model || model;
      logger.info("[Form CSS Refinement] Refinement completed", {
        duration: `${refineDuration}ms`,
        tokensUsed: completion.usage?.total_tokens,
        model: refineCssModel,
      });

      // Track usage
      const usage = completion.usage;
      if (usage) {
        const inputTokens = usage.input_tokens || 0;
        const outputTokens = usage.output_tokens || 0;
        const costData = calculateOpenAICost(
          refineCssModel,
          inputTokens,
          outputTokens,
        );

        await usageTrackingService.storeUsageRecord({
          tenantId,
          serviceType: "openai_form_css_refine",
          model: refineCssModel,
          inputTokens,
          outputTokens,
          costUsd: costData.cost_usd,
        });
      }

      // Validate response has output_text
      if (!completion.output_text) {
        throw new ApiError(
          "OpenAI Responses API returned empty response. output_text is missing for form CSS refinement.",
          500,
        );
      }

      const cssContent = completion.output_text;
      logger.info("[Form CSS Refinement] Refined CSS received", {
        cssLength: cssContent.length,
        firstChars: cssContent.substring(0, 100),
      });

      const cleanedCss = stripMarkdownCodeFences(cssContent);

      const totalDuration = Date.now() - refineStartTime;
      logger.info("[Form CSS Refinement] Success!", {
        tenantId,
        cssLength: cleanedCss.length,
        totalDuration: `${totalDuration}ms`,
        timestamp: new Date().toISOString(),
      });

      return cleanedCss;
    } catch (error: any) {
      logger.error("[Form CSS Refinement] Error occurred", {
        tenantId,
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
        timestamp: new Date().toISOString(),
      });
      throw new ApiError(error.message || "Failed to refine CSS with AI", 500);
    }
  }
}

export const cssGenerationService = new CSSGenerationService();
