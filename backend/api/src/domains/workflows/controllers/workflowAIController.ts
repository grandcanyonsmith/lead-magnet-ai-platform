import { ApiError } from '@utils/errors';
import { RouteResponse } from '@routes/routes';
import { RequestContext } from '@routes/router';
import { WorkflowStepAIService, AIStepGenerationRequest } from '@domains/workflows/services/workflowStepAIService';
import { workflowInstructionsService } from '@domains/workflows/services/workflowInstructionsService';
import { logger } from '@utils/logger';
import { getOpenAIClient } from '@services/openaiService';
import { workflowGenerationJobService } from '@domains/workflows/services/workflowGenerationJobService';
import { workflowAIEditJobService } from '@domains/workflows/services/workflowAIEditJobService';
import { ulid } from 'ulid';
import { getPromptOverridesFromSettings } from '@services/promptOverrides';
import { workflowIdeationService } from '@domains/workflows/services/workflowIdeationService';

/**
 * Controller for AI-powered workflow operations.
 * Handles workflow generation, refinement, and AI editing.
 */
export class WorkflowAIController {
  /**
   * Get available AI models.
   */
  async getModels(tenantId: string): Promise<RouteResponse> {
    void tenantId;
    const { MODEL_DESCRIPTIONS_DETAILED, AVAILABLE_MODELS } = await import('@domains/workflows/services/workflow/modelDescriptions');
    
    // Map models to a more frontend-friendly format
    const models = AVAILABLE_MODELS.map(id => ({
      id,
      name: id === 'gpt-5.2' ? 'GPT-5.2' : id, // Basic formatting, could be enhanced
      description: MODEL_DESCRIPTIONS_DETAILED[id]?.bestFor || '',
      ...MODEL_DESCRIPTIONS_DETAILED[id]
    }));

    return {
      statusCode: 200,
      body: {
        models
      }
    };
  }

  /**
   * Ideate deliverables for a lead magnet via chat history.
   */
  async ideateWorkflow(tenantId: string, body: any): Promise<RouteResponse> {
    const result = await workflowIdeationService.ideateWorkflow(tenantId, body);
    return {
      statusCode: 200,
      body: result,
    };
  }

  /**
   * Test a single workflow step.
   */
  async testStep(tenantId: string, body: any, context?: any): Promise<RouteResponse> {
    const { db } = await import('@utils/db');
    const { env } = await import('@utils/env');
    const { JobProcessingUtils } = await import('@domains/workflows/services/workflow/workflowJobProcessingService');
    
    const WORKFLOWS_TABLE = env.workflowsTable;
    const SUBMISSIONS_TABLE = env.submissionsTable;
    const JOBS_TABLE = env.jobsTable;

    const { step, input } = body;

    if (!step) {
      throw new ApiError('Step configuration is required', 400);
    }

    const testId = ulid();
    const workflowId = `test-workflow-${testId}`;
    const submissionId = `test-submission-${testId}`;
    const jobId = `test-job-${testId}`;

    logger.info('[Test Step] Starting step test', {
      tenantId,
      jobId,
      stepName: step.step_name
    });

    try {
      // 1. Create temporary workflow
      const workflow = {
        workflow_id: workflowId,
        tenant_id: tenantId,
        workflow_name: 'Test Step Workflow',
        workflow_description: 'Temporary workflow for testing a step',
        steps: [step],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_test: true // Marker for cleanup
      };
      await db.put(WORKFLOWS_TABLE, workflow);

      // 2. Create temporary submission
      const submission = {
        submission_id: submissionId,
        tenant_id: tenantId,
        form_id: 'test-form', // Dummy
        submission_data: input || {}, // User provided input
        created_at: new Date().toISOString()
      };
      await db.put(SUBMISSIONS_TABLE, submission);

      // 3. Create job
      const job = {
        job_id: jobId,
        tenant_id: tenantId,
        workflow_id: workflowId,
        submission_id: submissionId,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_test: true
      };
      await db.put(JOBS_TABLE, job);

      // 4. Trigger worker for single step
      if (env.isDevelopment()) {
        const res = context?.res;
        if (res) {
            // Streaming mode
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            });
            
            res.write(`data: ${JSON.stringify({ type: 'init', job_id: jobId })}\n\n`);

            await this.triggerLocalWorker(jobId, '0', (log) => {
                res.write(`data: ${JSON.stringify({ type: 'log', content: log })}\n\n`);
            });
            
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            res.end();
            return { statusCode: 200, body: { handled: true } };
        } else {
            // Non-streaming (fire and forget)
            this.triggerLocalWorker(jobId, '0');
        }
      } else {
        await JobProcessingUtils.triggerAsyncProcessing(
            jobId,
            tenantId,
            {
            job_id: jobId,
            step_index: 0,
            step_type: 'workflow_step'
            }
        );
      }

