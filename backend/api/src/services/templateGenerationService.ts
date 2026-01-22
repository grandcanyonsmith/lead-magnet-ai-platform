import OpenAI from "openai";
import { calculateOpenAICost } from "./costService";
import { callResponsesWithTimeout } from "../utils/openaiHelpers";
import { stripTemplatePlaceholders } from "../utils/htmlSanitizer";

export interface UsageInfo {
  service_type: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

/**
 * Service for generating template HTML and metadata.
 * Handles AI-powered template generation.
 */
export class TemplateGenerationService {
  constructor(
    private openai: OpenAI,
    private storeUsageRecord: (
      tenantId: string,
      serviceType: string,
      model: string,
      inputTokens: number,
      outputTokens: number,
      costUsd: number,
      jobId?: string,
    ) => Promise<void>,
  ) {}

  /**
   * Generate template HTML from description
   */
  async generateTemplateHTML(
    description: string,
    _model: string,
    tenantId: string,
    jobId?: string,
    brandContext?: string,
    icpContext?: string,
  ): Promise<{ htmlContent: string; usageInfo: UsageInfo }> {
    const model = "gpt-5.2";
    let contextSection = "";
    if (brandContext) {
      contextSection += `\n\n## Brand Context\n${brandContext}`;
    }
    if (icpContext) {
      contextSection += `\n\n## Ideal Customer Profile (ICP) Document\n${icpContext}`;
    }

    const templatePrompt = `You are a World-Class UI/UX Designer and Frontend Developer.
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

    console.log(
      "[Template Generation Service] Calling OpenAI for template HTML generation...",
    );
    const templateStartTime = Date.now();

    const templateCompletionParams: any = {
      model,
      instructions:
        "You are an expert HTML template designer. Return only valid HTML code without markdown formatting.",
      input: templatePrompt,
      reasoning: { effort: "high" },
      service_tier: "priority",
    };
    const templateCompletion = await callResponsesWithTimeout(
      () => this.openai.responses.create(templateCompletionParams),
      "template HTML generation",
    );

    const templateDuration = Date.now() - templateStartTime;
    const templateModelUsed = (templateCompletion as any).model || model;
    console.log(
      "[Template Generation Service] Template HTML generation completed",
      {
        duration: `${templateDuration}ms`,
        tokensUsed: templateCompletion.usage?.total_tokens,
        modelUsed: templateModelUsed,
      },
    );

    // Track usage
    const templateUsage = templateCompletion.usage;
    let usageInfo: UsageInfo = {
      service_type: "openai_template_generate",
      model: templateModelUsed,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
    };

    if (templateUsage) {
      const inputTokens = templateUsage.input_tokens || 0;
      const outputTokens = templateUsage.output_tokens || 0;
      const costData = calculateOpenAICost(
        templateModelUsed,
        inputTokens,
        outputTokens,
      );

      usageInfo = {
        service_type: "openai_template_generate",
        model: templateModelUsed,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costData.cost_usd,
      };

      await this.storeUsageRecord(
        tenantId,
        "openai_template_generate",
        templateModelUsed,
        inputTokens,
        outputTokens,
        costData.cost_usd,
        jobId,
      );
    }

    // Validate response has output_text
    if (!templateCompletion.output_text) {
      throw new Error(
        "OpenAI Responses API returned empty response. output_text is missing for template HTML generation.",
      );
    }

    let cleanedHtml = templateCompletion.output_text;

    // Clean up markdown code blocks if present
    if (cleanedHtml.startsWith("```html")) {
      cleanedHtml = cleanedHtml
        .replace(/^```html\s*/i, "")
        .replace(/\s*```$/i, "");
    } else if (cleanedHtml.startsWith("```")) {
      cleanedHtml = cleanedHtml.replace(/^```\s*/i, "").replace(/\s*```$/i, "");
    }

    const sanitizedHtml = stripTemplatePlaceholders(cleanedHtml.trim());
    return { htmlContent: sanitizedHtml, usageInfo };
  }

  /**
   * Generate template name and description
   */
  async generateTemplateMetadata(
    description: string,
    _model: string,
    tenantId: string,
    jobId?: string,
    brandContext?: string,
    icpContext?: string,
  ): Promise<{
    templateName: string;
    templateDescription: string;
    usageInfo: UsageInfo;
  }> {
    const model = "gpt-5.2";
    let contextSection = "";
    if (brandContext) {
      contextSection += `\n\n## Brand Context\n${brandContext}`;
    }
    if (icpContext) {
      contextSection += `\n\n## Ideal Customer Profile (ICP) Document\n${icpContext}`;
    }

    const templateNamePrompt = `Based on this lead magnet: "${description}"${contextSection}, generate:
1. A short, descriptive template name (2-4 words max)
2. A brief template description (1-2 sentences)

Return JSON format: {"name": "...", "description": "..."}`;

    console.log(
      "[Template Generation Service] Calling OpenAI for template name/description generation...",
    );
    const templateNameStartTime = Date.now();

    const templateNameCompletionParams: any = {
      model,
      input: templateNamePrompt,
      reasoning: { effort: "high" },
      service_tier: "priority",
    };
    const templateNameCompletion = await callResponsesWithTimeout(
      () => this.openai.responses.create(templateNameCompletionParams),
      "template name generation",
    );

    const templateNameDuration = Date.now() - templateNameStartTime;
    const templateNameModel = (templateNameCompletion as any).model || model;
    console.log(
      "[Template Generation Service] Template name/description generation completed",
      {
        duration: `${templateNameDuration}ms`,
        modelUsed: templateNameModel,
      },
    );

    // Track usage
    const templateNameUsage = templateNameCompletion.usage;
    let usageInfo: UsageInfo = {
      service_type: "openai_template_generate",
      model: templateNameModel,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
    };

    if (templateNameUsage) {
      const inputTokens = templateNameUsage.input_tokens || 0;
      const outputTokens = templateNameUsage.output_tokens || 0;
      const costData = calculateOpenAICost(
        templateNameModel,
        inputTokens,
        outputTokens,
      );

      usageInfo = {
        service_type: "openai_template_generate",
        model: templateNameModel,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costData.cost_usd,
      };

      await this.storeUsageRecord(
        tenantId,
        "openai_template_generate",
        templateNameModel,
        inputTokens,
        outputTokens,
        costData.cost_usd,
        jobId,
      );
    }

    // Validate response has output_text
    if (!templateNameCompletion.output_text) {
      throw new Error(
        "OpenAI Responses API returned empty response. output_text is missing for template name generation.",
      );
    }

    const templateNameContent = templateNameCompletion.output_text;
    let templateName = "Generated Template";
    let templateDescription =
      "A professional HTML template for displaying lead magnet content";

    try {
      const jsonMatch = templateNameContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        templateName = parsed.name || templateName;
        templateDescription = parsed.description || templateDescription;
      }
    } catch (e) {
      console.warn(
        "[Template Generation Service] Failed to parse template name JSON, using defaults",
        e,
      );
    }

    return { templateName, templateDescription, usageInfo };
  }
}
