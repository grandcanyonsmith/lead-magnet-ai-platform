import { ulid } from 'ulid';
import { db } from '../utils/db';
import { validate, createTemplateSchema, updateTemplateSchema } from '../utils/validation';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';

const TEMPLATES_TABLE = process.env.TEMPLATES_TABLE!;

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
}

export const templatesController = new TemplatesController();

