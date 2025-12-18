import OpenAI from 'openai';
import { getOpenAIClient } from './openaiService';
import { callResponsesWithTimeout, stripMarkdownCodeFences } from '../utils/openaiHelpers';
import { calculateOpenAICost } from './costService';
import { usageTrackingService, type UsageTrackingParams } from './usageTrackingService';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/errors';

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
}

export interface TemplateRefinementRequest {
  current_html: string;
  edit_prompt: string;
  model?: string;
  tenantId: string;
  jobId?: string;
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
  async generateTemplateHTML(request: TemplateGenerationRequest): Promise<{ htmlContent: string; usageInfo: UsageInfo }> {
    const { description, model = 'gpt-5', tenantId, jobId, brandContext, icpContext } = request;

    if (!description || !description.trim()) {
      throw new ApiError('Description is required', 400);
    }

    const contextSection = this.buildContextSection(brandContext, icpContext);
    const prompt = `You are an expert HTML template designer for lead magnets. Create a professional HTML template for: "${description}"${contextSection}

Requirements:
1. Generate a complete, valid HTML5 document
2. Include modern, clean CSS styling (inline or in <style> tag)
3. DO NOT use placeholder syntax - use actual sample content and descriptive text
4. Make it responsive and mobile-friendly
5. Use professional color scheme and typography that aligns with the brand context if provided
6. Design it to beautifully display lead magnet content
7. Include actual text content that demonstrates the design - use sample headings, paragraphs, and sections
8. The HTML should be ready to use with real content filled in manually or via code

Return ONLY the HTML code, no markdown formatting, no explanations.`;

    logger.info('[Template Generation] Calling OpenAI for template HTML generation...', {
      tenantId,
      model,
      jobId,
      promptLength: prompt.length,
    });

    const openai = await this.getOpenAI();
    const startTime = Date.now();

    const completionParams: any = {
      model,
      instructions: 'You are an expert HTML template designer. Return only valid HTML code without markdown formatting.',
      input: prompt,
    };
    if (!model.startsWith('gpt-5')) {
      completionParams.temperature = 0.7;
    }

    const completion = await callResponsesWithTimeout(
      () => openai.responses.create(completionParams),
      'template HTML generation'
    );

    const duration = Date.now() - startTime;
    const modelUsed = (completion as any).model || model;
    logger.info('[Template Generation] Template HTML generation completed', {
      tenantId,
      jobId,
      durationMs: duration,
      tokensUsed: (completion as any).usage?.total_tokens,
      modelUsed,
    });

    const usageInfo = await this.trackUsage({
      tenantId,
      jobId,
      serviceType: 'openai_template_generate',
      modelUsed,
      usage: (completion as any).usage,
    });

    if (!(completion as any).output_text) {
      throw new ApiError(
        'OpenAI Responses API returned empty response. output_text is missing for template HTML generation.',
        500
      );
    }

    const cleanedHtml = stripMarkdownCodeFences((completion as any).output_text);
    return { htmlContent: cleanedHtml, usageInfo };
  }

