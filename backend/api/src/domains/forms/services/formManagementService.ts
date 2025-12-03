import { ulid } from 'ulid';
import { db, normalizeQueryResult } from '@utils/db';
import { ApiError } from '@utils/errors';
import { logger } from '@utils/logger';
import { ensureRequiredFields } from '@utils/formFieldUtils';
import { validate, createFormSchema, updateFormSchema, submitFormSchema } from '@utils/validation';
import { formSubmissionService, FormSubmissionData } from './formSubmissionService';
import { env } from '@utils/env';

const FORMS_TABLE = env.formsTable;
const USER_SETTINGS_TABLE = env.userSettingsTable;

class FormManagementService {
  async listForms(tenantId: string, limit = 50): Promise<{ forms: any[]; count: number }> {
    const formsResult = await db.query(
      FORMS_TABLE,
      'gsi_tenant_id',
      'tenant_id = :tenant_id',
      { ':tenant_id': tenantId },
      undefined,
      limit
    );
    const forms = normalizeQueryResult(formsResult);
    const activeForms = forms.filter((f: any) => !f.deleted_at);

    return {
      forms: activeForms,
      count: activeForms.length,
    };
  }

  async getForm(tenantId: string, formId: string): Promise<any> {
    const form = await db.get(FORMS_TABLE, { form_id: formId });

    if (!form || form.deleted_at) {
      throw new ApiError('This form doesn\'t exist or has been removed', 404);
    }

    if (form.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this form', 403);
    }

    return form;
  }

  async getPublicForm(slug: string): Promise<Record<string, any>> {
    logger.info('getPublicForm called with slug', { slug, type: typeof slug });

    try {
      const form = await this.getActiveFormBySlug(slug);

      // Fetch user settings to get logo URL
      let logoUrl: string | undefined;
      try {
        const settings = await db.get(USER_SETTINGS_TABLE, { tenant_id: form.tenant_id });
        logoUrl = settings?.logo_url;
      } catch (error) {
        logger.warn('Failed to fetch user settings for logo', { error });
      }

      const fieldsWithRequired = ensureRequiredFields(form.form_fields_schema.fields);

      return {
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
      };
    } catch (error) {
      logger.error('Error in getPublicForm', { error });
      throw error;
    }
  }

  async submitPublicForm(slug: string, body: any, sourceIp: string): Promise<{
    message: string;
    job_id: string;
    redirect_url?: string;
  }> {
    const form = await this.getActiveFormBySlug(slug);
    const { submission_data } = validate(submitFormSchema, body);

    const result = await formSubmissionService.submitFormAndStartJob(
      form,
      submission_data as FormSubmissionData,
      sourceIp,
      form.thank_you_message,
      form.redirect_url
    );

    return {
      message: result.message,
      job_id: result.jobId,
      redirect_url: result.redirectUrl,
    };
  }

  async createForm(tenantId: string, body: any): Promise<any> {
    const data = validate(createFormSchema, body);

    await this.ensureWorkflowHasNoActiveForm(data.workflow_id);
    await this.assertSlugIsUnique(data.public_slug);

    data.form_fields_schema.fields = ensureRequiredFields(data.form_fields_schema.fields);

    const now = new Date().toISOString();
    const form = {
      form_id: `form_${ulid()}`,
      tenant_id: tenantId,
      ...data,
      created_at: now,
      updated_at: now,
    };

    await db.put(FORMS_TABLE, form);
    return form;
  }

  async updateForm(tenantId: string, formId: string, body: any): Promise<any> {
    const existing = await this.getForm(tenantId, formId);
    const data = validate(updateFormSchema, body);

    if (data.public_slug && data.public_slug !== existing.public_slug) {
      await this.assertSlugIsUnique(data.public_slug);
    }

    if (data.form_fields_schema?.fields) {
      data.form_fields_schema.fields = ensureRequiredFields(data.form_fields_schema.fields);
    }

    const updated = await db.update(FORMS_TABLE, { form_id: formId }, {
      ...data,
      updated_at: new Date().toISOString(),
    });

    return updated;
  }

  async deleteForm(tenantId: string, formId: string): Promise<void> {
    const existing = await this.getForm(tenantId, formId);

    if (existing.workflow_id) {
      throw new ApiError('Forms cannot be deleted directly. Delete the associated lead magnet instead.', 400);
    }

    await db.update(FORMS_TABLE, { form_id: formId }, {
      deleted_at: new Date().toISOString(),
    });
  }

  private async getActiveFormBySlug(slug: string): Promise<any> {
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

    return form;
  }

  private async ensureWorkflowHasNoActiveForm(workflowId: string): Promise<void> {
    const existingFormsResult = await db.query(
      FORMS_TABLE,
      'gsi_workflow_id',
      'workflow_id = :workflow_id',
      { ':workflow_id': workflowId }
    );
    const existingForms = normalizeQueryResult(existingFormsResult);

    const activeForm = existingForms.find((f: any) => !f.deleted_at);
    if (activeForm) {
      throw new ApiError('This lead magnet already has a form. Forms are automatically created with lead magnets.', 400);
    }
  }

  private async assertSlugIsUnique(slug: string): Promise<void> {
    const slugCheckResult = await db.query(
      FORMS_TABLE,
      'gsi_public_slug',
      'public_slug = :slug',
      { ':slug': slug }
    );
    const slugCheck = normalizeQueryResult(slugCheckResult);

    if (slugCheck.length > 0 && !slugCheck[0].deleted_at) {
      throw new ApiError('This form URL is already taken. Please choose a different one', 400);
    }
  }
}

export const formManagementService = new FormManagementService();
