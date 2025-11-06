import { ulid } from 'ulid';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import OpenAI from 'openai';
import { db } from '../utils/db';
import { validate, createWorkflowSchema, updateWorkflowSchema } from '../utils/validation';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';
import { calculateOpenAICost } from '../services/costService';
import { callResponsesWithTimeout } from '../utils/openaiHelpers';

const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE;
const FORMS_TABLE = process.env.FORMS_TABLE;
const JOBS_TABLE = process.env.JOBS_TABLE || 'leadmagnet-jobs';
const USAGE_RECORDS_TABLE = process.env.USAGE_RECORDS_TABLE || 'leadmagnet-usage-records';
const OPENAI_SECRET_NAME = process.env.OPENAI_SECRET_NAME || 'leadmagnet/openai-api-key';
const LAMBDA_FUNCTION_NAME = process.env.LAMBDA_FUNCTION_NAME || 'leadmagnet-api-handler';
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });

if (!WORKFLOWS_TABLE) {
  console.error('[Workflows Controller] WORKFLOWS_TABLE environment variable is not set');
}
if (!FORMS_TABLE) {
  console.error('[Workflows Controller] FORMS_TABLE environment variable is not set');
}

/**
 * Generate a URL-friendly slug from a workflow name
 */
function generateSlug(name: string): string {
  return name.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Ensure name, email, and phone fields are always present in form fields
 */
function ensureRequiredFields(fields: any[]): any[] {
  const requiredFields = [
    { field_id: 'name', field_type: 'text' as const, label: 'Name', placeholder: 'Your name', required: true },
    { field_id: 'email', field_type: 'email' as const, label: 'Email', placeholder: 'your@email.com', required: true },
    { field_id: 'phone', field_type: 'tel' as const, label: 'Phone', placeholder: 'Your phone number', required: true },
  ];

  const existingFieldIds = new Set(fields.map((f: any) => f.field_id));
  const fieldsToAdd = requiredFields.filter(f => !existingFieldIds.has(f.field_id));
  
  return fieldsToAdd.length > 0 ? [...fieldsToAdd, ...fields] : fields;
}

/**
 * Create a form for a workflow
 */
async function createFormForWorkflow(
  tenantId: string,
  workflowId: string,
  workflowName: string,
  formFields?: any[]
): Promise<string> {
  if (!FORMS_TABLE) {
    throw new ApiError('FORMS_TABLE environment variable is not configured', 500);
  }

  // Check if workflow already has a form
  const existingForms = await db.query(
    FORMS_TABLE,
    'gsi_workflow_id',
    'workflow_id = :workflow_id',
    { ':workflow_id': workflowId }
  );

  if (existingForms.length > 0 && !existingForms[0].deleted_at) {
    // Workflow already has a form, return existing form_id
    return existingForms[0].form_id;
  }

  // Generate form name and slug
  const formName = `${workflowName} Form`;
  let baseSlug = generateSlug(workflowName);
  let publicSlug = baseSlug;
  let slugCounter = 1;

  // Ensure slug is unique
  while (true) {
      const slugCheck = await db.query(
        FORMS_TABLE!,
        'gsi_public_slug',
        'public_slug = :slug',
        { ':slug': publicSlug }
      );
    
    if (slugCheck.length === 0 || slugCheck[0].deleted_at) {
      break;
    }
    
    publicSlug = `${baseSlug}-${slugCounter}`;
    slugCounter++;
  }

  // Default form fields if not provided
  const defaultFields = formFields || [
    { field_id: 'name', field_type: 'text', label: 'Name', placeholder: 'Your name', required: true },
    { field_id: 'email', field_type: 'email', label: 'Email', placeholder: 'your@email.com', required: true },
    { field_id: 'phone', field_type: 'tel', label: 'Phone', placeholder: 'Your phone number', required: true },
  ];

  const formFieldsWithRequired = ensureRequiredFields(defaultFields);

  const form = {
    form_id: `form_${ulid()}`,
    tenant_id: tenantId,
    workflow_id: workflowId,
    form_name: formName,
    public_slug: publicSlug,
    form_fields_schema: {
      fields: formFieldsWithRequired,
    },
    rate_limit_enabled: true,
    rate_limit_per_hour: 10,
    captcha_enabled: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await db.put(FORMS_TABLE!, form);

  return form.form_id;
}

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

class WorkflowsController {
  async list(tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse> {
    if (!WORKFLOWS_TABLE) {
      throw new ApiError('WORKFLOWS_TABLE environment variable is not configured', 500);
    }

    try {
      const status = queryParams.status;
      const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;

      console.log('[Workflows List] Starting query', { tenantId, status, limit });

      let workflows: any[] = [];
      try {
        if (status) {
          workflows = await db.query(
            WORKFLOWS_TABLE!,
            'gsi_tenant_status',
            'tenant_id = :tenant_id AND #status = :status',
            { ':tenant_id': tenantId, ':status': status },
            { '#status': 'status' },
            limit
          );
        } else {
          workflows = await db.query(
            WORKFLOWS_TABLE!,
            'gsi_tenant_status',
            'tenant_id = :tenant_id',
            { ':tenant_id': tenantId },
            undefined,
            limit
          );
        }
      } catch (dbError: any) {
        console.error('[Workflows List] Database query error', {
          error: dbError.message,
          errorName: dbError.name,
          table: WORKFLOWS_TABLE,
          tenantId,
        });
        // Return empty array if table doesn't exist or permissions issue
        if (
          dbError.name === 'ResourceNotFoundException' ||
          dbError.name === 'AccessDeniedException'
        ) {
          workflows = [];
        } else {
          throw dbError;
        }
      }

      // Filter out soft-deleted items
      workflows = workflows.filter((w: any) => !w.deleted_at);

      // Fetch form data for each workflow, auto-create if missing
      const workflowsWithForms = await Promise.all(
        workflows.map(async (workflow: any) => {
          try {
            const forms = await db.query(
              FORMS_TABLE!,
              'gsi_workflow_id',
              'workflow_id = :workflow_id',
              { ':workflow_id': workflow.workflow_id }
            );
            
            let activeForm = forms.find((f: any) => !f.deleted_at);
            
            // Auto-create form if it doesn't exist
            if (!activeForm && workflow.workflow_name) {
              try {
                console.log('[Workflows List] Auto-creating form for workflow', {
                  workflowId: workflow.workflow_id,
                  workflowName: workflow.workflow_name,
                });
                const formId = await createFormForWorkflow(
                  workflow.tenant_id,
                  workflow.workflow_id,
                  workflow.workflow_name
                );
                
                // Fetch the newly created form
                activeForm = await db.get(FORMS_TABLE!, { form_id: formId });
              } catch (createError) {
                console.error('[Workflows List] Error auto-creating form', {
                  workflowId: workflow.workflow_id,
                  error: (createError as any).message,
                });
              }
            }
            
            return {
              ...workflow,
              form: activeForm ? {
                form_id: activeForm.form_id,
                form_name: activeForm.form_name,
                public_slug: activeForm.public_slug,
                status: activeForm.status,
              } : null,
            };
          } catch (error) {
            console.error('[Workflows List] Error fetching form for workflow', {
              workflowId: workflow.workflow_id,
              error: (error as any).message,
            });
            return {
              ...workflow,
              form: null,
            };
          }
        })
      );

      console.log('[Workflows List] Query completed', {
        tenantId,
        workflowsFound: workflowsWithForms.length,
      });

      const response = {
        statusCode: 200,
        body: {
          workflows: workflowsWithForms,
          count: workflowsWithForms.length,
        },
      };

      console.log('[Workflows List] Returning response', {
        statusCode: response.statusCode,
        bodyKeys: Object.keys(response.body),
        workflowsCount: response.body.count,
        workflowsLength: response.body.workflows?.length,
      });

      return response;
    } catch (error: any) {
      console.error('[Workflows List] Error', {
        error: error.message,
        errorName: error.name,
        stack: error.stack,
        tenantId,
      });
      throw error;
    }
  }

  async get(tenantId: string, workflowId: string): Promise<RouteResponse> {
    if (!WORKFLOWS_TABLE) {
      throw new ApiError('WORKFLOWS_TABLE environment variable is not configured', 500);
    }
    if (!FORMS_TABLE) {
      throw new ApiError('FORMS_TABLE environment variable is not configured', 500);
    }

    const workflow = await db.get(WORKFLOWS_TABLE!, { workflow_id: workflowId });

    if (!workflow || workflow.deleted_at) {
      throw new ApiError('This lead magnet doesn\'t exist or has been removed', 404);
    }

    if (workflow.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this lead magnet', 403);
    }

    // Fetch associated form
    let form = null;
    try {
      const forms = await db.query(
        FORMS_TABLE!,
        'gsi_workflow_id',
        'workflow_id = :workflow_id',
        { ':workflow_id': workflowId }
      );
      
      const activeForm = forms.find((f: any) => !f.deleted_at);
      if (activeForm) {
        form = activeForm;
      }
    } catch (error) {
      console.error('[Workflows Get] Error fetching form', {
        workflowId,
        error: (error as any).message,
      });
    }

    return {
      statusCode: 200,
      body: {
        ...workflow,
        form,
      },
    };
  }

  async create(tenantId: string, body: any): Promise<RouteResponse> {
    if (!WORKFLOWS_TABLE) {
      throw new ApiError('WORKFLOWS_TABLE environment variable is not configured', 500);
    }
    if (!FORMS_TABLE) {
      throw new ApiError('FORMS_TABLE environment variable is not configured', 500);
    }

    const data = validate(createWorkflowSchema, body);

    // Auto-migrate legacy workflows to steps format if needed
    let workflowData = { ...data };
    if (!workflowData.steps || workflowData.steps.length === 0) {
      // Migrate legacy format to steps
      const steps = [];
      
      if (workflowData.research_enabled && workflowData.ai_instructions) {
        steps.push({
          step_name: 'Deep Research',
          step_description: 'Generate comprehensive research report',
          model: workflowData.ai_model || 'o3-deep-research',
          instructions: workflowData.ai_instructions,
          step_order: 0,
        });
      }
      
      if (workflowData.html_enabled) {
        steps.push({
          step_name: 'HTML Rewrite',
          step_description: 'Rewrite content into styled HTML matching template',
          model: workflowData.rewrite_model || 'gpt-5',
          instructions: workflowData.html_enabled 
            ? 'Rewrite the research content into styled HTML matching the provided template. Ensure the output is complete, valid HTML that matches the template\'s design and structure.'
            : 'Generate HTML output',
          step_order: steps.length,
        });
      }
      
      if (steps.length > 0) {
        workflowData.steps = steps;
      }
    } else {
      // Ensure step_order is set for each step
      workflowData.steps = workflowData.steps.map((step: any, index: number) => ({
        ...step,
        step_order: step.step_order !== undefined ? step.step_order : index,
      }));
    }

    const workflowId = `wf_${ulid()}`;
    const workflow = {
      workflow_id: workflowId,
      tenant_id: tenantId,
      ...workflowData,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.put(WORKFLOWS_TABLE!, workflow);

    // Auto-create form for the workflow
    let formId: string | null = null;
    try {
      formId = await createFormForWorkflow(
        tenantId,
        workflowId,
        data.workflow_name,
        body.form_fields_schema?.fields // Allow form fields to be passed during creation
      );
      
      // Update workflow with form_id
      await db.update(WORKFLOWS_TABLE!, { workflow_id: workflowId }, {
        form_id: formId,
      });
      (workflow as any).form_id = formId;
    } catch (error) {
      console.error('[Workflows Create] Error creating form for workflow', {
        workflowId,
        error: (error as any).message,
      });
      // Continue even if form creation fails - workflow is still created
    }

    // Fetch the created form to include in response
    let form = null;
    if (formId) {
      try {
        form = await db.get(FORMS_TABLE!, { form_id: formId });
      } catch (error) {
        console.error('[Workflows Create] Error fetching created form', error);
      }
    }

    return {
      statusCode: 201,
      body: {
        ...workflow,
        form,
      },
    };
  }

  async update(tenantId: string, workflowId: string, body: any): Promise<RouteResponse> {
    if (!WORKFLOWS_TABLE) {
      throw new ApiError('WORKFLOWS_TABLE environment variable is not configured', 500);
    }
    if (!FORMS_TABLE) {
      throw new ApiError('FORMS_TABLE environment variable is not configured', 500);
    }

    const existing = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });

    if (!existing || existing.deleted_at) {
      throw new ApiError('This lead magnet doesn\'t exist or has been removed', 404);
    }

    if (existing.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this lead magnet', 403);
    }

    const data = validate(updateWorkflowSchema, body) as any;

    // Auto-migrate legacy workflows to steps format if updating legacy fields
    let updateData: any = { ...data };
    const hasLegacyFields = data.ai_instructions !== undefined || data.research_enabled !== undefined || data.html_enabled !== undefined;
    const hasSteps = data.steps !== undefined && data.steps.length > 0;
    
    // If updating legacy fields and workflow doesn't have steps yet, migrate
    if (hasLegacyFields && (!existing.steps || existing.steps.length === 0) && !hasSteps) {
      const steps = [];
      const researchEnabled = data.research_enabled !== undefined ? data.research_enabled : existing.research_enabled;
      const htmlEnabled = data.html_enabled !== undefined ? data.html_enabled : existing.html_enabled;
      const aiInstructions = data.ai_instructions || existing.ai_instructions;
      
      if (researchEnabled && aiInstructions) {
        steps.push({
          step_name: 'Deep Research',
          step_description: 'Generate comprehensive research report',
          model: data.ai_model || existing.ai_model || 'o3-deep-research',
          instructions: aiInstructions,
          step_order: 0,
        });
      }
      
      if (htmlEnabled) {
        steps.push({
          step_name: 'HTML Rewrite',
          step_description: 'Rewrite content into styled HTML matching template',
          model: data.rewrite_model || existing.rewrite_model || 'gpt-5',
          instructions: 'Rewrite the research content into styled HTML matching the provided template. Ensure the output is complete, valid HTML that matches the template\'s design and structure.',
          step_order: steps.length,
        });
      }
      
      if (steps.length > 0) {
        updateData.steps = steps;
      }
    } else if (hasSteps) {
      // Ensure step_order is set for each step
      updateData.steps = data.steps.map((step: any, index: number) => ({
        ...step,
        step_order: step.step_order !== undefined ? step.step_order : index,
      }));
    }

    const updated = await db.update(WORKFLOWS_TABLE!, { workflow_id: workflowId }, {
      ...updateData,
      updated_at: new Date().toISOString(),
    });

    // If workflow name changed, update form name
    if (data.workflow_name && data.workflow_name !== existing.workflow_name) {
      try {
        const forms = await db.query(
          FORMS_TABLE,
          'gsi_workflow_id',
          'workflow_id = :workflow_id',
          { ':workflow_id': workflowId }
        );
        
        const activeForm = forms.find((f: any) => !f.deleted_at);
        if (activeForm) {
          const newFormName = `${data.workflow_name} Form`;
          await db.update(FORMS_TABLE!, { form_id: activeForm.form_id }, {
            form_name: newFormName,
            updated_at: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error('[Workflows Update] Error updating form name', {
          workflowId,
          error: (error as any).message,
        });
      }
    }

    // Fetch updated form to include in response
    let form = null;
    try {
      const forms = await db.query(
        FORMS_TABLE!,
        'gsi_workflow_id',
        'workflow_id = :workflow_id',
        { ':workflow_id': workflowId }
      );
      
      const activeForm = forms.find((f: any) => !f.deleted_at);
      if (activeForm) {
        form = activeForm;
      }
    } catch (error) {
      console.error('[Workflows Update] Error fetching form', error);
    }

    return {
      statusCode: 200,
      body: {
        ...updated,
        form,
      },
    };
  }

  async delete(tenantId: string, workflowId: string): Promise<RouteResponse> {
    if (!WORKFLOWS_TABLE) {
      throw new ApiError('WORKFLOWS_TABLE environment variable is not configured', 500);
    }
    if (!FORMS_TABLE) {
      throw new ApiError('FORMS_TABLE environment variable is not configured', 500);
    }

    const existing = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });

    if (!existing || existing.deleted_at) {
      throw new ApiError('This lead magnet doesn\'t exist or has been removed', 404);
    }

    if (existing.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this lead magnet', 403);
    }

    // Soft delete workflow
    await db.update(WORKFLOWS_TABLE!, { workflow_id: workflowId }, {
      deleted_at: new Date().toISOString(),
    });

    // Cascade delete associated form
    try {
      const forms = await db.query(
        FORMS_TABLE!,
        'gsi_workflow_id',
        'workflow_id = :workflow_id',
        { ':workflow_id': workflowId }
      );
      
      for (const form of forms) {
        if (!form.deleted_at) {
          await db.update(FORMS_TABLE!, { form_id: form.form_id }, {
            deleted_at: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error('[Workflows Delete] Error deleting associated form', {
        workflowId,
        error: (error as any).message,
      });
      // Continue even if form deletion fails
    }

    return {
      statusCode: 204,
      body: {},
    };
  }

  async generateWithAI(tenantId: string, body: any): Promise<RouteResponse> {
    const { description, model = 'gpt-5' } = body;

    if (!description || !description.trim()) {
      throw new ApiError('Description is required', 400);
    }

    console.log('[Workflow Generation] Starting async generation', {
      tenantId,
      model,
      descriptionLength: description.length,
      timestamp: new Date().toISOString(),
    });

    // Create workflow generation job record
    const jobId = `wfgen_${ulid()}`;
    const job = {
      job_id: jobId,
      tenant_id: tenantId,
      job_type: 'workflow_generation',
      status: 'pending',
      description,
      model,
      result: null,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.put(JOBS_TABLE, job);
    console.log('[Workflow Generation] Created job record', { jobId });

    // Invoke Lambda asynchronously to process workflow generation
    try {
      // Check if we're in local development - process synchronously
      if (process.env.IS_LOCAL === 'true' || process.env.NODE_ENV === 'development') {
        console.log('[Workflow Generation] Local mode detected, processing synchronously', { jobId });
        // Process the job synchronously in local dev (fire and forget, but with error handling)
        setImmediate(async () => {
          try {
            await this.processWorkflowGenerationJob(jobId, tenantId, description, model);
          } catch (error: any) {
            console.error('[Workflow Generation] Error processing job in local mode', {
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
        const functionArn = `arn:aws:lambda:${process.env.AWS_REGION || 'us-east-1'}:${process.env.AWS_ACCOUNT_ID || '471112574622'}:function:${LAMBDA_FUNCTION_NAME}`;
        
        const invokeCommand = new InvokeCommand({
          FunctionName: functionArn, // Use full ARN for better compatibility
          InvocationType: 'Event', // Async invocation
          Payload: JSON.stringify({
            source: 'workflow-generation-job',
            job_id: jobId,
            tenant_id: tenantId,
            description,
            model,
          }),
        });

        const invokeResponse = await lambdaClient.send(invokeCommand);
        console.log('[Workflow Generation] Triggered async processing', { 
          jobId, 
          functionArn,
          statusCode: invokeResponse.StatusCode,
          requestId: invokeResponse.$metadata.requestId,
        });
        
        // Check if invocation was successful
        if (invokeResponse.StatusCode !== 202 && invokeResponse.StatusCode !== 200) {
          throw new Error(`Lambda invocation returned status ${invokeResponse.StatusCode}`);
        }
      }
    } catch (error: any) {
      console.error('[Workflow Generation] Failed to trigger async processing', {
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
      throw new ApiError(`Failed to start workflow generation: ${error.message}`, 500);
    }

    // Return immediately with job_id
    return {
      statusCode: 202, // Accepted
      body: {
        job_id: jobId,
        status: 'pending',
        message: 'Workflow generation started. Poll /admin/workflows/generation-status/:jobId for status.',
      },
    };
  }

  async processWorkflowGenerationJob(jobId: string, tenantId: string, description: string, model: string): Promise<void> {
    console.log('[Workflow Generation] Processing job', { jobId, tenantId });

    try {
      // Update job status to processing
      await db.update(JOBS_TABLE, { job_id: jobId }, {
        status: 'processing',
        updated_at: new Date().toISOString(),
      });

      // Generate workflow (existing logic)
      const openai = await getOpenAIClient();
      console.log('[Workflow Generation] OpenAI client initialized');

      // Generate workflow configuration
      const workflowPrompt = `You are an expert at creating AI-powered lead magnets. Based on this description: "${description}", generate a complete lead magnet configuration.

Generate:
1. Lead Magnet Name (short, catchy, 2-4 words)
2. Lead Magnet Description (1-2 sentences explaining what it does)
3. Research Instructions (detailed instructions for AI to generate personalized research based on form submission data. Use [field_name] to reference form fields)

Return JSON format:
{
  "workflow_name": "...",
  "workflow_description": "...",
  "research_instructions": "..."
}`;

      console.log('[Workflow Generation] Calling OpenAI for workflow generation...');
      const workflowStartTime = Date.now();
      
      let workflowCompletion;
      try {
        const workflowCompletionParams: any = {
          model,
          instructions: 'You are an expert at creating AI-powered lead magnets. Return only valid JSON without markdown formatting.',
          input: workflowPrompt,
        };
        if (model !== 'gpt-5') {
          workflowCompletionParams.temperature = 0.7;
        }
        workflowCompletion = await callResponsesWithTimeout(
          () => openai.responses.create(workflowCompletionParams),
          'workflow generation'
        );
      } catch (apiError: any) {
        console.error('[Workflow Generation] Responses API error, attempting fallback', {
          error: apiError?.message,
        });
        workflowCompletion = await openai.chat.completions.create({
          model: model === 'gpt-5' ? 'gpt-4o' : model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at creating AI-powered lead magnets. Return only valid JSON without markdown formatting.',
            },
            {
              role: 'user',
              content: workflowPrompt,
            },
          ],
          temperature: model === 'gpt-5' ? undefined : 0.7,
        });
      }

      const workflowDuration = Date.now() - workflowStartTime;
      const workflowUsedModel = (workflowCompletion as any).model || model;
      console.log('[Workflow Generation] Workflow generation completed', {
        duration: `${workflowDuration}ms`,
        tokensUsed: workflowCompletion.usage?.total_tokens,
        modelUsed: workflowUsedModel,
      });

      // Track usage
      const workflowUsage = workflowCompletion.usage;
      if (workflowUsage) {
        const inputTokens = ('input_tokens' in workflowUsage ? workflowUsage.input_tokens : workflowUsage.prompt_tokens) || 0;
        const outputTokens = ('output_tokens' in workflowUsage ? workflowUsage.output_tokens : workflowUsage.completion_tokens) || 0;
        const costData = calculateOpenAICost(workflowUsedModel, inputTokens, outputTokens);
        
        await storeUsageRecord(
          tenantId,
          'openai_workflow_generate',
          workflowUsedModel,
          inputTokens,
          outputTokens,
          costData.cost_usd
        );
      }

      const workflowContent = ('output_text' in workflowCompletion ? workflowCompletion.output_text : workflowCompletion.choices?.[0]?.message?.content) || '';
      let workflowData = {
        workflow_name: 'Generated Lead Magnet',
        workflow_description: description,
        research_instructions: `Generate a personalized report based on form submission data. Use [field_name] to reference form fields.`,
      };

      try {
        const jsonMatch = workflowContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          workflowData = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.warn('[Workflow Generation] Failed to parse workflow JSON, using defaults', e);
      }

      // Generate template HTML
      const templatePrompt = `You are an expert HTML template designer for lead magnets. Create a professional HTML template for: "${description}"

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

      console.log('[Workflow Generation] Calling OpenAI for template HTML generation...');
      const templateStartTime = Date.now();
      
      let templateCompletion;
      try {
        const templateCompletionParams: any = {
          model,
          instructions: 'You are an expert HTML template designer. Return only valid HTML code without markdown formatting.',
          input: templatePrompt,
        };
        if (model !== 'gpt-5') {
          templateCompletionParams.temperature = 0.7;
        }
        templateCompletion = await callResponsesWithTimeout(
          () => openai.responses.create(templateCompletionParams),
          'template HTML generation'
        );
      } catch (apiError: any) {
        console.error('[Workflow Generation] Responses API error for template, attempting fallback', {
          error: apiError?.message,
        });
        templateCompletion = await openai.chat.completions.create({
          model: model === 'gpt-5' ? 'gpt-4o' : model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert HTML template designer. Return only valid HTML code without markdown formatting.',
            },
            {
              role: 'user',
              content: templatePrompt,
            },
          ],
          temperature: model === 'gpt-5' ? undefined : 0.7,
        });
      }

      const templateDuration = Date.now() - templateStartTime;
      const templateModelUsed = (templateCompletion as any).model || model;
      console.log('[Workflow Generation] Template HTML generation completed', {
        duration: `${templateDuration}ms`,
        tokensUsed: templateCompletion.usage?.total_tokens,
        modelUsed: templateModelUsed,
      });

      // Track usage
      const templateUsage = templateCompletion.usage;
      if (templateUsage) {
        const inputTokens = ('input_tokens' in templateUsage ? templateUsage.input_tokens : templateUsage.prompt_tokens) || 0;
        const outputTokens = ('output_tokens' in templateUsage ? templateUsage.output_tokens : templateUsage.completion_tokens) || 0;
        const costData = calculateOpenAICost(templateModelUsed, inputTokens, outputTokens);
        
        await storeUsageRecord(
          tenantId,
          'openai_template_generate',
          templateModelUsed,
          inputTokens,
          outputTokens,
          costData.cost_usd
        );
      }

      let cleanedHtml = ('output_text' in templateCompletion ? templateCompletion.output_text : templateCompletion.choices?.[0]?.message?.content) || '';
      
      // Clean up markdown code blocks if present
      if (cleanedHtml.startsWith('```html')) {
        cleanedHtml = cleanedHtml.replace(/^```html\s*/i, '').replace(/\s*```$/i, '');
      } else if (cleanedHtml.startsWith('```')) {
        cleanedHtml = cleanedHtml.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      }

      const placeholderTags: string[] = [];

      // Generate template name and description
      const templateNamePrompt = `Based on this lead magnet: "${description}", generate:
1. A short, descriptive template name (2-4 words max)
2. A brief template description (1-2 sentences)

Return JSON format: {"name": "...", "description": "..."}`;

      console.log('[Workflow Generation] Calling OpenAI for template name/description generation...');
      const templateNameStartTime = Date.now();
      
      let templateNameCompletion;
      try {
        const templateNameCompletionParams: any = {
          model,
          input: templateNamePrompt,
        };
        if (model !== 'gpt-5') {
          templateNameCompletionParams.temperature = 0.5;
        }
        templateNameCompletion = await callResponsesWithTimeout(
          () => openai.responses.create(templateNameCompletionParams),
          'template name generation'
        );
      } catch (apiError: any) {
        console.error('[Workflow Generation] Responses API error for name, attempting fallback', {
          error: apiError?.message,
        });
        templateNameCompletion = await openai.chat.completions.create({
          model: model === 'gpt-5' ? 'gpt-4o' : model,
          messages: [
            {
              role: 'user',
              content: templateNamePrompt,
            },
          ],
          temperature: model === 'gpt-5' ? undefined : 0.5,
        });
      }

      const templateNameDuration = Date.now() - templateNameStartTime;
      const templateNameModel = (templateNameCompletion as any).model || model;
      console.log('[Workflow Generation] Template name/description generation completed', {
        duration: `${templateNameDuration}ms`,
        modelUsed: templateNameModel,
      });

      // Track usage
      const templateNameUsage = templateNameCompletion.usage;
      if (templateNameUsage) {
        const inputTokens = ('input_tokens' in templateNameUsage ? templateNameUsage.input_tokens : templateNameUsage.prompt_tokens) || 0;
        const outputTokens = ('output_tokens' in templateNameUsage ? templateNameUsage.output_tokens : templateNameUsage.completion_tokens) || 0;
        const costData = calculateOpenAICost(templateNameModel, inputTokens, outputTokens);
        
        await storeUsageRecord(
          tenantId,
          'openai_template_generate',
          templateNameModel,
          inputTokens,
          outputTokens,
          costData.cost_usd
        );
      }

      const templateNameContent = ('output_text' in templateNameCompletion ? templateNameCompletion.output_text : templateNameCompletion.choices?.[0]?.message?.content) || '';
      let templateName = 'Generated Template';
      let templateDescription = 'A professional HTML template for displaying lead magnet content';

      try {
        const jsonMatch = templateNameContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          templateName = parsed.name || templateName;
          templateDescription = parsed.description || templateDescription;
        }
      } catch (e) {
        console.warn('[Workflow Generation] Failed to parse template name JSON, using defaults', e);
      }

      // Generate form fields
      const formPrompt = `You are an expert at creating lead capture forms. Based on this lead magnet: "${description}", generate appropriate form fields.

The form should collect all necessary information needed to personalize the lead magnet. Think about what data would be useful for:
- Personalizing the AI-generated content
- Contacting the lead
- Understanding their needs

Generate 3-6 form fields. Common field types: text, email, tel, textarea, select, number.

Return JSON format:
{
  "form_name": "...",
  "public_slug": "...",
  "fields": [
    {
      "field_id": "field_1",
      "field_type": "text|email|tel|textarea|select|number",
      "label": "...",
      "placeholder": "...",
      "required": true|false,
      "options": ["option1", "option2"] // only for select fields
    }
  ]
}

The public_slug should be URL-friendly (lowercase, hyphens only, no spaces).`;

      console.log('[Workflow Generation] Calling OpenAI for form generation...');
      const formStartTime = Date.now();
      
      let formCompletion;
      try {
        const formCompletionParams: any = {
          model,
          instructions: 'You are an expert at creating lead capture forms. Return only valid JSON without markdown formatting.',
          input: formPrompt,
        };
        if (model !== 'gpt-5') {
          formCompletionParams.temperature = 0.7;
        }
        formCompletion = await callResponsesWithTimeout(
          () => openai.responses.create(formCompletionParams),
          'form generation'
        );
      } catch (apiError: any) {
        console.error('[Workflow Generation] Responses API error for form, attempting fallback', {
          error: apiError?.message,
        });
        formCompletion = await openai.chat.completions.create({
          model: model === 'gpt-5' ? 'gpt-4o' : model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at creating lead capture forms. Return only valid JSON without markdown formatting.',
            },
            {
              role: 'user',
              content: formPrompt,
            },
          ],
          temperature: model === 'gpt-5' ? undefined : 0.7,
        });
      }

      const formDuration = Date.now() - formStartTime;
      const formModelUsed = (formCompletion as any).model || model;
      console.log('[Workflow Generation] Form generation completed', {
        duration: `${formDuration}ms`,
        tokensUsed: formCompletion.usage?.total_tokens,
        modelUsed: formModelUsed,
      });

      // Track usage
      const formUsage = formCompletion.usage;
      if (formUsage) {
        const inputTokens = ('input_tokens' in formUsage ? formUsage.input_tokens : formUsage.prompt_tokens) || 0;
        const outputTokens = ('output_tokens' in formUsage ? formUsage.output_tokens : formUsage.completion_tokens) || 0;
        const costData = calculateOpenAICost(formModelUsed, inputTokens, outputTokens);
        
        await storeUsageRecord(
          tenantId,
          'openai_workflow_generate',
          formModelUsed,
          inputTokens,
          outputTokens,
          costData.cost_usd
        );
      }

      const formContent = ('output_text' in formCompletion ? formCompletion.output_text : formCompletion.choices?.[0]?.message?.content) || '';
      let formData = {
        form_name: `Form for ${workflowData.workflow_name}`,
        public_slug: workflowData.workflow_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        fields: [
          {
            field_id: 'field_1',
            field_type: 'email',
            label: 'Email Address',
            placeholder: 'your@email.com',
            required: true,
          },
          {
            field_id: 'field_2',
            field_type: 'text',
            label: 'Name',
            placeholder: 'Your Name',
            required: true,
          },
        ],
      };

      try {
        const jsonMatch = formContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          formData = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.warn('[Workflow Generation] Failed to parse form JSON, using defaults', e);
      }

      // Ensure field_id is generated for each field if missing
      formData.fields = formData.fields.map((field: any, index: number) => ({
        ...field,
        field_id: field.field_id || `field_${index + 1}`,
      }));

      const totalDuration = Date.now() - workflowStartTime;
      console.log('[Workflow Generation] Success!', {
        tenantId,
        workflowName: workflowData.workflow_name,
        templateName,
        htmlLength: cleanedHtml.length,
        placeholderCount: placeholderTags.length,
        formFieldsCount: formData.fields.length,
        totalDuration: `${totalDuration}ms`,
        timestamp: new Date().toISOString(),
      });

      const result = {
        workflow: {
          workflow_name: workflowData.workflow_name,
          workflow_description: workflowData.workflow_description,
          research_instructions: workflowData.research_instructions,
        },
        template: {
          template_name: templateName,
          template_description: templateDescription,
          html_content: cleanedHtml.trim(),
          placeholder_tags: placeholderTags,
        },
        form: {
          form_name: formData.form_name,
          public_slug: formData.public_slug,
          form_fields_schema: {
            fields: formData.fields,
          },
        },
      };

      // Update job with result
      await db.update(JOBS_TABLE, { job_id: jobId }, {
        status: 'completed',
        result: result,
        updated_at: new Date().toISOString(),
      });

      console.log('[Workflow Generation] Job completed successfully', { jobId });
    } catch (error: any) {
      console.error('[Workflow Generation] Job failed', {
        jobId,
        error: error.message,
      });
      await db.update(JOBS_TABLE, { job_id: jobId }, {
        status: 'failed',
        error_message: error.message || 'Unknown error',
        updated_at: new Date().toISOString(),
      });
      throw error;
    }
  }

  async getGenerationStatus(tenantId: string, jobId: string): Promise<RouteResponse> {
    const job = await db.get(JOBS_TABLE, { job_id: jobId });

    if (!job) {
      throw new ApiError('Job not found', 404);
    }

    if (job.tenant_id !== tenantId) {
      throw new ApiError('Unauthorized', 403);
    }

    // If job has been pending for more than 30 seconds and we're in local/dev mode, try to process it
    if (job.status === 'pending' && (process.env.IS_LOCAL === 'true' || process.env.NODE_ENV === 'development')) {
      const createdAt = new Date(job.created_at).getTime();
      const now = Date.now();
      const ageSeconds = (now - createdAt) / 1000;
      
      // Only try once per job (check if there's a processing_attempted flag or just try if old enough)
      if (ageSeconds > 30 && !job.processing_attempted) {
        console.log('[Workflow Generation] Job stuck in pending, attempting to process', {
          jobId,
          ageSeconds,
        });
        
        // Mark as attempted to prevent multiple retries
        await db.update(JOBS_TABLE, { job_id: jobId }, {
          processing_attempted: true,
          updated_at: new Date().toISOString(),
        });
        
        // Try to process the job
        const description = job.description || '';
        const model = job.model || 'gpt-5';
        setImmediate(async () => {
          try {
            await this.processWorkflowGenerationJob(jobId, tenantId, description, model);
          } catch (error: any) {
            console.error('[Workflow Generation] Error processing stuck job', {
              jobId,
              error: error.message,
              errorStack: error.stack,
            });
          }
        });
      }
    }

    return {
      statusCode: 200,
      body: {
        job_id: jobId,
        status: job.status,
        result: job.result,
        error_message: job.error_message,
        created_at: job.created_at,
        updated_at: job.updated_at,
      },
    };
  }

  // Keep the old synchronous method for backward compatibility (but it will timeout)
  async generateWithAISync(tenantId: string, body: any): Promise<RouteResponse> {
    const { description, model = 'gpt-5' } = body;

    if (!description || !description.trim()) {
      throw new ApiError('Description is required', 400);
    }

    console.log('[Workflow Generation] Starting AI generation (sync)', {
      tenantId,
      model,
      descriptionLength: description.length,
      timestamp: new Date().toISOString(),
    });

    try {
      const openai = await getOpenAIClient();
      console.log('[Workflow Generation] OpenAI client initialized');

      // Generate workflow configuration
      const workflowPrompt = `You are an expert at creating AI-powered lead magnets. Based on this description: "${description}", generate a complete lead magnet configuration.

Generate:
1. Lead Magnet Name (short, catchy, 2-4 words)
2. Lead Magnet Description (1-2 sentences explaining what it does)
3. Research Instructions (detailed instructions for AI to generate personalized research based on form submission data. Use [field_name] to reference form fields)

Return JSON format:
{
  "workflow_name": "...",
  "workflow_description": "...",
  "research_instructions": "..."
}`;

      console.log('[Workflow Generation] Calling OpenAI for workflow generation...');
      const workflowStartTime = Date.now();
      
      let workflowCompletion;
      try {
        const workflowCompletionParams: any = {
          model,
          instructions: 'You are an expert at creating AI-powered lead magnets. Return only valid JSON without markdown formatting.',
          input: workflowPrompt,
        };
        // GPT-5 only supports default temperature (1), don't set custom temperature
        if (model !== 'gpt-5') {
          workflowCompletionParams.temperature = 0.7;
        }
        workflowCompletion = await callResponsesWithTimeout(
          () => openai.responses.create(workflowCompletionParams),
          'workflow generation'
        );
      } catch (apiError: any) {
        console.error('[Workflow Generation] Responses API error, attempting fallback', {
          error: apiError?.message,
          errorType: apiError?.constructor?.name,
          hasResponses: !!openai.responses,
          isTimeout: apiError?.message?.includes('timed out'),
        });
        // Fallback to chat.completions if responses API fails
        workflowCompletion = await openai.chat.completions.create({
          model: model === 'gpt-5' ? 'gpt-4o' : model, // Fallback gpt-5 to gpt-4o
          messages: [
            {
              role: 'system',
              content: 'You are an expert at creating AI-powered lead magnets. Return only valid JSON without markdown formatting.',
            },
            {
              role: 'user',
              content: workflowPrompt,
            },
          ],
          temperature: model === 'gpt-5' ? undefined : 0.7,
        });
      }

      const workflowDuration = Date.now() - workflowStartTime;
      const workflowUsedModel = (workflowCompletion as any).model || model;
      console.log('[Workflow Generation] Workflow generation completed', {
        duration: `${workflowDuration}ms`,
        tokensUsed: workflowCompletion.usage?.total_tokens,
        modelUsed: workflowUsedModel,
      });

      // Track usage - handle both responses API and chat.completions formats
      const workflowUsage = workflowCompletion.usage;
      if (workflowUsage) {
        const inputTokens = ('input_tokens' in workflowUsage ? workflowUsage.input_tokens : workflowUsage.prompt_tokens) || 0;
        const outputTokens = ('output_tokens' in workflowUsage ? workflowUsage.output_tokens : workflowUsage.completion_tokens) || 0;
        const costData = calculateOpenAICost(workflowUsedModel, inputTokens, outputTokens);
        
        await storeUsageRecord(
          tenantId,
          'openai_workflow_generate',
          workflowUsedModel,
          inputTokens,
          outputTokens,
          costData.cost_usd
        );
      }

      // Handle both response formats
      const workflowContent = ('output_text' in workflowCompletion ? workflowCompletion.output_text : workflowCompletion.choices?.[0]?.message?.content) || '';
      let workflowData = {
        workflow_name: 'Generated Lead Magnet',
        workflow_description: description,
        research_instructions: `Generate a personalized report based on form submission data. Use [field_name] to reference form fields.`,
      };

      try {
        const jsonMatch = workflowContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          workflowData = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.warn('[Workflow Generation] Failed to parse workflow JSON, using defaults', e);
      }

      // Generate template HTML
      const templatePrompt = `You are an expert HTML template designer for lead magnets. Create a professional HTML template for: "${description}"

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

      console.log('[Workflow Generation] Calling OpenAI for template HTML generation...');
      const templateStartTime = Date.now();
      
      let templateCompletion;
      try {
        const templateCompletionParams: any = {
          model,
          instructions: 'You are an expert HTML template designer. Return only valid HTML code without markdown formatting.',
          input: templatePrompt,
        };
        // GPT-5 only supports default temperature (1), don't set custom temperature
        if (model !== 'gpt-5') {
          templateCompletionParams.temperature = 0.7;
        }
        templateCompletion = await callResponsesWithTimeout(
          () => openai.responses.create(templateCompletionParams),
          'template HTML generation'
        );
      } catch (apiError: any) {
        console.error('[Workflow Generation] Responses API error for template, attempting fallback', {
          error: apiError?.message,
          errorType: apiError?.constructor?.name,
          isTimeout: apiError?.message?.includes('timed out'),
        });
        // Fallback to chat.completions
        templateCompletion = await openai.chat.completions.create({
          model: model === 'gpt-5' ? 'gpt-4o' : model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert HTML template designer. Return only valid HTML code without markdown formatting.',
            },
            {
              role: 'user',
              content: templatePrompt,
            },
          ],
          temperature: model === 'gpt-5' ? undefined : 0.7,
        });
      }

      const templateDuration = Date.now() - templateStartTime;
      const templateModelUsed = (templateCompletion as any).model || model;
      console.log('[Workflow Generation] Template HTML generation completed', {
        duration: `${templateDuration}ms`,
        tokensUsed: templateCompletion.usage?.total_tokens,
        modelUsed: templateModelUsed,
      });

      // Track usage - handle both response formats
      const templateUsage = templateCompletion.usage;
      if (templateUsage) {
        const inputTokens = ('input_tokens' in templateUsage ? templateUsage.input_tokens : templateUsage.prompt_tokens) || 0;
        const outputTokens = ('output_tokens' in templateUsage ? templateUsage.output_tokens : templateUsage.completion_tokens) || 0;
        const costData = calculateOpenAICost(templateModelUsed, inputTokens, outputTokens);
        
        await storeUsageRecord(
          tenantId,
          'openai_template_generate',
          templateModelUsed,
          inputTokens,
          outputTokens,
          costData.cost_usd
        );
      }

      let cleanedHtml = ('output_text' in templateCompletion ? templateCompletion.output_text : templateCompletion.choices?.[0]?.message?.content) || '';
      
      // Clean up markdown code blocks if present
      if (cleanedHtml.startsWith('```html')) {
        cleanedHtml = cleanedHtml.replace(/^```html\s*/i, '').replace(/\s*```$/i, '');
      } else if (cleanedHtml.startsWith('```')) {
        cleanedHtml = cleanedHtml.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      }

      // Extract placeholder tags (disabled - no longer using placeholder syntax)
      const placeholderTags: string[] = [];

      // Generate template name and description
      const templateNamePrompt = `Based on this lead magnet: "${description}", generate:
1. A short, descriptive template name (2-4 words max)
2. A brief template description (1-2 sentences)

Return JSON format: {"name": "...", "description": "..."}`;

      console.log('[Workflow Generation] Calling OpenAI for template name/description generation...');
      const templateNameStartTime = Date.now();
      
      let templateNameCompletion;
      try {
        const templateNameCompletionParams: any = {
          model,
          input: templateNamePrompt,
        };
        // GPT-5 only supports default temperature (1), don't set custom temperature
        if (model !== 'gpt-5') {
          templateNameCompletionParams.temperature = 0.5;
        }
        templateNameCompletion = await callResponsesWithTimeout(
          () => openai.responses.create(templateNameCompletionParams),
          'template name generation'
        );
      } catch (apiError: any) {
        console.error('[Workflow Generation] Responses API error for name, attempting fallback', {
          error: apiError?.message,
          errorType: apiError?.constructor?.name,
          isTimeout: apiError?.message?.includes('timed out'),
        });
        // Fallback to chat.completions
        templateNameCompletion = await openai.chat.completions.create({
          model: model === 'gpt-5' ? 'gpt-4o' : model,
          messages: [
            {
              role: 'user',
              content: templateNamePrompt,
            },
          ],
          temperature: model === 'gpt-5' ? undefined : 0.5,
        });
      }

      const templateNameDuration = Date.now() - templateNameStartTime;
      const templateNameModel = (templateNameCompletion as any).model || model;
      console.log('[Workflow Generation] Template name/description generation completed', {
        duration: `${templateNameDuration}ms`,
        modelUsed: templateNameModel,
      });

      // Track usage - handle both response formats
      const templateNameUsage = templateNameCompletion.usage;
      if (templateNameUsage) {
        const inputTokens = ('input_tokens' in templateNameUsage ? templateNameUsage.input_tokens : templateNameUsage.prompt_tokens) || 0;
        const outputTokens = ('output_tokens' in templateNameUsage ? templateNameUsage.output_tokens : templateNameUsage.completion_tokens) || 0;
        const costData = calculateOpenAICost(templateNameModel, inputTokens, outputTokens);
        
        await storeUsageRecord(
          tenantId,
          'openai_template_generate',
          templateNameModel,
          inputTokens,
          outputTokens,
          costData.cost_usd
        );
      }

      const templateNameContent = ('output_text' in templateNameCompletion ? templateNameCompletion.output_text : templateNameCompletion.choices?.[0]?.message?.content) || '';
      let templateName = 'Generated Template';
      let templateDescription = 'A professional HTML template for displaying lead magnet content';

      try {
        const jsonMatch = templateNameContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          templateName = parsed.name || templateName;
          templateDescription = parsed.description || templateDescription;
        }
      } catch (e) {
        console.warn('[Workflow Generation] Failed to parse template name JSON, using defaults', e);
      }

      // Generate form fields
      const formPrompt = `You are an expert at creating lead capture forms. Based on this lead magnet: "${description}", generate appropriate form fields.

The form should collect all necessary information needed to personalize the lead magnet. Think about what data would be useful for:
- Personalizing the AI-generated content
- Contacting the lead
- Understanding their needs

Generate 3-6 form fields. Common field types: text, email, tel, textarea, select, number.

Return JSON format:
{
  "form_name": "...",
  "public_slug": "...",
  "fields": [
    {
      "field_id": "field_1",
      "field_type": "text|email|tel|textarea|select|number",
      "label": "...",
      "placeholder": "...",
      "required": true|false,
      "options": ["option1", "option2"] // only for select fields
    }
  ]
}

The public_slug should be URL-friendly (lowercase, hyphens only, no spaces).`;

      console.log('[Workflow Generation] Calling OpenAI for form generation...');
      const formStartTime = Date.now();
      
      let formCompletion;
      try {
        const formCompletionParams: any = {
          model,
          instructions: 'You are an expert at creating lead capture forms. Return only valid JSON without markdown formatting.',
          input: formPrompt,
        };
        // GPT-5 only supports default temperature (1), don't set custom temperature
        if (model !== 'gpt-5') {
          formCompletionParams.temperature = 0.7;
        }
        formCompletion = await callResponsesWithTimeout(
          () => openai.responses.create(formCompletionParams),
          'form generation'
        );
      } catch (apiError: any) {
        console.error('[Workflow Generation] Responses API error for form, attempting fallback', {
          error: apiError?.message,
          errorType: apiError?.constructor?.name,
          isTimeout: apiError?.message?.includes('timed out'),
        });
        // Fallback to chat.completions
        formCompletion = await openai.chat.completions.create({
          model: model === 'gpt-5' ? 'gpt-4o' : model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at creating lead capture forms. Return only valid JSON without markdown formatting.',
            },
            {
              role: 'user',
              content: formPrompt,
            },
          ],
          temperature: model === 'gpt-5' ? undefined : 0.7,
        });
      }

      const formDuration = Date.now() - formStartTime;
      const formModelUsed = (formCompletion as any).model || model;
      console.log('[Workflow Generation] Form generation completed', {
        duration: `${formDuration}ms`,
        tokensUsed: formCompletion.usage?.total_tokens,
        modelUsed: formModelUsed,
      });

      // Track usage - handle both response formats
      const formUsage = formCompletion.usage;
      if (formUsage) {
        const inputTokens = ('input_tokens' in formUsage ? formUsage.input_tokens : formUsage.prompt_tokens) || 0;
        const outputTokens = ('output_tokens' in formUsage ? formUsage.output_tokens : formUsage.completion_tokens) || 0;
        const costData = calculateOpenAICost(formModelUsed, inputTokens, outputTokens);
        
        await storeUsageRecord(
          tenantId,
          'openai_workflow_generate',
          formModelUsed,
          inputTokens,
          outputTokens,
          costData.cost_usd
        );
      }

      const formContent = ('output_text' in formCompletion ? formCompletion.output_text : formCompletion.choices?.[0]?.message?.content) || '';
      let formData = {
        form_name: `Form for ${workflowData.workflow_name}`,
        public_slug: workflowData.workflow_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        fields: [
          {
            field_id: 'field_1',
            field_type: 'email',
            label: 'Email Address',
            placeholder: 'your@email.com',
            required: true,
          },
          {
            field_id: 'field_2',
            field_type: 'text',
            label: 'Name',
            placeholder: 'Your Name',
            required: true,
          },
        ],
      };

      try {
        const jsonMatch = formContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          formData = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.warn('[Workflow Generation] Failed to parse form JSON, using defaults', e);
      }

      // Ensure field_id is generated for each field if missing
      formData.fields = formData.fields.map((field: any, index: number) => ({
        ...field,
        field_id: field.field_id || `field_${index + 1}`,
      }));

      const totalDuration = Date.now() - workflowStartTime;
      console.log('[Workflow Generation] Success!', {
        tenantId,
        workflowName: workflowData.workflow_name,
        templateName,
        htmlLength: cleanedHtml.length,
        placeholderCount: placeholderTags.length,
        formFieldsCount: formData.fields.length,
        totalDuration: `${totalDuration}ms`,
        timestamp: new Date().toISOString(),
      });

      return {
        statusCode: 200,
        body: {
          workflow: {
            workflow_name: workflowData.workflow_name,
            workflow_description: workflowData.workflow_description,
            research_instructions: workflowData.research_instructions,
          },
          template: {
            template_name: templateName,
            template_description: templateDescription,
            html_content: cleanedHtml.trim(),
            placeholder_tags: placeholderTags,
          },
          form: {
            form_name: formData.form_name,
            public_slug: formData.public_slug,
            form_fields_schema: {
              fields: formData.fields,
            },
          },
        },
      };
    } catch (error: any) {
      console.error('[Workflow Generation] Error occurred', {
        tenantId,
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
        timestamp: new Date().toISOString(),
      });
      throw new ApiError(
        error.message || 'Failed to generate lead magnet with AI',
        500
      );
    }
  }

  async refineInstructions(tenantId: string, body: any): Promise<RouteResponse> {
    const { current_instructions, edit_prompt, model = 'gpt-5' } = body;

    if (!current_instructions || !current_instructions.trim()) {
      throw new ApiError('Current instructions are required', 400);
    }

    if (!edit_prompt || !edit_prompt.trim()) {
      throw new ApiError('Edit prompt is required', 400);
    }

    console.log('[Workflow Instructions Refinement] Starting refinement', {
      tenantId,
      model,
      currentInstructionsLength: current_instructions.length,
      editPromptLength: edit_prompt.length,
      timestamp: new Date().toISOString(),
    });

    try {
      const openai = await getOpenAIClient();
      console.log('[Workflow Instructions Refinement] OpenAI client initialized');

      const prompt = `You are an expert AI prompt engineer. Modify the following research instructions for an AI lead magnet generator based on these requests: "${edit_prompt}"

Current Instructions:
${current_instructions}

Requirements:
1. Apply the requested changes while maintaining clarity and effectiveness
2. Keep the overall structure and format unless specifically asked to change it
3. Ensure the instructions remain actionable and specific
4. Preserve any field references like [field_name] syntax
5. Return only the modified instructions, no markdown formatting, no explanations

Return ONLY the modified instructions, no markdown formatting, no explanations.`;

      console.log('[Workflow Instructions Refinement] Calling OpenAI for refinement...', {
        model,
        promptLength: prompt.length,
      });

      const refineStartTime = Date.now();
      let completion;
      try {
        const completionParams: any = {
          model,
          instructions: 'You are an expert AI prompt engineer. Return only the modified instructions without markdown formatting.',
          input: prompt,
        };
        // GPT-5 only supports default temperature (1), don't set custom temperature
        if (model !== 'gpt-5') {
          completionParams.temperature = 0.7;
        }
        completion = await callResponsesWithTimeout(
          () => openai.responses.create(completionParams),
          'workflow instructions refinement'
        );
      } catch (apiError: any) {
        console.error('[Workflow Instructions Refinement] Responses API error, attempting fallback', {
          error: apiError?.message,
          errorType: apiError?.constructor?.name,
          isTimeout: apiError?.message?.includes('timed out'),
        });
        // Fallback to chat.completions
        completion = await openai.chat.completions.create({
          model: model === 'gpt-5' ? 'gpt-4o' : model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert AI prompt engineer. Return only the modified instructions without markdown formatting.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: model === 'gpt-5' ? undefined : 0.7,
        });
      }

      const refineDuration = Date.now() - refineStartTime;
      const refinementModel = (completion as any).model || model;
      console.log('[Workflow Instructions Refinement] Refinement completed', {
        duration: `${refineDuration}ms`,
        tokensUsed: completion.usage?.total_tokens,
        model: refinementModel,
      });

      // Track usage - handle both response formats
      const usage = completion.usage;
      if (usage) {
        const inputTokens = ('input_tokens' in usage ? usage.input_tokens : usage.prompt_tokens) || 0;
        const outputTokens = ('output_tokens' in usage ? usage.output_tokens : usage.completion_tokens) || 0;
        const costData = calculateOpenAICost(refinementModel, inputTokens, outputTokens);
        
        await storeUsageRecord(
          tenantId,
          'openai_workflow_refine',
          refinementModel,
          inputTokens,
          outputTokens,
          costData.cost_usd
        );
      }

      const instructionsContent = ('output_text' in completion ? completion.output_text : completion.choices?.[0]?.message?.content) || '';
      console.log('[Workflow Instructions Refinement] Refined instructions received', {
        instructionsLength: instructionsContent.length,
        firstChars: instructionsContent.substring(0, 100),
      });
      
      // Clean up markdown code blocks if present
      let cleanedInstructions = instructionsContent.trim();
      if (cleanedInstructions.startsWith('```')) {
        cleanedInstructions = cleanedInstructions.replace(/^```\w*\s*/i, '').replace(/\s*```$/i, '');
        console.log('[Workflow Instructions Refinement] Removed ``` markers');
      }

      const totalDuration = Date.now() - refineStartTime;
      console.log('[Workflow Instructions Refinement] Success!', {
        tenantId,
        instructionsLength: cleanedInstructions.length,
        totalDuration: `${totalDuration}ms`,
        timestamp: new Date().toISOString(),
      });

      return {
        statusCode: 200,
        body: {
          instructions: cleanedInstructions,
        },
      };
    } catch (error: any) {
      console.error('[Workflow Instructions Refinement] Error occurred', {
        tenantId,
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
        timestamp: new Date().toISOString(),
      });
      throw new ApiError(
        error.message || 'Failed to refine instructions with AI',
        500
      );
    }
  }
}

export const workflowsController = new WorkflowsController();

