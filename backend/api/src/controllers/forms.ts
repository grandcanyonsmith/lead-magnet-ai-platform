import { ulid } from 'ulid';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { db } from '../utils/db';
import { validate, createFormSchema, updateFormSchema, submitFormSchema } from '../utils/validation';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';
import { logger } from '../utils/logger';

const FORMS_TABLE = process.env.FORMS_TABLE!;
const SUBMISSIONS_TABLE = process.env.SUBMISSIONS_TABLE!;
const JOBS_TABLE = process.env.JOBS_TABLE!;
const STEP_FUNCTIONS_ARN = process.env.STEP_FUNCTIONS_ARN!;

const sfnClient = new SFNClient({ region: process.env.AWS_REGION });

class FormsController {
  async list(tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse> {
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;

    const forms = await db.query(
      FORMS_TABLE,
      'gsi_tenant_id',
      'tenant_id = :tenant_id',
      { ':tenant_id': tenantId },
      undefined,
      limit
    );

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

  async get(tenantId: string, formId: string): Promise<RouteResponse> {
    const form = await db.get(FORMS_TABLE, { form_id: formId });

    if (!form || form.deleted_at) {
      throw new ApiError('Form not found', 404);
    }

    if (form.tenant_id !== tenantId) {
      throw new ApiError('Unauthorized', 403);
    }

    return {
      statusCode: 200,
      body: form,
    };
  }

  async getPublicForm(slug: string): Promise<RouteResponse> {
    // DEBUG: Log the slug value
    console.log('getPublicForm called with slug:', slug, 'type:', typeof slug);
    
    try {
      const forms = await db.query(
        FORMS_TABLE,
        'gsi_public_slug',
        'public_slug = :slug',
        { ':slug': slug }
      );
      
      console.log('Query returned forms:', forms);

      if (forms.length === 0) {
        throw new ApiError('Form not found', 404);
      }

      const form = forms[0];

      if (form.deleted_at) {
        throw new ApiError('Form not found', 404);
      }

      // Return only public fields
      return {
        statusCode: 200,
        body: {
          form_id: form.form_id,
          form_name: form.form_name,
          public_slug: form.public_slug,
          form_fields_schema: form.form_fields_schema,
          captcha_enabled: form.captcha_enabled,
          custom_css: form.custom_css,
          thank_you_message: form.thank_you_message,
        },
      };
    } catch (error) {
      console.error('Error in getPublicForm:', error);
      throw error;
    }
  }

  async submitForm(slug: string, body: any, sourceIp: string): Promise<RouteResponse> {
    // Get form by slug
    const forms = await db.query(
      FORMS_TABLE,
      'gsi_public_slug',
      'public_slug = :slug',
      { ':slug': slug }
    );

    if (forms.length === 0) {
      throw new ApiError('Form not found', 404);
    }

    const form = forms[0];

    if (form.deleted_at) {
      throw new ApiError('Form not found', 404);
    }

    // Validate submission data
    const { submission_data } = validate(submitFormSchema, body);

    // TODO: Add rate limiting check based on sourceIp and form.rate_limit_per_hour

    // Create submission record
    const submissionId = `sub_${ulid()}`;
    const submission = {
      submission_id: submissionId,
      tenant_id: form.tenant_id,
      form_id: form.form_id,
      workflow_id: form.workflow_id,
      submission_data,
      submitter_ip: sourceIp,
      submitter_email: submission_data.email || null,
      submitter_phone: submission_data.phone || null,
      created_at: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90 days
    };

    await db.put(SUBMISSIONS_TABLE, submission);

    // Create job record
    const jobId = `job_${ulid()}`;
    const job = {
      job_id: jobId,
      tenant_id: form.tenant_id,
      workflow_id: form.workflow_id,
      submission_id: submissionId,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.put(JOBS_TABLE, job);

    // Update submission with job_id
    await db.update(SUBMISSIONS_TABLE, { submission_id: submissionId }, { job_id: jobId });

    // Start Step Functions execution
    try {
      const command = new StartExecutionCommand({
        stateMachineArn: STEP_FUNCTIONS_ARN,
        input: JSON.stringify({
          job_id: jobId,
          workflow_id: form.workflow_id,
          submission_id: submissionId,
          tenant_id: form.tenant_id,
        }),
      });

      await sfnClient.send(command);
      logger.info('Started Step Functions execution', { jobId, workflowId: form.workflow_id });
    } catch (error) {
      logger.error('Failed to start Step Functions execution', { error, jobId });
      // Update job status to failed
      await db.update(JOBS_TABLE, { job_id: jobId }, {
        status: 'failed',
        error_message: 'Failed to start processing',
        updated_at: new Date().toISOString(),
      });
      throw new ApiError('Failed to start job processing', 500);
    }

    return {
      statusCode: 202,
      body: {
        message: form.thank_you_message || 'Thank you! Your submission is being processed.',
        job_id: jobId,
        redirect_url: form.redirect_url,
      },
    };
  }

  async create(tenantId: string, body: any): Promise<RouteResponse> {
    const data = validate(createFormSchema, body);

    // Check if slug is unique
    const existingForms = await db.query(
      FORMS_TABLE,
      'gsi_public_slug',
      'public_slug = :slug',
      { ':slug': data.public_slug }
    );

    if (existingForms.length > 0) {
      throw new ApiError('Public slug already exists', 400);
    }

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

  async update(tenantId: string, formId: string, body: any): Promise<RouteResponse> {
    const existing = await db.get(FORMS_TABLE, { form_id: formId });

    if (!existing || existing.deleted_at) {
      throw new ApiError('Form not found', 404);
    }

    if (existing.tenant_id !== tenantId) {
      throw new ApiError('Unauthorized', 403);
    }

    const data = validate(updateFormSchema, body);

    // If updating slug, check uniqueness
    if (data.public_slug && data.public_slug !== existing.public_slug) {
      const existingForms = await db.query(
        FORMS_TABLE,
        'gsi_public_slug',
        'public_slug = :slug',
        { ':slug': data.public_slug }
      );

      if (existingForms.length > 0) {
        throw new ApiError('Public slug already exists', 400);
      }
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

  async delete(tenantId: string, formId: string): Promise<RouteResponse> {
    const existing = await db.get(FORMS_TABLE, { form_id: formId });

    if (!existing || existing.deleted_at) {
      throw new ApiError('Form not found', 404);
    }

    if (existing.tenant_id !== tenantId) {
      throw new ApiError('Unauthorized', 403);
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
}

export const formsController = new FormsController();

