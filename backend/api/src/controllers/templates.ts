import { ulid } from 'ulid';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import OpenAI from 'openai';
import { db } from '../utils/db';
import { validate, createTemplateSchema, updateTemplateSchema } from '../utils/validation';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';
import { calculateOpenAICost } from '../services/costService';

const TEMPLATES_TABLE = process.env.TEMPLATES_TABLE!;
const USAGE_RECORDS_TABLE = process.env.USAGE_RECORDS_TABLE || 'leadmagnet-usage-records';
const OPENAI_SECRET_NAME = process.env.OPENAI_SECRET_NAME || 'leadmagnet/openai-api-key';
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

async function getOpenAIClient(): Promise<OpenAI> {
  const command = new GetSecretValueCommand({ SecretId: OPENAI_SECRET_NAME });
  const response = await secretsClient.send(command);
  
  if (!response.SecretString) {
    throw new ApiError('OpenAI API key not found in secret', 500);
  }

  let apiKey: string;
  
  // Try to parse as JSON first (if secret is stored as {"OPENAI_API_KEY": "..."})
  try {
    const parsed = JSON.parse(response.SecretString);
    apiKey = parsed.OPENAI_API_KEY || parsed.apiKey || response.SecretString;
  } catch {
    // If not JSON, use the secret string directly
    apiKey = response.SecretString;
  }
  
  if (!apiKey || apiKey.trim().length === 0) {
    throw new ApiError('OpenAI API key is empty', 500);
  }

  return new OpenAI({ apiKey });
}

/**
 * Helper function to store usage record in DynamoDB.
 * This is called after each OpenAI API call to track costs.
 */
async function storeUsageRecord(
  tenantId: string,
  serviceType: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  costUsd: number,
  jobId?: string
): Promise<void> {
  try {
    const usageId = `usage_${ulid()}`;
    const usageRecord = {
      usage_id: usageId,
      tenant_id: tenantId,
      job_id: jobId || null,
      service_type: serviceType,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      created_at: new Date().toISOString(),
    };

    await db.put(USAGE_RECORDS_TABLE, usageRecord);
    console.log('[Usage Tracking] Usage record stored', {
      usageId,
      tenantId,
      serviceType,
      model,
      inputTokens,
      outputTokens,
      costUsd,
    });
  } catch (error: any) {
    // Don't fail the request if usage tracking fails
    console.error('[Usage Tracking] Failed to store usage record', {
      error: error.message,
      tenantId,
      serviceType,
    });
  }
}

