import { ulid } from 'ulid';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import OpenAI from 'openai';
import { db } from '../utils/db';
import { validate, createFormSchema, updateFormSchema, submitFormSchema } from '../utils/validation';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';
import { logger } from '../utils/logger';
import { calculateOpenAICost } from '../services/costService';
import { callResponsesWithTimeout } from '../utils/openaiHelpers';

const FORMS_TABLE = process.env.FORMS_TABLE!;
const SUBMISSIONS_TABLE = process.env.SUBMISSIONS_TABLE!;
const JOBS_TABLE = process.env.JOBS_TABLE!;
const STEP_FUNCTIONS_ARN = process.env.STEP_FUNCTIONS_ARN!;
const USER_SETTINGS_TABLE = process.env.USER_SETTINGS_TABLE!;
const USAGE_RECORDS_TABLE = process.env.USAGE_RECORDS_TABLE || 'leadmagnet-usage-records';
const OPENAI_SECRET_NAME = process.env.OPENAI_SECRET_NAME || 'leadmagnet/openai-api-key';

const sfnClient = new SFNClient({ region: process.env.AWS_REGION || 'us-east-1' });
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

async function getOpenAIClient(): Promise<OpenAI> {
  const command = new GetSecretValueCommand({ SecretId: OPENAI_SECRET_NAME });
  const response = await secretsClient.send(command);
  
  if (!response.SecretString) {
    throw new ApiError('OpenAI API key not found in secret', 500);
  }

  let apiKey: string;
  
  try {
    const parsed = JSON.parse(response.SecretString);
    apiKey = parsed.OPENAI_API_KEY || parsed.apiKey || response.SecretString;
  } catch {
    apiKey = response.SecretString;
  }
  
  if (!apiKey || apiKey.trim().length === 0) {
    throw new ApiError('OpenAI API key is empty', 500);
  }

  return new OpenAI({ apiKey });
}

