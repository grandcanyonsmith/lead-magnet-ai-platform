import { ApiError } from '@utils/errors';
import { RouteResponse } from '@routes/routes';
import { WorkflowStepAIService, AIStepGenerationRequest } from '@domains/workflows/services/workflowStepAIService';
import { workflowInstructionsService } from '@domains/workflows/services/workflowInstructionsService';
import { logger } from '@utils/logger';
import { getOpenAIClient } from '@services/openaiService';
import { workflowGenerationJobService } from '@domains/workflows/services/workflowGenerationJobService';
import { workflowAIEditJobService } from '@domains/workflows/services/workflowAIEditJobService';
import { ulid } from 'ulid';

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
   * Test a single workflow step.
   */
  async testStep(tenantId: string, body: any): Promise<RouteResponse> {
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
        // Spawn local worker process for Python execution
        const { spawn } = await import('child_process');
        const path = await import('path');
        
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
            logger.error('[Test Step] Could not find worker script', { searchPath: workerScript });
            // Fallback or throw?
        }

        const envVars = {
          ...process.env,
          JOB_ID: jobId,
          STEP_INDEX: '0',
          PYTHONUNBUFFERED: '1'
        };

        logger.info('[Test Step] Spawning local worker', { script: workerScript, jobId });
        
        // Mark job as processing for better UX while the local worker runs.
        try {
          await db.update(JOBS_TABLE, { job_id: jobId }, { status: 'processing', updated_at: new Date().toISOString() });
        } catch (e: any) {
          logger.warn('[Test Step] Failed to mark job as processing', { jobId, error: e?.message || String(e) });
        }

        const worker = spawn('python3', [workerScript], { env: envVars });

        let stderrTail = '';
        
        worker.stdout.on('data', (data) => {
          logger.info(`[Worker Output] ${data}`);
        });
        
        worker.stderr.on('data', (data) => {
          try {
            stderrTail = (stderrTail + data.toString()).slice(-2000);
          } catch {
            // ignore
          }
          logger.error(`[Worker Error] ${data}`);
        });
        
        worker.on('close', (code) => {
          logger.info('[Test Step] Worker finished', { code });

          // Update job status based on local worker completion so the UI (and jobs list)
          // doesn't show test jobs stuck in "pending"/"processing".
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
              logger.error('[Test Step] Failed to update test job status after worker finished', { jobId, code, error: e?.message || String(e) });
            }
          })();
        });

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
        created_at: job.created_at,
        updated_at: job.updated_at,
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
