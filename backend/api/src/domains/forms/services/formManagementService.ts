import { ulid } from 'ulid';
import { db, normalizeQueryResult } from '@utils/db';
import { ApiError } from '@utils/errors';
import { logger } from '@utils/logger';
import { ensureRequiredFields } from '@utils/formFieldUtils';
import { validate, createFormSchema, updateFormSchema, submitFormSchema } from '@utils/validation';
import { formSubmissionService, FormSubmissionData } from './formSubmissionService';
import { rateLimitService } from '@services/rateLimitService';
import { fileService } from '@services/files/fileService';
import { s3Service } from '@services/s3Service';
import { env } from '@utils/env';

const FORMS_TABLE = env.formsTable;
const USER_SETTINGS_TABLE = env.userSettingsTable;

function normalizeOriginHeader(value: string | undefined): string | undefined {
  const raw = (value || "").trim();
  if (!raw) return undefined;
  try {
    return new URL(raw).origin;
  } catch {
    // If caller provided hostname only, assume https.
    try {
      return new URL(`https://${raw}`).origin;
    } catch {
      return undefined;
    }
  }
}

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

  private isPlatformOrigin(origin: string): boolean {
    const normalized = normalizeOriginHeader(origin);
    if (!normalized) return false;
    try {
      const url = new URL(normalized);
      const host = url.hostname.toLowerCase();

      // Default platform hosts
      if (host.endsWith(".cloudfront.net")) return true;
      if (host === "localhost" || host === "127.0.0.1") return true;

      // Optional explicit allow-list for platform origins (comma-separated origins)
      const configured = (process.env.PLATFORM_ORIGINS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => normalizeOriginHeader(s))
        .filter(Boolean) as string[];

      return configured.includes(normalized);
    } catch {
      return false;
    }
  }

  async getPublicForm(
    slug: string,
    requestOrigin?: string,
  ): Promise<Record<string, any>> {
    logger.info('getPublicForm called with slug', { slug, type: typeof slug });

    try {
      const form = await this.getActiveFormBySlug(slug);

      const normalizedOrigin = normalizeOriginHeader(requestOrigin);
      const isCustomOrigin = Boolean(
        normalizedOrigin && !this.isPlatformOrigin(normalizedOrigin),
      );

      // Fetch tenant settings once if we need either: fallback branding OR custom-domain enforcement.
      let settings: any | undefined;
      if (USER_SETTINGS_TABLE && (!form.logo_url || isCustomOrigin)) {
        try {
          settings = await db.get(USER_SETTINGS_TABLE, {
            tenant_id: form.tenant_id,
          });
        } catch (error) {
          logger.warn("Failed to fetch user settings", { error });
        }
      }

      // Enforce per-tenant custom domain mapping:
      // - Requests coming from platform origins (CloudFront default, localhost, etc.) are always allowed.
      // - Requests coming from any other origin must match the tenant's `settings.custom_domain`.
      if (isCustomOrigin) {
        const tenantCustom = normalizeOriginHeader(settings?.custom_domain);
        if (!tenantCustom || tenantCustom !== normalizedOrigin) {
          throw new ApiError("This form doesn't exist or has been removed", 404);
        }
      }

      // Prefer form-specific logo, otherwise fall back to tenant settings
      const logoUrl: string | undefined = form.logo_url || settings?.logo_url;

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

  async submitPublicForm(
    slug: string,
    body: any,
    sourceIp: string,
    requestOrigin?: string,
  ): Promise<{
    message: string;
    job_id: string;
    redirect_url?: string;
  }> {
    const form = await this.getActiveFormBySlug(slug);

    const normalizedOrigin = normalizeOriginHeader(requestOrigin);
    const isCustomOrigin = Boolean(
      normalizedOrigin && !this.isPlatformOrigin(normalizedOrigin),
    );

    if (isCustomOrigin && USER_SETTINGS_TABLE) {
      try {
        const settings = await db.get(USER_SETTINGS_TABLE, {
          tenant_id: form.tenant_id,
        });
        const tenantCustom = normalizeOriginHeader(settings?.custom_domain);
        if (!tenantCustom || tenantCustom !== normalizedOrigin) {
          throw new ApiError("This form doesn't exist or has been removed", 404);
        }
      } catch (error) {
        if (error instanceof ApiError) throw error;
        logger.warn("Failed to enforce custom domain for form submission", {
          error: error instanceof Error ? error.message : String(error),
          tenantId: form.tenant_id,
          slug,
          origin: requestOrigin,
        });
        // Fail closed to prevent cross-tenant domain leakage when custom origin is used.
        throw new ApiError("This form doesn't exist or has been removed", 404);
      }
    } else if (isCustomOrigin && !USER_SETTINGS_TABLE) {
      // Shouldn't happen in deployed environments (USER_SETTINGS_TABLE is required),
      // but fail closed if it does.
      throw new ApiError("This form doesn't exist or has been removed", 404);
    }

    // Public endpoint hardening: per-form, per-IP rate limiting (DynamoDB + TTL).
    // Fail-open if limiter storage is misconfigured/unavailable, but fail-closed when the limit is exceeded.
    if (form.rate_limit_enabled) {
      await rateLimitService.consumeFormSubmissionToken({
        tenantId: form.tenant_id,
        formId: form.form_id,
        sourceIp,
        limitPerHour: form.rate_limit_per_hour || 10,
      });
    }

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

  async uploadPublicFormFile(
    slug: string,
    body: any,
    sourceIp: string,
    requestOrigin?: string,
  ): Promise<{
    file_id: string;
    original_filename: string;
    file_size: number;
    content_type: string;
    download_url: string;
  }> {
    const form = await this.getActiveFormBySlug(slug);

    const normalizedOrigin = normalizeOriginHeader(requestOrigin);
    const isCustomOrigin = Boolean(
      normalizedOrigin && !this.isPlatformOrigin(normalizedOrigin),
    );

    if (isCustomOrigin && USER_SETTINGS_TABLE) {
      try {
        const settings = await db.get(USER_SETTINGS_TABLE, {
          tenant_id: form.tenant_id,
        });
        const tenantCustom = normalizeOriginHeader(settings?.custom_domain);
        if (!tenantCustom || tenantCustom !== normalizedOrigin) {
          throw new ApiError("This form doesn't exist or has been removed", 404);
        }
      } catch (error) {
        if (error instanceof ApiError) throw error;
        logger.warn("Failed to enforce custom domain for form upload", {
          error: error instanceof Error ? error.message : String(error),
          tenantId: form.tenant_id,
          slug,
          origin: requestOrigin,
          sourceIp,
        });
        throw new ApiError("This form doesn't exist or has been removed", 404);
      }
    } else if (isCustomOrigin && !USER_SETTINGS_TABLE) {
      throw new ApiError("This form doesn't exist or has been removed", 404);
    }

    if (!body?.file || !body?.filename) {
      throw new ApiError("File and filename are required", 400);
    }

    let fileBuffer: Buffer;
    if (typeof body.file === "string") {
      fileBuffer = Buffer.from(body.file, "base64");
    } else if (Buffer.isBuffer(body.file)) {
      fileBuffer = body.file;
    } else {
      throw new ApiError("Invalid file format", 400);
    }

    const fileRecord = await fileService.uploadFile(
      form.tenant_id,
      fileBuffer,
      body.filename,
      {
        category: "form_uploads",
        fileType: "form_upload",
        contentType: body.contentType,
      },
    );
    const downloadUrl = await s3Service.getFileUrl(fileRecord.s3_key);

    return {
      file_id: fileRecord.file_id,
      original_filename: fileRecord.original_filename,
      file_size: fileRecord.file_size,
      content_type: fileRecord.content_type,
      download_url: downloadUrl,
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
