"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.templatesController = void 0;
const ulid_1 = require("ulid");
const db_1 = require("../utils/db");
const validation_1 = require("../utils/validation");
const errors_1 = require("../utils/errors");
const templateAIService_1 = require("../services/templateAIService");
const env_1 = require("../utils/env");
const TEMPLATES_TABLE = env_1.env.templatesTable;
class TemplatesController {
    async list(_tenantId, queryParams) {
        const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;
        // Remove tenant_id filtering - show all templates from all accounts
        const templatesResult = { items: await db_1.db.scan(TEMPLATES_TABLE, limit) };
        const templates = Array.isArray(templatesResult) ? templatesResult : templatesResult.items;
        return {
            statusCode: 200,
            body: {
                templates,
                count: templates.length,
            },
        };
    }
    async get(_tenantId, templateId) {
        // Parse template ID and version if provided as template_id:version
        const [id, versionStr] = templateId.split(':');
        const version = versionStr ? parseInt(versionStr) : undefined;
        let template;
        if (version) {
            template = await db_1.db.get(TEMPLATES_TABLE, { template_id: id, version });
        }
        else {
            // Get latest version
            const templatesResult = await db_1.db.query(TEMPLATES_TABLE, undefined, 'template_id = :template_id', { ':template_id': id }, undefined, 1);
            const templates = Array.isArray(templatesResult) ? templatesResult : templatesResult.items;
            template = templates[0];
        }
        if (!template) {
            throw new errors_1.ApiError('This template doesn\'t exist', 404);
        }
        // Removed tenant_id check - allow access to all templates from all accounts
        return {
            statusCode: 200,
            body: template,
        };
    }
    async create(tenantId, body) {
        const data = (0, validation_1.validate)(validation_1.createTemplateSchema, body);
        const templateId = `tmpl_${(0, ulid_1.ulid)()}`;
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
        await db_1.db.put(TEMPLATES_TABLE, template);
        return {
            statusCode: 201,
            body: template,
        };
    }
    async update(_tenantId, templateId, body) {
        const [id] = templateId.split(':');
        // Get latest version
        const existingTemplatesResult = await db_1.db.query(TEMPLATES_TABLE, undefined, 'template_id = :template_id', { ':template_id': id }, undefined, 1);
        const existingTemplates = Array.isArray(existingTemplatesResult) ? existingTemplatesResult : existingTemplatesResult.items;
        if (existingTemplates.length === 0) {
            throw new errors_1.ApiError('This template doesn\'t exist', 404);
        }
        const existing = existingTemplates[0];
        // Removed tenant_id check - allow access to all templates from all accounts
        const data = (0, validation_1.validate)(validation_1.updateTemplateSchema, body);
        // Create new version
        const newVersion = existing.version + 1;
        const placeholderTags = data.html_content
            ? this.extractPlaceholders(data.html_content)
            : existing.placeholder_tags;
        const template = {
            template_id: id,
            version: newVersion,
            tenant_id: existing.tenant_id, // Keep original tenant_id for data integrity
            template_name: data.template_name || existing.template_name,
            template_description: data.template_description || existing.template_description,
            html_content: data.html_content || existing.html_content,
            placeholder_tags: data.placeholder_tags || placeholderTags,
            is_published: data.is_published !== undefined ? data.is_published : existing.is_published,
            created_at: new Date().toISOString(),
        };
        await db_1.db.put(TEMPLATES_TABLE, template);
        return {
            statusCode: 200,
            body: template,
        };
    }
    async delete(_tenantId, templateId) {
        const [id, versionStr] = templateId.split(':');
        const version = versionStr ? parseInt(versionStr) : undefined;
        if (!version) {
            throw new errors_1.ApiError('Version is required for deletion', 400);
        }
        const template = await db_1.db.get(TEMPLATES_TABLE, { template_id: id, version });
        if (!template) {
            throw new errors_1.ApiError('This template doesn\'t exist', 404);
        }
        // Removed tenant_id check - allow access to all templates from all accounts
        // Hard delete specific version
        await db_1.db.delete(TEMPLATES_TABLE, { template_id: id, version });
        return {
            statusCode: 204,
            body: {},
        };
    }
    extractPlaceholders(_html) {
        // Placeholder extraction disabled - no longer using placeholder syntax
        return [];
    }
    async refineWithAI(tenantId, body) {
        const result = await templateAIService_1.templateAIService.refineWithAI({
            current_html: body.current_html,
            edit_prompt: body.edit_prompt,
            model: body.model,
            tenantId,
        });
        return {
            statusCode: 200,
            body: result,
        };
    }
    async generateWithAI(tenantId, body) {
        const result = await templateAIService_1.templateAIService.generateWithAI({
            description: body.description,
            model: body.model,
            tenantId,
        });
        return {
            statusCode: 200,
            body: result,
        };
    }
}
exports.templatesController = new TemplatesController();
//# sourceMappingURL=templates.js.map