  /**
   * Generate template name + description only.
   * Used by workflow generation and by the templates endpoint (via generateWithAI).
   */
  async generateTemplateMetadata(
    request: TemplateGenerationRequest
  ): Promise<{ templateName: string; templateDescription: string; usageInfo: UsageInfo }> {
    const { description, model = 'gpt-5', tenantId, jobId, brandContext, icpContext } = request;

    if (!description || !description.trim()) {
      throw new ApiError('Description is required', 400);
    }

    const contextSection = this.buildContextSection(brandContext, icpContext);
    const prompt = `Based on this lead magnet: "${description}"${contextSection}, generate:
1. A short, descriptive template name (2-4 words max)
2. A brief template description (1-2 sentences)

Return JSON format: {"name": "...", "description": "..."}`;

    logger.info('[Template Generation] Calling OpenAI for template name/description generation...', {
      tenantId,
      model,
      jobId,
      promptLength: prompt.length,
    });

    const openai = await this.getOpenAI();
    const startTime = Date.now();

    const completionParams: any = { model, input: prompt };
    if (!model.startsWith('gpt-5')) {
      completionParams.temperature = 0.5;
    }

    const completion = await callResponsesWithTimeout(
      () => openai.responses.create(completionParams),
      'template name generation'
    );

    const duration = Date.now() - startTime;
    const modelUsed = (completion as any).model || model;
    logger.info('[Template Generation] Template name/description generation completed', {
      tenantId,
      jobId,
      durationMs: duration,
      modelUsed,
    });

    const usageInfo = await this.trackUsage({
      tenantId,
      jobId,
      serviceType: 'openai_template_generate',
      modelUsed,
      usage: (completion as any).usage,
    });

    if (!(completion as any).output_text) {
      throw new ApiError('OpenAI Responses API returned empty response. output_text is missing for template name generation.', 500);
    }

    const content = String((completion as any).output_text);
    let templateName = 'Generated Template';
    let templateDescription = 'A professional HTML template for displaying lead magnet content';

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        templateName = parsed.name || templateName;
        templateDescription = parsed.description || templateDescription;
      }
    } catch (e) {
      logger.warn('[Template Generation] Failed to parse template name JSON, using defaults', {
        tenantId,
        jobId,
        error: e instanceof Error ? e.message : String(e),
      });
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
    const { tenantId, model = 'gpt-5', jobId } = request;

    logger.info('[Template Generation] Starting AI generation', {
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
    const { current_html, edit_prompt, model = 'gpt-5', tenantId, jobId } = request;

    if (!current_html || !current_html.trim()) {
      throw new ApiError('Current HTML content is required', 400);
    }

    if (!edit_prompt || !edit_prompt.trim()) {
      throw new ApiError('Edit prompt is required', 400);
    }

    logger.info('[Template Refinement] Starting refinement', {
      tenantId,
      model,
      jobId,
      currentHtmlLength: current_html.length,
      editPromptLength: edit_prompt.length,
      timestamp: new Date().toISOString(),
    });

    try {
      const openai = await this.getOpenAI();

      // Check if user wants to remove placeholders
      const shouldRemovePlaceholders = edit_prompt.toLowerCase().includes('remove placeholder') || 
                                       edit_prompt.toLowerCase().includes('no placeholder') ||
                                       edit_prompt.toLowerCase().includes('dont use placeholder') ||
                                       edit_prompt.toLowerCase().includes('don\'t use placeholder');
      
      const prompt = `You are an expert HTML template designer. Modify the following HTML template based on these instructions: "${edit_prompt}"

Current HTML:
${current_html}

Requirements:
${shouldRemovePlaceholders 
  ? '1. REMOVE all placeholder syntax {{PLACEHOLDER_NAME}} and replace with actual content or remove the elements containing them'
  : '1. Keep all placeholder syntax {{PLACEHOLDER_NAME}} exactly as they are'}
2. Apply the requested changes while maintaining the overall structure
3. Ensure the HTML remains valid and well-formed
4. Keep modern, clean CSS styling
5. Maintain responsiveness and mobile-friendliness
${shouldRemovePlaceholders 
  ? '6. Use real values instead of placeholders - replace {{TITLE}} with actual text, {{COLORS}} with real color values (e.g., #2d8659 for green), etc.'
  : ''}

Return ONLY the modified HTML code, no markdown formatting, no explanations.`;

      logger.info('[Template Refinement] Calling OpenAI for refinement...', {
        model,
        promptLength: prompt.length,
      });

      const refineStartTime = Date.now();
      const completionParams: any = {
        model,
        instructions: shouldRemovePlaceholders 
          ? 'You are an expert HTML template designer. Return only valid HTML code without markdown formatting. REMOVE all placeholder syntax {{PLACEHOLDER_NAME}} and replace with actual content or real values (e.g., replace {{BRAND_COLORS}} with actual color codes like #2d8659).'
          : 'You are an expert HTML template designer. Return only valid HTML code without markdown formatting. Preserve all placeholder syntax {{PLACEHOLDER_NAME}} exactly.',
        input: prompt,
      };
      // GPT-5 family only supports default temperature (1), don't set custom temperature
      if (!model.startsWith('gpt-5')) {
        completionParams.temperature = 0.7;
      }
      const completion = await callResponsesWithTimeout(
        () => openai.responses.create(completionParams),
        'template refinement'
      );

      const refineDuration = Date.now() - refineStartTime;
      const refinementModelUsed = (completion as any).model || model;
      logger.info('[Template Refinement] Refinement completed', {
        duration: `${refineDuration}ms`,
        tokensUsed: completion.usage?.total_tokens,
        model: refinementModelUsed,
      });

      await this.trackUsage({
        tenantId,
        jobId,
        serviceType: 'openai_template_refine',
        modelUsed: refinementModelUsed,
        usage: (completion as any).usage,
      });

      // Validate response has output_text
      if (!completion.output_text) {
        throw new ApiError('OpenAI Responses API returned empty response. output_text is missing for template refinement.', 500);
      }
      
      const htmlContent = completion.output_text;
      logger.info('[Template Refinement] Refined HTML received', {
        htmlLength: htmlContent.length,
        firstChars: htmlContent.substring(0, 100),
      });
      
      const cleanedHtml = stripMarkdownCodeFences(htmlContent);

      // Extract placeholder tags (disabled - no longer using placeholder syntax)
      const placeholderTags: string[] = [];
      logger.info('[Template Refinement] Extracted placeholders', {
        placeholderCount: placeholderTags.length,
        placeholders: placeholderTags,
      });

      const totalDuration = Date.now() - refineStartTime;
      logger.info('[Template Refinement] Success!', {
        tenantId,
        htmlLength: cleanedHtml.length,
        placeholderCount: placeholderTags.length,
        totalDuration: `${totalDuration}ms`,
        timestamp: new Date().toISOString(),
      });

      return {
        html_content: cleanedHtml,
        placeholder_tags: placeholderTags,
      };
    } catch (error: any) {
      logger.error('[Template Refinement] Error occurred', {
        tenantId,
        jobId,
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
        timestamp: new Date().toISOString(),
      });
      throw new ApiError(
        error.message || 'Failed to refine template with AI',
        500
      );
    }
  }

  private buildContextSection(brandContext?: string, icpContext?: string): string {
    let contextSection = '';
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
    serviceType: UsageTrackingParams['serviceType'];
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

    const store = this.deps.storeUsageRecord ?? usageTrackingService.storeUsageRecord.bind(usageTrackingService);
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

