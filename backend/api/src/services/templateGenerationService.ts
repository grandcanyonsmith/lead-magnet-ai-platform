import OpenAI from 'openai';
import { calculateOpenAICost } from './costService';
import { logger } from '../utils/logger';

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
      jobId?: string
    ) => Promise<void>
  ) {}

  /**
   * Generate template HTML from description
   */
  async generateTemplateHTML(
    description: string,
    model: string,
    tenantId: string,
    jobId?: string,
    brandContext?: string,
    icpContext?: string
  ): Promise<{ htmlContent: string; usageInfo: UsageInfo }> {
    let contextSection = '';
    if (brandContext) {
      contextSection += `\n\n## Brand Context\n${brandContext}`;
    }
    if (icpContext) {
      contextSection += `\n\n## Ideal Customer Profile (ICP) Document\n${icpContext}`;
    }
    
    const templatePrompt = `You are an expert HTML template designer for lead magnets. Create a professional HTML template for: "${description}"${contextSection}

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

    logger.info('[Template Generation Service] Calling OpenAI for template HTML generation...');
    const templateStartTime = Date.now();
    
    const templateCompletionParams: any = {
      model,
      instructions: 'You are an expert HTML template designer. Return only valid HTML code without markdown formatting.',
      input: templatePrompt,
    };
    if (model !== 'gpt-5') {
      templateCompletionParams.temperature = 0.7;
    }
    const templateCompletion = await this.openai.responses.create(templateCompletionParams);

    const templateDuration = Date.now() - templateStartTime;
    const templateModelUsed = (templateCompletion as any).model || model;
    logger.info('[Template Generation Service] Template HTML generation completed', {
      duration: `${templateDuration}ms`,
      tokensUsed: templateCompletion.usage?.total_tokens,
      modelUsed: templateModelUsed,
    });

    // Track usage
    const templateUsage = templateCompletion.usage;
    let usageInfo: UsageInfo = {
      service_type: 'openai_template_generate',
      model: templateModelUsed,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
    };

    if (templateUsage) {
      const inputTokens = templateUsage.input_tokens || 0;
      const outputTokens = templateUsage.output_tokens || 0;
      const costData = calculateOpenAICost(templateModelUsed, inputTokens, outputTokens);
      
      usageInfo = {
        service_type: 'openai_template_generate',
        model: templateModelUsed,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costData.cost_usd,
      };

      await this.storeUsageRecord(
        tenantId,
        'openai_template_generate',
        templateModelUsed,
        inputTokens,
        outputTokens,
        costData.cost_usd,
        jobId
      );
    }

    // Validate response has output_text
    if (!templateCompletion.output_text) {
      throw new Error('OpenAI Responses API returned empty response. output_text is missing for template HTML generation.');
    }
    
    let cleanedHtml = templateCompletion.output_text;
    
    // Clean up markdown code blocks if present
    if (cleanedHtml.startsWith('```html')) {
      cleanedHtml = cleanedHtml.replace(/^```html\s*/i, '').replace(/\s*```$/i, '');
    } else if (cleanedHtml.startsWith('```')) {
      cleanedHtml = cleanedHtml.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    }

    return { htmlContent: cleanedHtml.trim(), usageInfo };
  }

  /**
   * Generate template name and description
   */
  async generateTemplateMetadata(
    description: string,
    model: string,
    tenantId: string,
    jobId?: string,
    brandContext?: string,
    icpContext?: string
  ): Promise<{ templateName: string; templateDescription: string; usageInfo: UsageInfo }> {
    let contextSection = '';
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

    logger.info('[Template Generation Service] Calling OpenAI for template name/description generation...');
    const templateNameStartTime = Date.now();
    
    const templateNameCompletionParams: any = {
      model,
      input: templateNamePrompt,
    };
    if (model !== 'gpt-5') {
      templateNameCompletionParams.temperature = 0.5;
    }
    const templateNameCompletion = await this.openai.responses.create(templateNameCompletionParams);

    const templateNameDuration = Date.now() - templateNameStartTime;
    const templateNameModel = (templateNameCompletion as any).model || model;
    logger.info('[Template Generation Service] Template name/description generation completed', {
      duration: `${templateNameDuration}ms`,
      modelUsed: templateNameModel,
    });

    // Track usage
    const templateNameUsage = templateNameCompletion.usage;
    let usageInfo: UsageInfo = {
      service_type: 'openai_template_generate',
      model: templateNameModel,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
    };

    if (templateNameUsage) {
      const inputTokens = templateNameUsage.input_tokens || 0;
      const outputTokens = templateNameUsage.output_tokens || 0;
      const costData = calculateOpenAICost(templateNameModel, inputTokens, outputTokens);
      
      usageInfo = {
        service_type: 'openai_template_generate',
        model: templateNameModel,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costData.cost_usd,
      };

      await this.storeUsageRecord(
        tenantId,
        'openai_template_generate',
        templateNameModel,
        inputTokens,
        outputTokens,
        costData.cost_usd,
        jobId
      );
    }

    // Validate response has output_text
    if (!templateNameCompletion.output_text) {
      throw new Error('OpenAI Responses API returned empty response. output_text is missing for template name generation.');
    }
    
    const templateNameContent = templateNameCompletion.output_text;
    let templateName = 'Generated Template';
    let templateDescription = 'A professional HTML template for displaying lead magnet content';

    try {
      const jsonMatch = templateNameContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        templateName = parsed.name || templateName;
        templateDescription = parsed.description || templateDescription;
      }
    } catch (e) {
      logger.warn('[Template Generation Service] Failed to parse template name JSON, using defaults', { error: e });
    }

    return { templateName, templateDescription, usageInfo };
  }
}

