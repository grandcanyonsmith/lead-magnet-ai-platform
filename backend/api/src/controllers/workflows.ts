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
import { formService } from '../services/formService';
import { WorkflowGenerationService } from '../services/workflowGenerationService';
import { migrateLegacyWorkflowToSteps, migrateLegacyWorkflowOnUpdate, ensureStepDefaults } from '../utils/workflowMigration';

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

      // Sort by created_at DESC (most recent first)
      workflows.sort((a: any, b: any) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA; // DESC order
      });

      // Fetch form data for each workflow, auto-create if missing
      const workflowsWithForms = await Promise.all(
        workflows.map(async (workflow: any) => {
          try {
            let activeForm = await formService.getFormForWorkflow(workflow.workflow_id);
            
            // Auto-create form if it doesn't exist
            if (!activeForm && workflow.workflow_name) {
              try {
                console.log('[Workflows List] Auto-creating form for workflow', {
                  workflowId: workflow.workflow_id,
                  workflowName: workflow.workflow_name,
                });
                const formId = await formService.createFormForWorkflow(
                  workflow.tenant_id,
                  workflow.workflow_id,
                  workflow.workflow_name
                );
                
                // Fetch the newly created form
                activeForm = await formService.getFormForWorkflow(workflow.workflow_id);
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

    const workflow = await db.get(WORKFLOWS_TABLE!, { workflow_id: workflowId });

    if (!workflow || workflow.deleted_at) {
      throw new ApiError('This lead magnet doesn\'t exist or has been removed', 404);
    }

    if (workflow.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this lead magnet', 403);
    }

    // Fetch associated form
    const form = await formService.getFormForWorkflow(workflowId);

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

    const data = validate(createWorkflowSchema, body);

    // Auto-migrate legacy workflows to steps format if needed
    let workflowData = { ...data };
    if (!workflowData.steps || workflowData.steps.length === 0) {
      // Migrate legacy format to steps
      const steps = migrateLegacyWorkflowToSteps(workflowData);
      if (steps.length > 0) {
        workflowData.steps = steps;
      }
    } else {
      // Ensure step_order is set for each step and add defaults for tools/tool_choice
      workflowData.steps = ensureStepDefaults(workflowData.steps);
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
      formId = await formService.createFormForWorkflow(
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
    const form = formId ? await formService.getFormForWorkflow(workflowId) : null;

    // Create notification for workflow creation
    try {
      const { notificationsController } = await import('./notifications');
      await notificationsController.create(
        tenantId,
        'workflow_created',
        'New lead magnet created',
        `Your lead magnet "${workflowData.workflow_name}" has been created successfully.`,
        workflowId,
        'workflow'
      );
    } catch (error) {
      console.error('[Workflows Create] Error creating notification', error);
      // Don't fail workflow creation if notification fails
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
      const steps = migrateLegacyWorkflowOnUpdate(data, existing);
      if (steps.length > 0) {
        updateData.steps = steps;
      }
    } else if (hasSteps) {
      // Ensure step_order is set for each step
      updateData.steps = ensureStepDefaults(data.steps);
    }

    const updated = await db.update(WORKFLOWS_TABLE!, { workflow_id: workflowId }, {
      ...updateData,
      updated_at: new Date().toISOString(),
    });

    // If workflow name changed, update form name
    if (data.workflow_name && data.workflow_name !== existing.workflow_name) {
      try {
        await formService.updateFormName(workflowId, data.workflow_name);
      } catch (error) {
        console.error('[Workflows Update] Error updating form name', {
          workflowId,
          error: (error as any).message,
        });
      }
    }

    // Fetch updated form to include in response
    const form = await formService.getFormForWorkflow(workflowId);

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
      await formService.deleteFormsForWorkflow(workflowId);
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

      // Initialize OpenAI client and generation service
      const openai = await getOpenAIClient();
      const generationService = new WorkflowGenerationService(openai, storeUsageRecord);
      
      const workflowStartTime = Date.now();
      console.log('[Workflow Generation] OpenAI client initialized');

      // Generate workflow config first (needed for form generation)
      const workflowResult = await generationService.generateWorkflowConfig(description, model, tenantId, jobId);
      
      // Generate template HTML, metadata, and form fields in parallel
      const [templateHtmlResult, templateMetadataResult, formFieldsResult] = await Promise.all([
        generationService.generateTemplateHTML(description, model, tenantId, jobId),
        generationService.generateTemplateMetadata(description, model, tenantId, jobId),
        generationService.generateFormFields(
          description,
          workflowResult.workflowData.workflow_name,
          model,
          tenantId,
          jobId
        ),
      ]);

      const totalDuration = Date.now() - workflowStartTime;
      console.log('[Workflow Generation] Success!', {
        tenantId,
        workflowName: workflowResult.workflowData.workflow_name,
        templateName: templateMetadataResult.templateName,
        htmlLength: templateHtmlResult.htmlContent.length,
        formFieldsCount: formFieldsResult.formData.fields.length,
        totalDuration: `${totalDuration}ms`,
        timestamp: new Date().toISOString(),
      });

      // Process results into final format
      const result = generationService.processGenerationResult(
        workflowResult.workflowData,
        templateMetadataResult.templateName,
        templateMetadataResult.templateDescription,
        templateHtmlResult.htmlContent,
        formFieldsResult.formData
      );

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
      const generationService = new WorkflowGenerationService(openai, storeUsageRecord);
      console.log('[Workflow Generation] OpenAI client initialized');

      const workflowStartTime = Date.now();
      
      // Generate workflow config first (needed for form generation)
      const workflowResult = await generationService.generateWorkflowConfig(description, model, tenantId);
      
      // Generate template HTML, metadata, and form fields in parallel
      const [templateHtmlResult, templateMetadataResult, formFieldsResult] = await Promise.all([
        generationService.generateTemplateHTML(description, model, tenantId),
        generationService.generateTemplateMetadata(description, model, tenantId),
        generationService.generateFormFields(
          description,
          workflowResult.workflowData.workflow_name,
          model,
          tenantId
        ),
      ]);

      const totalDuration = Date.now() - workflowStartTime;
      console.log('[Workflow Generation] Success!', {
        tenantId,
        workflowName: workflowResult.workflowData.workflow_name,
        templateName: templateMetadataResult.templateName,
        htmlLength: templateHtmlResult.htmlContent.length,
        formFieldsCount: formFieldsResult.formData.fields.length,
        totalDuration: `${totalDuration}ms`,
        timestamp: new Date().toISOString(),
      });

      // Process results into final format
      const result = generationService.processGenerationResult(
        workflowResult.workflowData,
        templateMetadataResult.templateName,
        templateMetadataResult.templateDescription,
        templateHtmlResult.htmlContent,
        formFieldsResult.formData
      );

      return {
        statusCode: 200,
        body: result,
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

      const refinedContent = ('output_text' in completion ? completion.output_text : completion.choices?.[0]?.message?.content) || '';
      
      // Clean up markdown code blocks if present
      let cleanedContent = refinedContent.trim();
      if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\w*\s*/i, '').replace(/\s*```$/i, '');
      }

      return {
        statusCode: 200,
        body: {
          refined_instructions: cleanedContent,
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
        error.message || 'Failed to refine instructions',
        500
      );
    }
  }
}

export const workflowsController = new WorkflowsController();
