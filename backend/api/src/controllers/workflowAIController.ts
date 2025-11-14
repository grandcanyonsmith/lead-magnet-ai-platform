import { ulid } from 'ulid';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { db } from '../utils/db';
import { ApiError } from '../utils/errors';
import { RouteResponse } from '../routes';
import { calculateOpenAICost } from '../services/costService';
import { callResponsesWithTimeout } from '../utils/openaiHelpers';
import { WorkflowGenerationService } from '../services/workflowGenerationService';
import { WorkflowStepAIService, AIStepGenerationRequest } from '../services/workflowStepAIService';
import { WorkflowAIService, WorkflowAIEditRequest } from '../services/workflowAIService';
import { logger } from '../utils/logger';
import { getOpenAIClient } from '../services/openaiService';
import { usageTrackingService } from '../services/usageTrackingService';
import { env } from '../utils/env';
import { fetchICPContent, buildBrandContext } from '../utils/icpFetcher';

const JOBS_TABLE = env.jobsTable;
const USER_SETTINGS_TABLE = process.env.USER_SETTINGS_TABLE!;
const lambdaClient = new LambdaClient({ region: env.awsRegion });

/**
 * Controller for AI-powered workflow operations.
 * Handles workflow generation, refinement, and AI editing.
 */
export class WorkflowAIController {
  /**
   * Generate a workflow with AI (async).
   * Creates a job and triggers async processing.
   */
  async generateWithAI(tenantId: string, body: any): Promise<RouteResponse> {
    const { description, model = 'gpt-5' } = body;

    if (!description || !description.trim()) {
      throw new ApiError('Description is required', 400);
    }

    logger.info('[Workflow Generation] Starting async generation', {
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
    logger.info('[Workflow Generation] Created job record', { jobId });

    // Invoke Lambda asynchronously to process workflow generation
    try {
      // Check if we're in local development - process synchronously
      if (env.isDevelopment()) {
        logger.info('[Workflow Generation] Local mode detected, processing synchronously', { jobId });
        // Process the job synchronously in local dev (fire and forget, but with error handling)
        setImmediate(async () => {
          try {
            await this.processWorkflowGenerationJob(jobId, tenantId, description, model);
          } catch (error: any) {
            logger.error('[Workflow Generation] Error processing job in local mode', {
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
        const functionArn = env.getLambdaFunctionArn();
        
        const invokeCommand = new InvokeCommand({
          FunctionName: functionArn,
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
        logger.info('[Workflow Generation] Triggered async processing', { 
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
      logger.error('[Workflow Generation] Failed to trigger async processing', {
        error: error.message,
        errorStack: error.stack,
        jobId,
        isLocal: env.isDevelopment(),
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

  /**
   * Process a workflow generation job.
   * Called asynchronously to generate the workflow.
   */
  async processWorkflowGenerationJob(jobId: string, tenantId: string, description: string, model: string): Promise<void> {
    logger.info('[Workflow Generation] Processing job', { jobId, tenantId });

    try {
      // Update job status to processing
      await db.update(JOBS_TABLE, { job_id: jobId }, {
        status: 'processing',
        updated_at: new Date().toISOString(),
      });

      // Initialize OpenAI client and generation service
      const openai = await getOpenAIClient();
      const generationService = new WorkflowGenerationService(
        openai,
        async (tenantId, serviceType, model, inputTokens, outputTokens, costUsd, jobId) => {
          await usageTrackingService.storeUsageRecord({
            tenantId,
            serviceType,
            model,
            inputTokens,
            outputTokens,
            costUsd,
            jobId,
          });
        }
      );
      
      const workflowStartTime = Date.now();
      logger.info('[Workflow Generation] OpenAI client initialized');

      // Fetch settings to get brand context and ICP URL
      const settings = await db.get(USER_SETTINGS_TABLE, { tenant_id: tenantId });
      const brandContext = settings ? buildBrandContext(settings) : '';
      
      // Fetch ICP document content if URL is provided
      let icpContext: string | null = null;
      if (settings?.icp_document_url) {
        logger.info('[Workflow Generation] Fetching ICP document', { url: settings.icp_document_url });
        icpContext = await fetchICPContent(settings.icp_document_url);
        if (icpContext) {
          logger.info('[Workflow Generation] ICP document fetched successfully', { contentLength: icpContext.length });
        } else {
          logger.warn('[Workflow Generation] Failed to fetch ICP document, continuing without it');
        }
      }

      // Generate workflow config first (needed for form generation)
      const workflowResult = await generationService.generateWorkflowConfig(
        description,
        model,
        tenantId,
        jobId,
        brandContext || undefined,
        icpContext || undefined
      );
      
      // Generate template HTML, metadata, and form fields in parallel
      const [templateHtmlResult, templateMetadataResult, formFieldsResult] = await Promise.all([
        generationService.generateTemplateHTML(
          description,
          model,
          tenantId,
          jobId,
          brandContext || undefined,
          icpContext || undefined
        ),
        generationService.generateTemplateMetadata(
          description,
          model,
          tenantId,
          jobId,
          brandContext || undefined,
          icpContext || undefined
        ),
        generationService.generateFormFields(
          description,
          workflowResult.workflowData.workflow_name,
          model,
          tenantId,
          jobId,
          brandContext || undefined,
          icpContext || undefined
        ),
      ]);

      const totalDuration = Date.now() - workflowStartTime;
      logger.info('[Workflow Generation] Success!', {
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

      logger.info('[Workflow Generation] Job completed successfully', { jobId });
    } catch (error: any) {
      logger.error('[Workflow Generation] Job failed', {
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

  /**
   * Get the status of a workflow generation job.
   */
  async getGenerationStatus(tenantId: string, jobId: string): Promise<RouteResponse> {
    const job = await db.get(JOBS_TABLE, { job_id: jobId });

    if (!job) {
      throw new ApiError('Job not found', 404);
    }

    if (job.tenant_id !== tenantId) {
      throw new ApiError('Unauthorized', 403);
    }

    // If job has been pending for more than 30 seconds and we're in local/dev mode, try to process it
    if (job.status === 'pending' && env.isDevelopment()) {
      const createdAt = new Date(job.created_at).getTime();
      const now = Date.now();
      const ageSeconds = (now - createdAt) / 1000;
      
      // Only try once per job (check if there's a processing_attempted flag or just try if old enough)
      if (ageSeconds > 30 && !job.processing_attempted) {
        logger.info('[Workflow Generation] Job stuck in pending, attempting to process', {
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
            logger.error('[Workflow Generation] Error processing stuck job', {
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

  /**
   * Refine workflow instructions using AI.
   */
  async refineInstructions(tenantId: string, body: any): Promise<RouteResponse> {
    const { current_instructions, edit_prompt, model = 'gpt-5' } = body;

    if (!current_instructions || !current_instructions.trim()) {
      throw new ApiError('Current instructions are required', 400);
    }

    if (!edit_prompt || !edit_prompt.trim()) {
      throw new ApiError('Edit prompt is required', 400);
    }

    logger.info('[Workflow Instructions Refinement] Starting refinement', {
      tenantId,
      model,
      currentInstructionsLength: current_instructions.length,
      editPromptLength: edit_prompt.length,
      timestamp: new Date().toISOString(),
    });

    try {
      const openai = await getOpenAIClient();
      logger.info('[Workflow Instructions Refinement] OpenAI client initialized');

      const prompt = `You are an expert AI prompt engineer specializing in creating effective instructions for AI lead magnet generators. Modify the following research instructions based on these requests: "${edit_prompt}"

Current Instructions:
${current_instructions}

## Your Task

Apply the requested changes while maintaining and improving instruction quality. Follow these principles:

## Instruction Quality Standards

### ✅ Good Instruction Characteristics:
1. **Specificity**: Clear, concrete requirements (not vague like "make it good")
2. **Actionability**: Provides clear direction on what to do
3. **Field References**: Uses [field_name] syntax to reference form submission data
4. **Output Format**: Specifies expected structure, sections, or format
5. **Personalization**: Includes guidance on personalizing content from form data
6. **Context Awareness**: References previous steps when applicable
7. **Quality Standards**: Sets expectations for depth, detail, or comprehensiveness

### ❌ Common Pitfalls to Avoid:
1. **Vagueness**: "Generate a report" → Better: "Generate a comprehensive market research report for [company_name]..."
2. **No Field References**: Missing [field_name] syntax for personalization
3. **No Structure**: Not specifying output format or organization
4. **Too Generic**: Not tailored to the specific lead magnet type
5. **Missing Context**: Not referencing how to use previous step outputs
6. **Subjective Language**: Using terms like "good", "better", "nice" without specifics

## Examples of Effective Instructions

### Example 1 - Research Step:
**Good:**
"Generate a comprehensive market research report for [company_name] in the [industry] industry. Research current market trends, competitor landscape, and growth opportunities. Include specific statistics, recent developments, and actionable insights. Personalize all recommendations based on [company_name]'s size ([company_size]) and target market ([target_market]). Format as a structured markdown document with clear sections: Executive Summary, Market Overview, Competitive Analysis, and Recommendations."

**Bad:**
"Generate a report about the market."

### Example 2 - Analysis Step:
**Good:**
"Analyze the research findings from Step 1 and create a personalized SWOT analysis for [company_name]. Focus on opportunities and threats specific to the [industry] industry. Include actionable recommendations based on [company_name]'s current situation ([current_challenges]). Structure the output with four clear sections: Strengths, Weaknesses, Opportunities, and Threats, each with 3-5 specific points."

**Bad:**
"Analyze the research and create a SWOT analysis."

### Example 3 - Content Generation Step:
**Good:**
"Create a personalized action plan document for [name] at [company_name]. Use insights from previous steps to create 5-7 specific, actionable recommendations. Format as a clear, professional document with sections for each recommendation. Include timelines and expected outcomes where relevant. Personalize each recommendation based on [company_name]'s industry ([industry]) and goals ([goals])."

**Bad:**
"Create an action plan."

## Best Practices Checklist

When modifying instructions, ensure:

- [ ] Instructions are specific and actionable
- [ ] Form fields are referenced using [field_name] syntax
- [ ] Output format is clearly defined (structure, sections, format)
- [ ] Quality standards are set (depth, detail, comprehensiveness)
- [ ] Personalization guidance is included
- [ ] Previous step outputs are referenced when applicable
- [ ] Instructions avoid vague or subjective language
- [ ] Instructions are tailored to the specific lead magnet type

## Modification Guidelines

1. **Apply Requested Changes**: Implement the specific changes requested in "${edit_prompt}"
2. **Maintain Quality**: Ensure the modified instructions meet the quality standards above
3. **Preserve Structure**: Keep the overall structure and format unless specifically asked to change it
4. **Enhance Clarity**: If the changes create ambiguity, add clarifying details
5. **Preserve Field References**: Maintain all [field_name] syntax references
6. **Improve When Possible**: If you see opportunities to improve clarity or specificity while making requested changes, do so

## Common Improvement Patterns

- **Adding Specificity**: "Generate a report" → "Generate a comprehensive [type] report for [company_name]..."
- **Adding Structure**: "Create content" → "Create a structured document with sections: [list sections]..."
- **Adding Personalization**: "Analyze data" → "Analyze data for [company_name] in the [industry] industry..."
- **Adding Quality Standards**: "Research competitors" → "Research competitors and include specific statistics, recent developments, and actionable insights..."
- **Adding Format Guidance**: "Create recommendations" → "Create 5-7 recommendations formatted as a clear list with actionable steps..."

## Output Requirements

Return ONLY the modified instructions:
- No markdown formatting (no code blocks, no \`\`\`)
- No explanations or commentary
- Just the improved instructions text
- Maintain the same general structure unless changes require restructuring`;

      logger.info('[Workflow Instructions Refinement] Calling OpenAI for refinement...', {
        model,
        promptLength: prompt.length,
      });

      const refineStartTime = Date.now();
      const completionParams: any = {
        model,
        instructions: 'You are an expert AI prompt engineer. Return only the modified instructions without markdown formatting.',
        input: prompt,
      };
      // GPT-5 only supports default temperature (1), don't set custom temperature
      if (model !== 'gpt-5') {
        completionParams.temperature = 0.7;
      }
      const completion = await callResponsesWithTimeout(
        () => openai.responses.create(completionParams),
        'workflow instructions refinement'
      );

      const refineDuration = Date.now() - refineStartTime;
      const refinementModel = (completion as any).model || model;
      logger.info('[Workflow Instructions Refinement] Refinement completed', {
        duration: `${refineDuration}ms`,
        tokensUsed: completion.usage?.total_tokens,
        model: refinementModel,
      });

      // Track usage
      const usage = completion.usage;
      if (usage) {
        const inputTokens = usage.input_tokens || 0;
        const outputTokens = usage.output_tokens || 0;
        const costData = calculateOpenAICost(refinementModel, inputTokens, outputTokens);
        
        await usageTrackingService.storeUsageRecord({
          tenantId,
          serviceType: 'openai_workflow_refine',
          model: refinementModel,
          inputTokens,
          outputTokens,
          costUsd: costData.cost_usd,
        });
      }

      // Validate response has output_text
      if (!completion.output_text) {
        throw new ApiError('OpenAI Responses API returned empty response. output_text is missing for workflow instructions refinement.', 500);
      }
      
      const refinedContent = completion.output_text;
      
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
      logger.error('[Workflow Instructions Refinement] Error occurred', {
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

  /**
   * Generate a workflow step using AI.
   */
  async aiGenerateStep(tenantId: string, workflowId: string, body: any): Promise<RouteResponse> {
    const { db } = await import('../utils/db');
    const { env } = await import('../utils/env');
    const WORKFLOWS_TABLE = env.workflowsTable;

    // Validate required fields
    if (!body.userPrompt || typeof body.userPrompt !== 'string') {
      throw new ApiError('userPrompt is required and must be a string', 400);
    }

    // Get the workflow
    const workflow = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });

    if (!workflow || workflow.deleted_at) {
      throw new ApiError('This lead magnet doesn\'t exist or has been removed', 404);
    }

    if (workflow.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this lead magnet', 403);
    }

    logger.info('[AI Step Generation] Starting generation', {
      workflowId,
      workflowName: workflow.workflow_name,
      userPrompt: body.userPrompt.substring(0, 100),
      action: body.action,
      currentStepIndex: body.currentStepIndex,
    });

    try {
      // Get OpenAI client
      const openai = await getOpenAIClient();
      const aiService = new WorkflowStepAIService(openai);

      // Prepare the request
      const aiRequest: AIStepGenerationRequest = {
        userPrompt: body.userPrompt,
        action: body.action,
        workflowContext: {
          workflow_id: workflowId,
          workflow_name: workflow.workflow_name || 'Untitled Workflow',
          workflow_description: workflow.workflow_description || '',
          current_steps: (workflow.steps || []).map((step: any) => ({
            step_name: step.step_name,
            step_description: step.step_description,
            model: step.model,
            tools: step.tools,
          })),
        },
        currentStep: body.currentStep,
        currentStepIndex: body.currentStepIndex,
      };

      // Generate the step
      const result = await aiService.generateStep(aiRequest);

      logger.info('[AI Step Generation] Generation successful', {
        workflowId,
        action: result.action,
        stepName: result.step.step_name,
      });

      return {
        statusCode: 200,
        body: result,
      };
    } catch (error: any) {
      logger.error('[AI Step Generation] Error', {
        workflowId,
        error: error.message,
        stack: error.stack,
      });
      throw new ApiError(`Failed to generate step: ${error.message}`, 500);
    }
  }

  /**
   * Edit a workflow using AI.
   */
  async aiEditWorkflow(tenantId: string, workflowId: string, body: any): Promise<RouteResponse> {
    const { db } = await import('../utils/db');
    const { env } = await import('../utils/env');
    const WORKFLOWS_TABLE = env.workflowsTable;

    // Validate required fields
    if (!body.userPrompt || typeof body.userPrompt !== 'string') {
      throw new ApiError('userPrompt is required and must be a string', 400);
    }

    // Get the workflow
    const workflow = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });

    if (!workflow || workflow.deleted_at) {
      throw new ApiError('This lead magnet doesn\'t exist or has been removed', 404);
    }

    if (workflow.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this lead magnet', 403);
    }

    logger.info('[AI Workflow Edit] Starting edit', {
      workflowId,
      workflowName: workflow.workflow_name,
      userPrompt: body.userPrompt.substring(0, 100),
      currentStepCount: workflow.steps?.length || 0,
    });

    try {
      // Get OpenAI client
      const openai = await getOpenAIClient();
      const aiService = new WorkflowAIService(openai);

      // Prepare the request
      const aiRequest: WorkflowAIEditRequest = {
        userPrompt: body.userPrompt,
        workflowContext: {
          workflow_id: workflowId,
          workflow_name: workflow.workflow_name || 'Untitled Workflow',
          workflow_description: workflow.workflow_description || '',
          template_id: workflow.template_id,
          current_steps: workflow.steps || [],
        },
      };

      // Edit the workflow
      const result = await aiService.editWorkflow(aiRequest);

      logger.info('[AI Workflow Edit] Edit successful', {
        workflowId,
        newStepCount: result.steps.length,
        changesSummary: result.changes_summary,
      });

      return {
        statusCode: 200,
        body: result,
      };
    } catch (error: any) {
      logger.error('[AI Workflow Edit] Error', {
        workflowId,
        error: error.message,
        stack: error.stack,
      });
      throw new ApiError(`Failed to edit workflow: ${error.message}`, 500);
    }
  }
}

export const workflowAIController = new WorkflowAIController();