class TemplatesController {
  async list(tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse> {
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;

    const templates = await db.query(
      TEMPLATES_TABLE,
      'gsi_tenant_id',
      'tenant_id = :tenant_id',
      { ':tenant_id': tenantId },
      undefined,
      limit
    );

    return {
      statusCode: 200,
      body: {
        templates,
        count: templates.length,
      },
    };
  }

  async get(tenantId: string, templateId: string): Promise<RouteResponse> {
    // Parse template ID and version if provided as template_id:version
    const [id, versionStr] = templateId.split(':');
    const version = versionStr ? parseInt(versionStr) : undefined;

    let template;
    if (version) {
      template = await db.get(TEMPLATES_TABLE, { template_id: id, version });
    } else {
      // Get latest version
      const templates = await db.query(
        TEMPLATES_TABLE,
        undefined,
        'template_id = :template_id',
        { ':template_id': id },
        undefined,
        1
      );
      template = templates[0];
    }

    if (!template) {
      throw new ApiError('This template doesn\'t exist', 404);
    }

    if (template.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this template', 403);
    }

    return {
      statusCode: 200,
      body: template,
    };
  }

  async create(tenantId: string, body: any): Promise<RouteResponse> {
    const data = validate(createTemplateSchema, body);

    const templateId = `tmpl_${ulid()}`;

    // Extract placeholder tags from HTML
    const placeholderTags = this.extractPlaceholders(data.html_content);

    const template = {
      template_id: templateId,
      version: 1,
      tenant_id: tenantId,
      ...data,
      placeholder_tags: data.placeholder_tags || placeholderTags,
      created_at: new Date().toISOString(),
    };

    await db.put(TEMPLATES_TABLE, template);

    return {
      statusCode: 201,
      body: template,
    };
  }

  async update(tenantId: string, templateId: string, body: any): Promise<RouteResponse> {
    const [id] = templateId.split(':');

    // Get latest version
    const existingTemplates = await db.query(
      TEMPLATES_TABLE,
      undefined,
      'template_id = :template_id',
      { ':template_id': id },
      undefined,
      1
    );

    if (existingTemplates.length === 0) {
      throw new ApiError('This template doesn\'t exist', 404);
    }

    const existing = existingTemplates[0];

    if (existing.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this template', 403);
    }

    const data = validate(updateTemplateSchema, body);

    // Create new version
    const newVersion = existing.version + 1;

    const placeholderTags = data.html_content
      ? this.extractPlaceholders(data.html_content)
      : existing.placeholder_tags;

    const template = {
      template_id: id,
      version: newVersion,
      tenant_id: tenantId,
      template_name: data.template_name || existing.template_name,
      template_description: data.template_description || existing.template_description,
      html_content: data.html_content || existing.html_content,
      placeholder_tags: data.placeholder_tags || placeholderTags,
      is_published: data.is_published !== undefined ? data.is_published : existing.is_published,
      created_at: new Date().toISOString(),
    };

    await db.put(TEMPLATES_TABLE, template);

    return {
      statusCode: 200,
      body: template,
    };
  }

  async delete(tenantId: string, templateId: string): Promise<RouteResponse> {
    const [id, versionStr] = templateId.split(':');
    const version = versionStr ? parseInt(versionStr) : undefined;

    if (!version) {
      throw new ApiError('Version is required for deletion', 400);
    }

    const template = await db.get(TEMPLATES_TABLE, { template_id: id, version });

    if (!template) {
      throw new ApiError('This template doesn\'t exist', 404);
    }

    if (template.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this template', 403);
    }

    // Hard delete specific version
    await db.delete(TEMPLATES_TABLE, { template_id: id, version });

    return {
      statusCode: 204,
      body: {},
    };
  }

  private extractPlaceholders(html: string): string[] {
    const regex = /\{\{([A-Z_]+)\}\}/g;
    const matches = html.matchAll(regex);
    const placeholders = new Set<string>();
    for (const match of matches) {
      placeholders.add(match[1]);
    }
    return Array.from(placeholders);
  }

  async refineWithAI(tenantId: string, body: any): Promise<RouteResponse> {
    const { current_html, edit_prompt, model = 'gpt-4o' } = body;

    if (!current_html || !current_html.trim()) {
      throw new ApiError('Current HTML content is required', 400);
    }

    if (!edit_prompt || !edit_prompt.trim()) {
      throw new ApiError('Edit prompt is required', 400);
    }

    console.log('[Template Refinement] Starting refinement', {
      tenantId,
      model,
      currentHtmlLength: current_html.length,
      editPromptLength: edit_prompt.length,
      timestamp: new Date().toISOString(),
    });

    try {
      const openai = await getOpenAIClient();
      console.log('[Template Refinement] OpenAI client initialized');

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

      console.log('[Template Refinement] Calling OpenAI for refinement...', {
        model,
        promptLength: prompt.length,
      });

      const refineStartTime = Date.now();
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: shouldRemovePlaceholders 
              ? 'You are an expert HTML template designer. Return only valid HTML code without markdown formatting. REMOVE all placeholder syntax {{PLACEHOLDER_NAME}} and replace with actual content or real values (e.g., replace {{BRAND_COLORS}} with actual color codes like #2d8659).'
              : 'You are an expert HTML template designer. Return only valid HTML code without markdown formatting. Preserve all placeholder syntax {{PLACEHOLDER_NAME}} exactly.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_completion_tokens: 4000,
      });

      const refineDuration = Date.now() - refineStartTime;
      console.log('[Template Refinement] Refinement completed', {
        duration: `${refineDuration}ms`,
        tokensUsed: completion.usage?.total_tokens,
        model: completion.model,
      });

      // Track usage
      const usage = completion.usage;
      if (usage) {
        const inputTokens = usage.prompt_tokens || 0;
        const outputTokens = usage.completion_tokens || 0;
        const costData = calculateOpenAICost(model, inputTokens, outputTokens);
        
        await storeUsageRecord(
          tenantId,
          'openai_template_refine',
          model,
          inputTokens,
          outputTokens,
          costData.cost_usd
        );
      }

      const htmlContent = completion.choices[0]?.message?.content || '';
      console.log('[Template Refinement] Refined HTML received', {
        htmlLength: htmlContent.length,
        firstChars: htmlContent.substring(0, 100),
      });
      
      // Clean up markdown code blocks if present
      let cleanedHtml = htmlContent.trim();
      if (cleanedHtml.startsWith('```html')) {
        cleanedHtml = cleanedHtml.replace(/^```html\s*/i, '').replace(/\s*```$/i, '');
        console.log('[Template Refinement] Removed ```html markers');
      } else if (cleanedHtml.startsWith('```')) {
        cleanedHtml = cleanedHtml.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
        console.log('[Template Refinement] Removed ``` markers');
      }

      // Extract placeholder tags
      const placeholderTags = this.extractPlaceholders(cleanedHtml);
      console.log('[Template Refinement] Extracted placeholders', {
        placeholderCount: placeholderTags.length,
        placeholders: placeholderTags,
      });

      const totalDuration = Date.now() - refineStartTime;
      console.log('[Template Refinement] Success!', {
        tenantId,
        htmlLength: cleanedHtml.length,
        placeholderCount: placeholderTags.length,
        totalDuration: `${totalDuration}ms`,
        timestamp: new Date().toISOString(),
      });

      return {
        statusCode: 200,
        body: {
          html_content: cleanedHtml,
          placeholder_tags: placeholderTags,
        },
      };
    } catch (error: any) {
      console.error('[Template Refinement] Error occurred', {
        tenantId,
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

  async generateWithAI(tenantId: string, body: any): Promise<RouteResponse> {
    const { description, model = 'gpt-4o' } = body;

    if (!description || !description.trim()) {
      throw new ApiError('Description is required', 400);
    }

    console.log('[Template Generation] Starting AI generation', {
      tenantId,
      model,
      descriptionLength: description.length,
      timestamp: new Date().toISOString(),
    });

    try {
      const openai = await getOpenAIClient();
      console.log('[Template Generation] OpenAI client initialized');

      const prompt = `You are an expert HTML template designer for lead magnets. Create a professional HTML template based on this description: "${description}"

Requirements:
1. Generate a complete, valid HTML5 document
2. Include modern, clean CSS styling (inline or in <style> tag)
3. DO NOT use placeholder syntax - use actual sample content and descriptive text
4. Make it responsive and mobile-friendly
5. Use professional color scheme and typography
6. Design it to beautifully display lead magnet content
7. Include actual text content that demonstrates the design - use sample headings, paragraphs, and sections
8. The HTML should be ready to use with real content filled in manually or via code

Return ONLY the HTML code, no markdown formatting, no explanations.`;

      console.log('[Template Generation] Calling OpenAI for HTML generation...', {
        model,
        promptLength: prompt.length,
      });

      const htmlStartTime = Date.now();
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert HTML template designer. Return only valid HTML code without markdown formatting.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_completion_tokens: 4000,
      });

      const htmlDuration = Date.now() - htmlStartTime;
      console.log('[Template Generation] HTML generation completed', {
        duration: `${htmlDuration}ms`,
        tokensUsed: completion.usage?.total_tokens,
        model: completion.model,
      });

      // Track usage
      const usage = completion.usage;
      if (usage) {
        const inputTokens = usage.prompt_tokens || 0;
        const outputTokens = usage.completion_tokens || 0;
        const costData = calculateOpenAICost(model, inputTokens, outputTokens);
        
        await storeUsageRecord(
          tenantId,
          'openai_template_generate',
          model,
          inputTokens,
          outputTokens,
          costData.cost_usd
        );
      }

      const htmlContent = completion.choices[0]?.message?.content || '';
      console.log('[Template Generation] Raw HTML received', {
        htmlLength: htmlContent.length,
        firstChars: htmlContent.substring(0, 100),
      });
      
      // Clean up markdown code blocks if present
      let cleanedHtml = htmlContent.trim();
      if (cleanedHtml.startsWith('```html')) {
        cleanedHtml = cleanedHtml.replace(/^```html\s*/i, '').replace(/\s*```$/i, '');
        console.log('[Template Generation] Removed ```html markers');
      } else if (cleanedHtml.startsWith('```')) {
        cleanedHtml = cleanedHtml.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
        console.log('[Template Generation] Removed ``` markers');
      }

      // Extract placeholder tags
      const placeholderTags = this.extractPlaceholders(cleanedHtml);
      console.log('[Template Generation] Extracted placeholders', {
        placeholderCount: placeholderTags.length,
        placeholders: placeholderTags,
      });

      // Generate template name and description
      const namePrompt = `Based on this template description: "${description}", generate:
1. A short, descriptive template name (2-4 words max)
2. A brief template description (1-2 sentences)

Return JSON format: {"name": "...", "description": "..."}`;

      console.log('[Template Generation] Calling OpenAI for name/description generation...');
      const nameStartTime = Date.now();
      const nameCompletion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'user',
            content: namePrompt,
          },
        ],
        temperature: 0.5,
        max_completion_tokens: 200,
      });

      const nameDuration = Date.now() - nameStartTime;
      console.log('[Template Generation] Name/description generation completed', {
        duration: `${nameDuration}ms`,
        tokensUsed: nameCompletion.usage?.total_tokens,
      });

      // Track usage for name/description generation
      const nameUsage = nameCompletion.usage;
      if (nameUsage) {
        const inputTokens = nameUsage.prompt_tokens || 0;
        const outputTokens = nameUsage.completion_tokens || 0;
        const costData = calculateOpenAICost(model, inputTokens, outputTokens);
        
        await storeUsageRecord(
          tenantId,
          'openai_template_generate',
          model,
          inputTokens,
          outputTokens,
          costData.cost_usd
        );
      }

      const nameContent = nameCompletion.choices[0]?.message?.content || '';
      let templateName = 'Generated Template';
      let templateDescription = description;

      try {
        // Try to parse JSON response
        const jsonMatch = nameContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          templateName = parsed.name || templateName;
          templateDescription = parsed.description || templateDescription;
          console.log('[Template Generation] Parsed name/description from JSON', {
            templateName,
            templateDescriptionLength: templateDescription.length,
          });
        }
      } catch (e) {
        // If JSON parsing fails, use defaults
        templateName = description.split(' ').slice(0, 3).join(' ') + ' Template';
        console.log('[Template Generation] JSON parsing failed, using fallback', {
          error: e instanceof Error ? e.message : String(e),
          fallbackName: templateName,
        });
      }

      const totalDuration = Date.now() - htmlStartTime;
      console.log('[Template Generation] Success!', {
        tenantId,
        templateName,
        htmlLength: cleanedHtml.length,
        placeholderCount: placeholderTags.length,
        totalDuration: `${totalDuration}ms`,
        timestamp: new Date().toISOString(),
      });

      return {
        statusCode: 200,
        body: {
          template_name: templateName,
          template_description: templateDescription,
          html_content: cleanedHtml,
          placeholder_tags: placeholderTags,
        },
      };
    } catch (error: any) {
      console.error('[Template Generation] Error occurred', {
        tenantId,
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
        timestamp: new Date().toISOString(),
      });
      throw new ApiError(
        error.message || 'Failed to generate template with AI',
        500
      );
    }
  }
}

export const templatesController = new TemplatesController();

