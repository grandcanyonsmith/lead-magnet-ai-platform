"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formsController = void 0;
const ulid_1 = require("ulid");
const db_1 = require("../utils/db");
const validation_1 = require("../utils/validation");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const formFieldUtils_1 = require("../utils/formFieldUtils");
const cssGenerationService_1 = require("../services/cssGenerationService");
const formSubmissionService_1 = require("../services/formSubmissionService");
const env_1 = require("../utils/env");
const FORMS_TABLE = env_1.env.formsTable;
const USER_SETTINGS_TABLE = env_1.env.userSettingsTable;
class FormsController {
    async list(_tenantId, queryParams) {
        const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;
        // Remove tenant_id filtering - show all forms from all accounts
        const formsResult = { items: await db_1.db.scan(FORMS_TABLE, limit) };
        const forms = (0, db_1.normalizeQueryResult)(formsResult);
        // Filter out soft-deleted items
        const activeForms = forms.filter((f) => !f.deleted_at);
        return {
            statusCode: 200,
            body: {
                forms: activeForms,
                count: activeForms.length,
            },
        };
    }
    async get(_tenantId, formId) {
        const form = await db_1.db.get(FORMS_TABLE, { form_id: formId });
        if (!form || form.deleted_at) {
            throw new errors_1.ApiError('This form doesn\'t exist or has been removed', 404);
        }
        // Removed tenant_id check - allow access to all forms from all accounts
        return {
            statusCode: 200,
            body: form,
        };
    }
    async getPublicForm(slug) {
        logger_1.logger.info('getPublicForm called with slug', { slug, type: typeof slug });
        try {
            const formsResult = await db_1.db.query(FORMS_TABLE, 'gsi_public_slug', 'public_slug = :slug', { ':slug': slug });
            const forms = (0, db_1.normalizeQueryResult)(formsResult);
            logger_1.logger.info('Query returned forms', { count: forms.length });
            if (forms.length === 0) {
                throw new errors_1.ApiError('This form doesn\'t exist or has been removed', 404);
            }
            const form = forms[0];
            if (form.deleted_at) {
                throw new errors_1.ApiError('This form doesn\'t exist or has been removed', 404);
            }
            // Fetch user settings to get logo URL
            let logoUrl;
            try {
                const settings = await db_1.db.get(USER_SETTINGS_TABLE, { tenant_id: form.tenant_id });
                logoUrl = settings?.logo_url;
            }
            catch (error) {
                logger_1.logger.warn('Failed to fetch user settings for logo', { error });
                // Continue without logo if settings fetch fails
            }
            // Ensure name, email, and phone fields are always present
            const fieldsWithRequired = (0, formFieldUtils_1.ensureRequiredFields)(form.form_fields_schema.fields);
            // Return only public fields
            return {
                statusCode: 200,
                body: {
                    form_id: form.form_id,
                    form_name: form.form_name,
                    public_slug: form.public_slug,
                    form_fields_schema: {
                        fields: fieldsWithRequired,
                    },
                    captcha_enabled: form.captcha_enabled,
                    custom_css: form.custom_css,
                    thank_you_message: form.thank_you_message,
                    logo_url: logoUrl,
                },
            };
        }
        catch (error) {
            logger_1.logger.error('Error in getPublicForm', { error });
            throw error;
        }
    }
    async submitForm(slug, body, sourceIp) {
        // Get form by slug
        const formsResult = await db_1.db.query(FORMS_TABLE, 'gsi_public_slug', 'public_slug = :slug', { ':slug': slug });
        const forms = (0, db_1.normalizeQueryResult)(formsResult);
        if (forms.length === 0) {
            throw new errors_1.ApiError('This form doesn\'t exist or has been removed', 404);
        }
        const form = forms[0];
        if (form.deleted_at) {
            throw new errors_1.ApiError('This form doesn\'t exist or has been removed', 404);
        }
        // Validate submission data
        const { submission_data } = (0, validation_1.validate)(validation_1.submitFormSchema, body);
        // Note: Rate limiting can be implemented here based on sourceIp and form.rate_limit_per_hour if needed
        // Submit form and start job processing
        const result = await formSubmissionService_1.formSubmissionService.submitFormAndStartJob(form, submission_data, sourceIp, form.thank_you_message, form.redirect_url);
        return {
            statusCode: 202,
            body: {
                message: result.message,
                job_id: result.jobId,
                redirect_url: result.redirectUrl,
            },
        };
    }
    async create(tenantId, body) {
        const data = (0, validation_1.validate)(validation_1.createFormSchema, body);
        // Enforce 1:1 relationship: Check if workflow already has a form
        const existingFormsResult = await db_1.db.query(FORMS_TABLE, 'gsi_workflow_id', 'workflow_id = :workflow_id', { ':workflow_id': data.workflow_id });
        const existingForms = (0, db_1.normalizeQueryResult)(existingFormsResult);
        const activeForm = existingForms.find((f) => !f.deleted_at);
        if (activeForm) {
            throw new errors_1.ApiError('This lead magnet already has a form. Forms are automatically created with lead magnets.', 400);
        }
        // Check if slug is unique
        const slugCheckResult = await db_1.db.query(FORMS_TABLE, 'gsi_public_slug', 'public_slug = :slug', { ':slug': data.public_slug });
        const slugCheck = (0, db_1.normalizeQueryResult)(slugCheckResult);
        if (slugCheck.length > 0 && !slugCheck[0].deleted_at) {
            throw new errors_1.ApiError('This form URL is already taken. Please choose a different one', 400);
        }
        // Ensure name, email, and phone fields are always present
        data.form_fields_schema.fields = (0, formFieldUtils_1.ensureRequiredFields)(data.form_fields_schema.fields);
        const form = {
            form_id: `form_${(0, ulid_1.ulid)()}`,
            tenant_id: tenantId,
            ...data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        await db_1.db.put(FORMS_TABLE, form);
        return {
            statusCode: 201,
            body: form,
        };
    }
    async update(_tenantId, formId, body) {
        const existing = await db_1.db.get(FORMS_TABLE, { form_id: formId });
        if (!existing || existing.deleted_at) {
            throw new errors_1.ApiError('This form doesn\'t exist or has been removed', 404);
        }
        // Removed tenant_id check - allow access to all forms from all accounts
        const data = (0, validation_1.validate)(validation_1.updateFormSchema, body);
        // If updating slug, check uniqueness
        if (data.public_slug && data.public_slug !== existing.public_slug) {
            const existingFormsResult = await db_1.db.query(FORMS_TABLE, 'gsi_public_slug', 'public_slug = :slug', { ':slug': data.public_slug });
            const existingForms = (0, db_1.normalizeQueryResult)(existingFormsResult);
            if (existingForms.length > 0) {
                throw new errors_1.ApiError('This form URL is already taken. Please choose a different one', 400);
            }
        }
        // Ensure name, email, and phone fields are always present if form_fields_schema is being updated
        if (data.form_fields_schema && data.form_fields_schema.fields) {
            data.form_fields_schema.fields = (0, formFieldUtils_1.ensureRequiredFields)(data.form_fields_schema.fields);
        }
        const updated = await db_1.db.update(FORMS_TABLE, { form_id: formId }, {
            ...data,
            updated_at: new Date().toISOString(),
        });
        return {
            statusCode: 200,
            body: updated,
        };
    }
    async delete(_tenantId, formId) {
        const existing = await db_1.db.get(FORMS_TABLE, { form_id: formId });
        if (!existing || existing.deleted_at) {
            throw new errors_1.ApiError('This form doesn\'t exist or has been removed', 404);
        }
        // Removed tenant_id check - allow access to all forms from all accounts
        // Prevent deletion if form is linked to a workflow
        // Forms should be managed through workflows
        if (existing.workflow_id) {
            throw new errors_1.ApiError('Forms cannot be deleted directly. Delete the associated lead magnet instead.', 400);
        }
        // Soft delete
        await db_1.db.update(FORMS_TABLE, { form_id: formId }, {
            deleted_at: new Date().toISOString(),
        });
        return {
            statusCode: 204,
            body: {},
        };
    }
    async generateCSS(tenantId, body) {
        const css = await cssGenerationService_1.cssGenerationService.generateCSS({
            form_fields_schema: body.form_fields_schema,
            css_prompt: body.css_prompt,
            model: body.model,
            tenantId,
        });
        return {
            statusCode: 200,
            body: {
                css,
            },
        };
    }
    async refineCSS(tenantId, body) {
        const css = await cssGenerationService_1.cssGenerationService.refineCSS({
            current_css: body.current_css,
            css_prompt: body.css_prompt,
            model: body.model,
            tenantId,
        });
        return {
            statusCode: 200,
            body: {
                css,
            },
        };
    }
}
exports.formsController = new FormsController();
//# sourceMappingURL=forms.js.map