      return {
        statusCode: 202,
        body: {
          job_id: jobId,
          status: 'pending',
          message: 'Step test started'
        }
      };

    } catch (error: any) {
      logger.error('[Test Step] Failed to start test', {
        error: error.message,
        stack: error.stack
      });
      throw new ApiError(`Failed to start step test: ${error.message}`, 500);
    }
  }

  /**
   * Test a full temporary workflow.
   */
  async testWorkflow(tenantId: string, body: any, context?: any): Promise<RouteResponse> {
    const { db } = await import('@utils/db');
    const { env } = await import('@utils/env');
    const { JobProcessingUtils } = await import('@domains/workflows/services/workflow/workflowJobProcessingService');
    
    const WORKFLOWS_TABLE = env.workflowsTable;
    const SUBMISSIONS_TABLE = env.submissionsTable;
    const JOBS_TABLE = env.jobsTable;

    const { steps, input } = body;

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      throw new ApiError('Steps array is required', 400);
    }

    const testId = ulid();
    const workflowId = `test-workflow-${testId}`;
    const submissionId = `test-submission-${testId}`;
    const jobId = `test-job-${testId}`;

    logger.info('[Test Workflow] Starting workflow test', {
      tenantId,
      jobId,
      stepCount: steps.length
    });

    try {
      // 1. Create temporary workflow
      const workflow = {
        workflow_id: workflowId,
        tenant_id: tenantId,
        workflow_name: 'Test Workflow Playground',
        workflow_description: 'Temporary playground workflow',
        steps: steps,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_test: true // Marker for cleanup
      };
      await db.put(WORKFLOWS_TABLE, workflow);

      // 2. Create temporary submission
      const submission = {
        submission_id: submissionId,
        tenant_id: tenantId,
        form_id: 'test-form', // Dummy
        submission_data: input || {}, // User provided input
        created_at: new Date().toISOString()
      };
      await db.put(SUBMISSIONS_TABLE, submission);

      // 3. Create job
      const job = {
        job_id: jobId,
        tenant_id: tenantId,
        workflow_id: workflowId,
        submission_id: submissionId,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_test: true
      };
      await db.put(JOBS_TABLE, job);

      // 4. Trigger worker for full workflow
      if (env.isDevelopment()) {
        const res = context?.res;
        if (res) {
            // Streaming mode
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            });
            
            res.write(`data: ${JSON.stringify({ type: 'init', job_id: jobId })}\n\n`);

            await this.triggerLocalWorker(jobId, undefined, (log) => {
                res.write(`data: ${JSON.stringify({ type: 'log', content: log })}\n\n`);
            });
            
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            res.end();
            return { statusCode: 200, body: { handled: true } };
        } else {
            // Non-streaming
            this.triggerLocalWorker(jobId);
        }
      } else {
        await JobProcessingUtils.triggerAsyncProcessing(
            jobId,
            tenantId,
            {
              job_id: jobId,
              step_index: 0,
              step_type: 'workflow_step'
            }
        );
      }

      return {
        statusCode: 202,
        body: {
          job_id: jobId,
          status: 'pending',
          message: 'Workflow test started'
        }
      };

    } catch (error: any) {
      logger.error('[Test Workflow] Failed to start test', {
        error: error.message,
        stack: error.stack
      });
      throw new ApiError(`Failed to start workflow test: ${error.message}`, 500);
    }
  }

  /**
   * Helper to trigger local worker process
   */
  private async triggerLocalWorker(jobId: string, stepIndex?: string, onLog?: (log: string) => void): Promise<number> {
    const { spawn } = await import('child_process');
    const path = await import('path');
    const { env } = await import('@utils/env');
    const { db } = await import('@utils/db');
    const JOBS_TABLE = env.jobsTable;
    
    // Determine worker path - assume running from backend/api
    // Try multiple paths to be safe
    let workerScript = path.resolve(process.cwd(), '../worker/worker.py');
    const fs = await import('fs');
    if (!fs.existsSync(workerScript)) {
       // Try relative to this file? No, too hard with TS build.
       // Try project root assumption
       workerScript = path.resolve(process.cwd(), 'backend/worker/worker.py');
    }
    
    if (!fs.existsSync(workerScript)) {
        logger.error('[Local Worker] Could not find worker script', { searchPath: workerScript });
        return 1;
    }

    const envVars = {
      ...process.env,
      JOB_ID: jobId,
      ...(stepIndex ? { STEP_INDEX: stepIndex } : {}),
      PYTHONUNBUFFERED: '1',
      LOG_FORMAT: 'json' // Force JSON logging for structured parsing in Playground
    };

    logger.info('[Local Worker] Spawning local worker', { script: workerScript, jobId, stepIndex });
    
    // Mark job as processing for better UX while the local worker runs.
    try {
      await db.update(JOBS_TABLE, { job_id: jobId }, { status: 'processing', updated_at: new Date().toISOString() });
    } catch (e: any) {
      logger.warn('[Local Worker] Failed to mark job as processing', { jobId, error: e?.message || String(e) });
    }

    return new Promise((resolve) => {
        const worker = spawn('python3', [workerScript], { env: envVars });

        let stderrTail = '';
        
        worker.stdout.on('data', (data: Buffer) => {
          const str = data.toString();
          logger.info(`[Worker Output] ${str}`);
          if (onLog) onLog(str);
        });
        
        worker.stderr.on('data', (data: Buffer) => {
          const str = data.toString();
          try {
            stderrTail = (stderrTail + str).slice(-2000);
          } catch {
            // ignore
          }
          logger.error(`[Worker Error] ${str}`);
          if (onLog) onLog(str);
        });
        
        worker.on('close', (code: number) => {
          logger.info('[Local Worker] Worker finished', { code });

          // Update job status based on local worker completion
          void (async () => {
            const now = new Date().toISOString();
            try {
              if (code === 0) {
                await db.update(JOBS_TABLE, { job_id: jobId }, { status: 'completed', updated_at: now, completed_at: now });
              } else {
                await db.update(JOBS_TABLE, { job_id: jobId }, {
                  status: 'failed',
                  updated_at: now,
                  completed_at: now,
                  error_message: stderrTail ? stderrTail.slice(-1000) : 'Local worker exited non-zero',
                  error_type: 'LocalWorkerError',
                });
              }
            } catch (e: any) {
              logger.error('[Local Worker] Failed to update test job status after worker finished', { jobId, code, error: e?.message || String(e) });
            }
          })();
          
          resolve(code);
        });
    });
  }

  /**
   * Generate a workflow with AI (async).
   * Creates a job and triggers async processing.
   */
  async generateWithAI(tenantId: string, body: any): Promise<RouteResponse> {
    const { description, model = 'gpt-5.2', webhook_url } = body;

    if (!description || !description.trim()) {
      throw new ApiError('Description is required', 400);
    }

    // Validate webhook_url if provided
    if (webhook_url) {
      if (typeof webhook_url !== 'string' || !webhook_url.trim()) {
        throw new ApiError('webhook_url must be a valid URL string', 400);
      }
      // Basic URL validation
      try {
        new URL(webhook_url);
      } catch {
        throw new ApiError('webhook_url must be a valid URL', 400);
      }
    }

    logger.info('[Workflow Generation] Starting async generation', {
      tenantId,
      model,
      descriptionLength: description.length,
      hasWebhookUrl: !!webhook_url,
      timestamp: new Date().toISOString(),
    });

    try {
      const { jobId } = await workflowGenerationJobService.startWorkflowGeneration({
        tenantId,
        description,
        model,
        webhookUrl: webhook_url,
      });

      return {
        statusCode: 202,
        body: {
          job_id: jobId,
          status: 'pending',
          message: 'Workflow generation started. Poll /admin/workflows/generation-status/:jobId for status.',
        },
      };
    } catch (error: any) {
      logger.error('[Workflow Generation] Failed to start job', {
        tenantId,
        error: error.message,
        stack: error.stack,
      });
      throw new ApiError(`Failed to start workflow generation: ${error.message}`, 500);
    }
  }


  /**
   * Get the status of a workflow generation job.
   */
  async getGenerationStatus(tenantId: string, jobId: string): Promise<RouteResponse> {
    const job = await workflowGenerationJobService.getJob(jobId);

    if (!job) {
      throw new ApiError('Job not found', 404);
    }

    if (job.tenant_id !== tenantId) {
      throw new ApiError('Unauthorized', 403);
    }

    await workflowGenerationJobService.ensureLocalProcessing(job);

    return {
      statusCode: 200,
      body: {
        job_id: jobId,
        status: job.status,
        result: job.result,
        error_message: job.error_message,
        workflow_id: job.workflow_id, // Include workflow_id if available
        created_at: job.created_at,
        updated_at: job.updated_at,
      },
    };
  }

  /**
   * Get the status of a workflow AI edit job.
   */
  async getAIEditStatus(tenantId: string, jobId: string): Promise<RouteResponse> {
    const job = await workflowAIEditJobService.getJob(jobId);

    if (!job) {
      throw new ApiError('Job not found', 404);
    }

    if (job.tenant_id !== tenantId) {
      throw new ApiError('Unauthorized', 403);
    }

    await workflowAIEditJobService.ensureLocalProcessing(job);

    return {
      statusCode: 200,
      body: {
        job_id: jobId,
        status: job.status,
        result: job.result,
        error_message: job.error_message,
        workflow_id: job.workflow_id,
        improvement_status:
          job.improvement_status ||
          (job.status === "completed" && job.result ? "pending" : null),
        reviewed_at: job.reviewed_at,
        created_at: job.created_at,
        updated_at: job.updated_at,
      },
    };
  }

  /**
   * List workflow AI improvements for review.
   */
  async listAIImprovements(
    tenantId: string,
    workflowId: string,
  ): Promise<RouteResponse> {
    const improvements =
      await workflowAIEditJobService.listWorkflowAIImprovements(
        tenantId,
        workflowId,
      );

    return {
      statusCode: 200,
      body: {
        improvements,
      },
    };
  }

  /**
   * Review a workflow AI improvement (approve/deny).
   */
  async reviewAIImprovement(
    tenantId: string,
    jobId: string,
    body: any,
  ): Promise<RouteResponse> {
    const status = typeof body?.status === "string" ? body.status : null;

    if (!status) {
      throw new ApiError("status is required", 400);
    }

    if (status !== "pending" && status !== "approved" && status !== "denied") {
      throw new ApiError("Invalid improvement status", 400);
    }

    const improvement =
      await workflowAIEditJobService.updateImprovementStatus(
        tenantId,
        jobId,
        status,
      );

    return {
      statusCode: 200,
      body: {
        improvement,
      },
    };
  }

  /**
   * Refine workflow instructions using AI.
   */
  async refineInstructions(tenantId: string, body: any): Promise<RouteResponse> {
    const refinedInstructions = await workflowInstructionsService.refineInstructions({
      current_instructions: body.current_instructions,
      edit_prompt: body.edit_prompt,
      model: body.model,
      tenantId,
    });

    return {
      statusCode: 200,
      body: {
        refined_instructions: refinedInstructions,
      },
    };
  }

  /**
   * Generate a workflow step using AI.
   */
  async aiGenerateStep(tenantId: string, workflowId: string, body: any): Promise<RouteResponse> {
    const { db } = await import('@utils/db');
    const { env } = await import('@utils/env');
    const WORKFLOWS_TABLE = env.workflowsTable;
    const USER_SETTINGS_TABLE = env.userSettingsTable;

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
      const settings = USER_SETTINGS_TABLE
        ? await db.get(USER_SETTINGS_TABLE, { tenant_id: tenantId })
        : null;
      const defaultToolChoice =
        settings?.default_tool_choice === 'auto' ||
        settings?.default_tool_choice === 'required' ||
        settings?.default_tool_choice === 'none'
          ? settings.default_tool_choice
          : undefined;
      const defaultServiceTier =
        settings?.default_service_tier &&
        ["auto", "default", "flex", "scale", "priority"].includes(
          settings.default_service_tier,
        )
          ? settings.default_service_tier
          : undefined;
      const defaultTextVerbosity =
        settings?.default_text_verbosity &&
        ["low", "medium", "high"].includes(settings.default_text_verbosity)
          ? settings.default_text_verbosity
          : undefined;
      const promptOverrides = getPromptOverridesFromSettings(settings || undefined);

      // Get OpenAI client
      const openai = await getOpenAIClient();
      const aiService = new WorkflowStepAIService(openai);

      // Prepare the request
      const aiRequest: AIStepGenerationRequest = {
        userPrompt: body.userPrompt,
        action: body.action,
        defaultToolChoice,
        defaultServiceTier,
        defaultTextVerbosity,
        tenantId,
        promptOverrides,
        workflowContext: {
          workflow_id: workflowId,
          workflow_name: workflow.workflow_name || 'Untitled Workflow',
          workflow_description: workflow.workflow_description || '',
          current_steps: (workflow.steps || []).map((step: any) => ({
            step_name: step.step_name,
            step_description: step.step_description,
            model: step.model,
            tools: step.tools,
            depends_on: step.depends_on,
            step_order: step.step_order,
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
  async aiEditWorkflow(
    tenantId: string,
    workflowId: string,
    body: any,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    const { db } = await import('@utils/db');
    const { env } = await import('@utils/env');
    const WORKFLOWS_TABLE = env.workflowsTable;

    // Validate required fields
    // userPrompt can be optional if contextJobId is provided (we can use context to imply improvement)
    const userPrompt = typeof body.userPrompt === 'string' ? body.userPrompt : '';
    const contextJobId = typeof body.contextJobId === 'string' ? body.contextJobId : null;

    if (!userPrompt && !contextJobId) {
      throw new ApiError('Either userPrompt or contextJobId is required', 400);
    }

    // Get the workflow
    const workflow = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });

    if (!workflow || workflow.deleted_at) {
      throw new ApiError('This lead magnet doesn\'t exist or has been removed', 404);
    }

    if (workflow.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this lead magnet', 403);
    }

    logger.info('[AI Workflow Edit] Starting async edit job', {
      workflowId,
      workflowName: workflow.workflow_name,
      userPrompt: userPrompt.substring(0, 100),
      currentStepCount: workflow.steps?.length || 0,
      contextJobId,
    });

    try {
      const { jobId } = await workflowAIEditJobService.startWorkflowAIEdit({
        tenantId,
        workflowId,
        userPrompt,
        ...(contextJobId ? { contextJobId } : {}),
        requestedByUserId: context?.auth?.actingUserId,
      });

      return {
        statusCode: 202,
        body: {
          job_id: jobId,
          status: 'pending',
          message:
            'Workflow AI edit started. Poll /admin/workflows/ai-edit-status/:jobId for status.',
        },
      };
    } catch (error: any) {
      logger.error('[AI Workflow Edit] Failed to start job', {
        workflowId,
        error: error.message,
        stack: error.stack,
      });
      throw new ApiError(`Failed to start workflow edit: ${error.message}`, 500);
    }
  }
}

export const workflowAIController = new WorkflowAIController();