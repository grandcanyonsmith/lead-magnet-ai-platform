import { ulid } from 'ulid';
import { db, normalizeQueryResult } from '../utils/db';
import { validate, createFormSchema, updateFormSchema, submitFormSchema } from '../utils/validation';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';
import { logger } from '../utils/logger';
import { ensureRequiredFields } from '../utils/formFieldUtils';
import { cssGenerationService } from '../services/cssGenerationService';
import { formSubmissionService, FormSubmissionData } from '../services/formSubmissionService';
import { env } from '../utils/env';

const FORMS_TABLE = env.formsTable;
const USER_SETTINGS_TABLE = env.userSettingsTable;

class FormsController {
  async list(_tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse> {
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;

    // Remove tenant_id filtering - show all forms from all accounts
    const formsResult = { items: await db.scan(FORMS_TABLE, limit) };
    const forms = normalizeQueryResult(formsResult);

    // Filter out soft-deleted items
    const activeForms = forms.filter((f: any) => !f.deleted_at);

    return {
      statusCode: 200,
      body: {
        forms: activeForms,
        count: activeForms.length,
      },
    };
  }

  async get(_tenantId: string, formId: string): Promise<RouteResponse> {
    const form = await db.get(FORMS_TABLE, { form_id: formId });

    if (!form || form.deleted_at) {
      throw new ApiError('This form doesn\'t exist or has been removed', 404);
    }

    // Removed tenant_id check - allow access to all forms from all accounts

    return {
      statusCode: 200,
      body: form,
    };
  }

  async getPublicForm(slug: string): Promise<RouteResponse> {
    logger.info('getPublicForm called with slug', { slug, type: typeof slug });
    
    try {
      const formsResult = await db.query(
        FORMS_TABLE,
        'gsi_public_slug',
        'public_slug = :slug',
        { ':slug': slug }
      );
      const forms = normalizeQueryResult(formsResult);
      
      logger.info('Query returned forms', { count: forms.length });

      if (forms.length === 0) {
        throw new ApiError('This form doesn\'t exist or has been removed', 404);
      }

      const form = forms[0];

      if (form.deleted_at) {
        throw new ApiError('This form doesn\'t exist or has been removed', 404);
      }

      // Fetch user settings to get logo URL
      let logoUrl: string | undefined;
      try {
        const settings = await db.get(USER_SETTINGS_TABLE, { tenant_id: form.tenant_id });
        logoUrl = settings?.logo_url;
      } catch (error) {
        logger.warn('Failed to fetch user settings for logo', { error });
        // Continue without logo if settings fetch fails
      }

      // Ensure name, email, and phone fields are always present
      const fieldsWithRequired = ensureRequiredFields(form.form_fields_schema.fields);

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
    } catch (error) {
      logger.error('Error in getPublicForm', { error });
      throw error;
    }
  }

  async submitForm(slug: string, body: any, sourceIp: string): Promise<RouteResponse> {
    // Get form by slug
    const formsResult = await db.query(
      FORMS_TABLE,
      'gsi_public_slug',
      'public_slug = :slug',
      { ':slug': slug }
    );
    const forms = normalizeQueryResult(formsResult);

    if (forms.length === 0) {
      throw new ApiError('This form doesn\'t exist or has been removed', 404);
    }

    const form = forms[0];

    if (form.deleted_at) {
      throw new ApiError('This form doesn\'t exist or has been removed', 404);
    }

    // Validate submission data
    const { submission_data } = validate(submitFormSchema, body);

    // Note: Rate limiting can be implemented here based on sourceIp and form.rate_limit_per_hour if needed

    // Submit form and start job processing
    const result = await formSubmissionService.submitFormAndStartJob(
      form,
      submission_data as FormSubmissionData,
      sourceIp,
      form.thank_you_message,
      form.redirect_url
    );

    return {
      statusCode: 202,
      body: {
        message: result.message,
        job_id: result.jobId,
        redirect_url: result.redirectUrl,
      },
    };
  }

  async create(tenantId: string, body: any): Promise<RouteResponse> {
    const data = validate(createFormSchema, body);

    // Enforce 1:1 relationship: Check if workflow already has a form
    const existingFormsResult = await db.query(
      FORMS_TABLE,
      'gsi_workflow_id',
      'workflow_id = :workflow_id',
      { ':workflow_id': data.workflow_id }
    );
    const existingForms = normalizeQueryResult(existingFormsResult);

    const activeForm = existingForms.find((f: any) => !f.deleted_at);
    if (activeForm) {
      throw new ApiError('This lead magnet already has a form. Forms are automatically created with lead magnets.', 400);
    }

    // Check if slug is unique
    const slugCheckResult = await db.query(
      FORMS_TABLE,
      'gsi_public_slug',
      'public_slug = :slug',
      { ':slug': data.public_slug }
    );
    const slugCheck = normalizeQueryResult(slugCheckResult);

    if (slugCheck.length > 0 && !slugCheck[0].deleted_at) {
      throw new ApiError('This form URL is already taken. Please choose a different one', 400);
    }

    // Ensure name, email, and phone fields are always present
    data.form_fields_schema.fields = ensureRequiredFields(data.form_fields_schema.fields);

    const form = {
      form_id: `form_${ulid()}`,
      tenant_id: tenantId,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.put(FORMS_TABLE, form);

    return {
      statusCode: 201,
      body: form,
    };
  }

  async update(_tenantId: string, formId: string, body: any): Promise<RouteResponse> {
    const existing = await db.get(FORMS_TABLE, { form_id: formId });

    if (!existing || existing.deleted_at) {
      throw new ApiError('This form doesn\'t exist or has been removed', 404);
    }

    // Removed tenant_id check - allow access to all forms from all accounts

    const data = validate(updateFormSchema, body);

    // If updating slug, check uniqueness
    if (data.public_slug && data.public_slug !== existing.public_slug) {
      const existingFormsResult = await db.query(
        FORMS_TABLE,
        'gsi_public_slug',
        'public_slug = :slug',
        { ':slug': data.public_slug }
      );
      const existingForms = normalizeQueryResult(existingFormsResult);

      if (existingForms.length > 0) {
        throw new ApiError('This form URL is already taken. Please choose a different one', 400);
      }
    }

    // Ensure name, email, and phone fields are always present if form_fields_schema is being updated
    if (data.form_fields_schema && data.form_fields_schema.fields) {
      data.form_fields_schema.fields = ensureRequiredFields(data.form_fields_schema.fields);
    }

    const updated = await db.update(FORMS_TABLE, { form_id: formId }, {
      ...data,
      updated_at: new Date().toISOString(),
    });

    return {
      statusCode: 200,
      body: updated,
    };
  }

  async delete(_tenantId: string, formId: string): Promise<RouteResponse> {
    const existing = await db.get(FORMS_TABLE, { form_id: formId });

    if (!existing || existing.deleted_at) {
      throw new ApiError('This form doesn\'t exist or has been removed', 404);
    }

    // Removed tenant_id check - allow access to all forms from all accounts

    // Prevent deletion if form is linked to a workflow
    // Forms should be managed through workflows
    if (existing.workflow_id) {
      throw new ApiError('Forms cannot be deleted directly. Delete the associated lead magnet instead.', 400);
    }

    // Soft delete
    await db.update(FORMS_TABLE, { form_id: formId }, {
      deleted_at: new Date().toISOString(),
    });

    return {
      statusCode: 204,
      body: {},
    };
  }

  async generateCSS(tenantId: string, body: any): Promise<RouteResponse> {
    const css = await cssGenerationService.generateCSS({
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

  async refineCSS(tenantId: string, body: any): Promise<RouteResponse> {
    const css = await cssGenerationService.refineCSS({
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

export const formsController = new FormsController();