/**
 * Helper function to store usage record in DynamoDB.
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
    console.error('[Usage Tracking] Failed to store usage record', {
      error: error.message,
      tenantId,
      serviceType,
    });
  }
}

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
      throw new ApiError('This form doesn\'t exist or has been removed', 404);
    }

    if (form.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this form', 403);
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
        console.warn('Failed to fetch user settings for logo:', error);
        // Continue without logo if settings fetch fails
      }

      // Ensure name, email, and phone fields are always present
      const requiredFields = [
        { field_id: 'name', field_type: 'text' as const, label: 'Name', placeholder: 'Your name', required: true },
        { field_id: 'email', field_type: 'email' as const, label: 'Email', placeholder: 'your@email.com', required: true },
        { field_id: 'phone', field_type: 'tel' as const, label: 'Phone', placeholder: 'Your phone number', required: true },
      ];

      const existingFieldIds = new Set(form.form_fields_schema.fields.map((f: any) => f.field_id));
      const fieldsToAdd = requiredFields.filter(f => !existingFieldIds.has(f.field_id));
      
      // Add required fields at the beginning if they don't exist
      const fieldsWithRequired = fieldsToAdd.length > 0 
        ? [...fieldsToAdd, ...form.form_fields_schema.fields]
        : form.form_fields_schema.fields;

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
      throw new ApiError('This form doesn\'t exist or has been removed', 404);
    }

    const form = forms[0];

    if (form.deleted_at) {
      throw new ApiError('This form doesn\'t exist or has been removed', 404);
    }

    // Validate submission data
    const { submission_data } = validate(submitFormSchema, body);

    // TODO: Add rate limiting check based on sourceIp and form.rate_limit_per_hour

    // Ensure name, email, and phone are present (validation should catch this, but double-check)
    if (!submission_data.name || !submission_data.email || !submission_data.phone) {
      throw new ApiError('Form submission must include name, email, and phone fields', 400);
    }

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
      submitter_name: submission_data.name || null,
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
      // Check if we're in local development - process job directly
      if (process.env.IS_LOCAL === 'true' || process.env.NODE_ENV === 'development' || !STEP_FUNCTIONS_ARN) {
        logger.info('Local mode detected, processing job directly', { jobId });
        
        // Import worker processor for local processing
        setImmediate(async () => {
          try {
            const { processJobLocally } = await import('../services/jobProcessor');
            await processJobLocally(jobId, form.tenant_id, form.workflow_id, submissionId);
          } catch (error: any) {
            logger.error('Error processing job in local mode', {
              jobId,
              error: error.message,
              errorStack: error.stack,
            });
            // Update job status to failed
            await db.update(JOBS_TABLE, { job_id: jobId }, {
              status: 'failed',
              error_message: `Processing failed: ${error.message}`,
              updated_at: new Date().toISOString(),
            });
          }
        });
      } else {
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
      }
    } catch (error: any) {
      logger.error('Failed to start job processing', { 
        error: error.message,
        errorStack: error.stack,
        jobId,
        isLocal: process.env.IS_LOCAL === 'true' || process.env.NODE_ENV === 'development',
      });
      // Update job status to failed
      await db.update(JOBS_TABLE, { job_id: jobId }, {
        status: 'failed',
        error_message: `Failed to start processing: ${error.message}`,
        updated_at: new Date().toISOString(),
      });
      throw new ApiError(`Failed to start job processing: ${error.message}`, 500);
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

    // Enforce 1:1 relationship: Check if workflow already has a form
    const existingForms = await db.query(
      FORMS_TABLE,
      'gsi_workflow_id',
      'workflow_id = :workflow_id',
      { ':workflow_id': data.workflow_id }
    );

    const activeForm = existingForms.find((f: any) => !f.deleted_at);
    if (activeForm) {
      throw new ApiError('This lead magnet already has a form. Forms are automatically created with lead magnets.', 400);
    }

    // Check if slug is unique
    const slugCheck = await db.query(
      FORMS_TABLE,
      'gsi_public_slug',
      'public_slug = :slug',
      { ':slug': data.public_slug }
    );

    if (slugCheck.length > 0 && !slugCheck[0].deleted_at) {
      throw new ApiError('This form URL is already taken. Please choose a different one', 400);
    }

    // Ensure name, email, and phone fields are always present
    const requiredFields = [
      { field_id: 'name', field_type: 'text' as const, label: 'Name', placeholder: 'Your name', required: true },
      { field_id: 'email', field_type: 'email' as const, label: 'Email', placeholder: 'your@email.com', required: true },
      { field_id: 'phone', field_type: 'tel' as const, label: 'Phone', placeholder: 'Your phone number', required: true },
    ];

    const existingFieldIds = new Set(data.form_fields_schema.fields.map((f: any) => f.field_id));
    const fieldsToAdd = requiredFields.filter(f => !existingFieldIds.has(f.field_id));
    
    // Add required fields at the beginning
    data.form_fields_schema.fields = [...fieldsToAdd, ...data.form_fields_schema.fields];

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
      throw new ApiError('This form doesn\'t exist or has been removed', 404);
    }

    if (existing.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this form', 403);
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
        throw new ApiError('This form URL is already taken. Please choose a different one', 400);
      }
    }

    // Ensure name, email, and phone fields are always present if form_fields_schema is being updated
    if (data.form_fields_schema && data.form_fields_schema.fields) {
      const requiredFields = [
        { field_id: 'name', field_type: 'text' as const, label: 'Name', placeholder: 'Your name', required: true },
        { field_id: 'email', field_type: 'email' as const, label: 'Email', placeholder: 'your@email.com', required: true },
        { field_id: 'phone', field_type: 'tel' as const, label: 'Phone', placeholder: 'Your phone number', required: true },
      ];

      const existingFieldIds = new Set(data.form_fields_schema.fields.map((f: any) => f.field_id));
      const fieldsToAdd = requiredFields.filter(f => !existingFieldIds.has(f.field_id));
      
      // Add required fields at the beginning
      data.form_fields_schema.fields = [...fieldsToAdd, ...data.form_fields_schema.fields];
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
      throw new ApiError('This form doesn\'t exist or has been removed', 404);
    }

    if (existing.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this form', 403);
    }

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
    const { form_fields_schema, css_prompt, model = 'gpt-5' } = body;

    if (!form_fields_schema || !form_fields_schema.fields || form_fields_schema.fields.length === 0) {
      throw new ApiError('Form fields schema is required', 400);
    }

    if (!css_prompt || !css_prompt.trim()) {
      throw new ApiError('CSS prompt is required', 400);
    }

    console.log('[Form CSS Generation] Starting CSS generation', {
      tenantId,
      model,
      fieldCount: form_fields_schema.fields.length,
      cssPromptLength: css_prompt.length,
      timestamp: new Date().toISOString(),
    });

    try {
      const openai = await getOpenAIClient();
      console.log('[Form CSS Generation] OpenAI client initialized');

      const fieldsDescription = form_fields_schema.fields.map((f: any) => 
        `- ${f.field_type}: ${f.label} (${f.required ? 'required' : 'optional'})`
      ).join('\n');

      const prompt = `You are an expert CSS designer. Generate CSS styles for a form based on this description: "${css_prompt}"

Form Fields:
${fieldsDescription}

Requirements:
1. Generate valid CSS only (no HTML, no markdown formatting)
2. Style the form container, fields, labels, inputs, textareas, selects, and buttons
3. Use modern, clean design principles
4. Make it responsive and mobile-friendly
5. Apply the requested styling from the description

Return ONLY the CSS code, no markdown formatting, no explanations.`;

      console.log('[Form CSS Generation] Calling OpenAI for CSS generation...', {
        model,
        promptLength: prompt.length,
      });

      const cssStartTime = Date.now();
      const completionParams: any = {
        model,
        instructions: 'You are an expert CSS designer. Return only valid CSS code without markdown formatting.',
        input: prompt,
      };
      // GPT-5 only supports default temperature (1), don't set custom temperature
      if (model !== 'gpt-5') {
        completionParams.temperature = 0.7;
      }
      const completion = await callResponsesWithTimeout(
        () => openai.responses.create(completionParams),
        'form CSS generation'
      );

      const cssDuration = Date.now() - cssStartTime;
      const cssModelUsed = (completion as any).model || model;
      console.log('[Form CSS Generation] CSS generation completed', {
        duration: `${cssDuration}ms`,
        tokensUsed: completion.usage?.total_tokens,
        model: cssModelUsed,
      });

      // Track usage
      const usage = completion.usage;
      if (usage) {
        const inputTokens = usage.input_tokens || 0;
        const outputTokens = usage.output_tokens || 0;
        const costData = calculateOpenAICost(cssModelUsed, inputTokens, outputTokens);
        
        await storeUsageRecord(
          tenantId,
          'openai_form_css',
          cssModelUsed,
          inputTokens,
          outputTokens,
          costData.cost_usd
        );
      }

      const cssContent = completion.output_text || '';
      console.log('[Form CSS Generation] Raw CSS received', {
        cssLength: cssContent.length,
        firstChars: cssContent.substring(0, 100),
      });
      
      // Clean up markdown code blocks if present
      let cleanedCss = cssContent.trim();
      if (cleanedCss.startsWith('```css')) {
        cleanedCss = cleanedCss.replace(/^```css\s*/i, '').replace(/\s*```$/i, '');
        console.log('[Form CSS Generation] Removed ```css markers');
      } else if (cleanedCss.startsWith('```')) {
        cleanedCss = cleanedCss.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
        console.log('[Form CSS Generation] Removed ``` markers');
      }

      const totalDuration = Date.now() - cssStartTime;
      console.log('[Form CSS Generation] Success!', {
        tenantId,
        cssLength: cleanedCss.length,
        totalDuration: `${totalDuration}ms`,
        timestamp: new Date().toISOString(),
      });

      return {
        statusCode: 200,
        body: {
          css: cleanedCss,
        },
      };
    } catch (error: any) {
      console.error('[Form CSS Generation] Error occurred', {
        tenantId,
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
        timestamp: new Date().toISOString(),
      });
      throw new ApiError(
        error.message || 'Failed to generate CSS with AI',
        500
      );
    }
  }

  async refineCSS(tenantId: string, body: any): Promise<RouteResponse> {
    const { current_css, css_prompt, model = 'gpt-5' } = body;

    if (!current_css || !current_css.trim()) {
      throw new ApiError('Current CSS is required', 400);
    }

    if (!css_prompt || !css_prompt.trim()) {
      throw new ApiError('CSS prompt is required', 400);
    }

    console.log('[Form CSS Refinement] Starting refinement', {
      tenantId,
      model,
      currentCssLength: current_css.length,
      cssPromptLength: css_prompt.length,
      timestamp: new Date().toISOString(),
    });

    try {
      const openai = await getOpenAIClient();
      console.log('[Form CSS Refinement] OpenAI client initialized');

      const prompt = `You are an expert CSS designer. Modify the following CSS based on these instructions: "${css_prompt}"

Current CSS:
${current_css}

Requirements:
1. Apply the requested changes while maintaining valid CSS syntax
2. Keep the overall structure unless specifically asked to change it
3. Ensure the CSS remains well-organized and readable
4. Return only the modified CSS code, no markdown formatting, no explanations

Return ONLY the modified CSS code, no markdown formatting, no explanations.`;

      console.log('[Form CSS Refinement] Calling OpenAI for refinement...', {
        model,
        promptLength: prompt.length,
      });

      const refineStartTime = Date.now();
      const completionParams: any = {
        model,
        instructions: 'You are an expert CSS designer. Return only valid CSS code without markdown formatting.',
        input: prompt,
      };
      // GPT-5 only supports default temperature (1), don't set custom temperature
      if (model !== 'gpt-5') {
        completionParams.temperature = 0.7;
      }
      const completion = await callResponsesWithTimeout(
        () => openai.responses.create(completionParams),
        'form CSS refinement'
      );

      const refineDuration = Date.now() - refineStartTime;
      const refineCssModel = (completion as any).model || model;
      console.log('[Form CSS Refinement] Refinement completed', {
        duration: `${refineDuration}ms`,
        tokensUsed: completion.usage?.total_tokens,
        model: refineCssModel,
      });

      // Track usage
      const usage = completion.usage;
      if (usage) {
        const inputTokens = usage.input_tokens || 0;
        const outputTokens = usage.output_tokens || 0;
        const costData = calculateOpenAICost(refineCssModel, inputTokens, outputTokens);
        
        await storeUsageRecord(
          tenantId,
          'openai_form_css_refine',
          refineCssModel,
          inputTokens,
          outputTokens,
          costData.cost_usd
        );
      }

      const cssContent = completion.output_text || '';
      console.log('[Form CSS Refinement] Refined CSS received', {
        cssLength: cssContent.length,
        firstChars: cssContent.substring(0, 100),
      });
      
      // Clean up markdown code blocks if present
      let cleanedCss = cssContent.trim();
      if (cleanedCss.startsWith('```css')) {
        cleanedCss = cleanedCss.replace(/^```css\s*/i, '').replace(/\s*```$/i, '');
        console.log('[Form CSS Refinement] Removed ```css markers');
      } else if (cleanedCss.startsWith('```')) {
        cleanedCss = cleanedCss.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
        console.log('[Form CSS Refinement] Removed ``` markers');
      }

      const totalDuration = Date.now() - refineStartTime;
      console.log('[Form CSS Refinement] Success!', {
        tenantId,
        cssLength: cleanedCss.length,
        totalDuration: `${totalDuration}ms`,
        timestamp: new Date().toISOString(),
      });

      return {
        statusCode: 200,
        body: {
          css: cleanedCss,
        },
      };
    } catch (error: any) {
      console.error('[Form CSS Refinement] Error occurred', {
        tenantId,
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
        timestamp: new Date().toISOString(),
      });
      throw new ApiError(
        error.message || 'Failed to refine CSS with AI',
        500
      );
    }
  }
}

export const formsController = new FormsController();

