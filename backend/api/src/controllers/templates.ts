import { ulid } from 'ulid';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import OpenAI from 'openai';
import { db } from '../utils/db';
import { validate, createTemplateSchema, updateTemplateSchema } from '../utils/validation';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';

const TEMPLATES_TABLE = process.env.TEMPLATES_TABLE!;
const OPENAI_SECRET_NAME = process.env.OPENAI_SECRET_NAME || 'leadmagnet/openai-api-key';
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

async function getOpenAIClient(): Promise<OpenAI> {
  const command = new GetSecretValueCommand({ SecretId: OPENAI_SECRET_NAME });
  const response = await secretsClient.send(command);
  const apiKey = JSON.parse(response.SecretString || '{}').OPENAI_API_KEY || response.SecretString;
  
  if (!apiKey) {
    throw new ApiError('OpenAI API key not found', 500);
  }

  return new OpenAI({ apiKey });
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
      throw new ApiError('Template not found', 404);
    }

    if (template.tenant_id !== tenantId) {
      throw new ApiError('Unauthorized', 403);
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
      throw new ApiError('Template not found', 404);
    }

    const existing = existingTemplates[0];

    if (existing.tenant_id !== tenantId) {
      throw new ApiError('Unauthorized', 403);
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
      throw new ApiError('Template not found', 404);
    }

    if (template.tenant_id !== tenantId) {
      throw new ApiError('Unauthorized', 403);
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

  async generateWithAI(tenantId: string, body: any): Promise<RouteResponse> {
    const { description, model = 'gpt-4o' } = body;

    if (!description || !description.trim()) {
      throw new ApiError('Description is required', 400);
    }

    try {
      const openai = await getOpenAIClient();

      const prompt = `You are an expert HTML template designer for lead magnets. Create a professional HTML template based on this description: "${description}"

Requirements:
1. Generate a complete, valid HTML5 document
2. Include modern, clean CSS styling (inline or in <style> tag)
3. Use placeholder syntax {{PLACEHOLDER_NAME}} for dynamic content (use ALL_CAPS with underscores)
4. Include common placeholders like {{TITLE}}, {{CONTENT}}, {{AUTHOR_NAME}}, etc.
5. Make it responsive and mobile-friendly
6. Use professional color scheme and typography
7. Ensure it's suitable for email delivery (if applicable)

Return ONLY the HTML code, no markdown formatting, no explanations.`;

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
        max_tokens: 4000,
      });

      const htmlContent = completion.choices[0]?.message?.content || '';
      
      // Clean up markdown code blocks if present
      let cleanedHtml = htmlContent.trim();
      if (cleanedHtml.startsWith('```html')) {
        cleanedHtml = cleanedHtml.replace(/^```html\s*/i, '').replace(/\s*```$/i, '');
      } else if (cleanedHtml.startsWith('```')) {
        cleanedHtml = cleanedHtml.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      }

      // Extract placeholder tags
      const placeholderTags = this.extractPlaceholders(cleanedHtml);

      // Generate template name and description
      const namePrompt = `Based on this template description: "${description}", generate:
1. A short, descriptive template name (2-4 words max)
2. A brief template description (1-2 sentences)

Return JSON format: {"name": "...", "description": "..."}`;

      const nameCompletion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'user',
            content: namePrompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 200,
      });

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
        }
      } catch (e) {
        // If JSON parsing fails, use defaults
        templateName = description.split(' ').slice(0, 3).join(' ') + ' Template';
      }

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
      console.error('Failed to generate template with AI:', error);
      throw new ApiError(
        error.message || 'Failed to generate template with AI',
        500
      );
    }
  }
}

export const templatesController = new TemplatesController();

