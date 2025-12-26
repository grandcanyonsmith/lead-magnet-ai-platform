import { ApiError } from '@utils/errors';
import { RouteResponse } from '@routes/routes';
import { WorkflowStepAIService, AIStepGenerationRequest } from '@domains/workflows/services/workflowStepAIService';
import { WorkflowAIService, WorkflowAIEditRequest } from '@domains/workflows/services/workflowAIService';
import { workflowInstructionsService } from '@domains/workflows/services/workflowInstructionsService';
import { logger } from '@utils/logger';
import { getOpenAIClient } from '@services/openaiService';
import { workflowGenerationJobService } from '@domains/workflows/services/workflowGenerationJobService';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

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
    const { description, model = 'gpt-5.1-codex', webhook_url } = body;

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
    const JOBS_TABLE = env.jobsTable;
    const SUBMISSIONS_TABLE = env.submissionsTable;
    const ARTIFACTS_TABLE = env.artifactsTable;
    const ARTIFACTS_BUCKET = env.artifactsBucket;

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

    logger.info('[AI Workflow Edit] Starting edit', {
      workflowId,
      workflowName: workflow.workflow_name,
      userPrompt: userPrompt.substring(0, 100),
      currentStepCount: workflow.steps?.length || 0,
      contextJobId,
    });

    // ---------------------------------------------------------
    // CONTEXT GATHERING
    // ---------------------------------------------------------
    let executionHistory: any = undefined;
    const referenceExamples: any[] = [];

    const s3Client = new S3Client({ region: env.awsRegion });

    // Helper to fetch full content from S3
    const fetchS3Json = async (key: string) => {
      try {
        const cmd = new GetObjectCommand({ Bucket: ARTIFACTS_BUCKET, Key: key });
        const res = await s3Client.send(cmd);
        if (res.Body) {
          const str = await res.Body.transformToString();
          return JSON.parse(str);
        }
      } catch (e: any) {
        logger.warn('[WorkflowAI] Failed to fetch S3 JSON', { key, error: e.message });
      }
      return null;
    };

    const fetchS3Text = async (key: string) => {
      try {
        const cmd = new GetObjectCommand({ Bucket: ARTIFACTS_BUCKET, Key: key });
        const res = await s3Client.send(cmd);
        if (res.Body) {
          return await res.Body.transformToString();
        }
      } catch (e: any) {
        logger.warn('[WorkflowAI] Failed to fetch S3 Text', { key, error: e.message });
      }
      return null;
    };

    if (contextJobId) {
      try {
        const job = await db.get(JOBS_TABLE, { job_id: contextJobId });
        if (job && job.tenant_id === tenantId) {
          executionHistory = {};

          // 1. Fetch Submission Data (Inputs)
          if (job.submission_id) {
            const submission = await db.get(SUBMISSIONS_TABLE, { submission_id: job.submission_id });
            if (submission) {
              executionHistory.submissionData = submission.submission_data;
            }
          }

          // 2. Fetch Step Execution Results (Outputs)
          if (job.execution_steps_s3_key) {
             const fullSteps = await fetchS3Json(job.execution_steps_s3_key);
             if (fullSteps) {
               executionHistory.stepExecutionResults = fullSteps;
             }
          } else if (job.execution_steps) {
            executionHistory.stepExecutionResults = job.execution_steps;
          }

          // 3. Fetch Final Artifact Summary
          if (job.artifacts && job.artifacts.length > 0) {
            const finalArtifactId = job.artifacts[job.artifacts.length - 1]; // Naive last
            // Ideally find html_final or markdown_final
            const artifact = await db.get(ARTIFACTS_TABLE, { artifact_id: finalArtifactId });
            if (artifact && artifact.s3_key) {
               const text = await fetchS3Text(artifact.s3_key);
               if (text) executionHistory.finalArtifactSummary = text;
            }
          }
        }
      } catch (err: any) {
        logger.error('[WorkflowAI] Failed to fetch context job', { contextJobId, error: err.message });
      }
    }

    // Reference Examples (completed jobs for same workflow)
    try {
      const examplesRes = await db.query(
        JOBS_TABLE,
        'gsi_workflow_status',
        'workflow_id = :wId AND #s = :s',
        { ':wId': workflowId, ':s': 'completed' },
        { '#s': 'status' },
        5 // fetch 5
      );
      
      const potentialExamples = examplesRes.items || [];
      // Filter out the current context job
      const filtered = potentialExamples.filter((j: any) => j.job_id !== contextJobId);
      
      // Take top 2 recent
      for (const exJob of filtered.slice(0, 2)) {
        const exData: any = { jobId: exJob.job_id };
        
        // Get input
        if (exJob.submission_id) {
           const sub = await db.get(SUBMISSIONS_TABLE, { submission_id: exJob.submission_id });
           if (sub) exData.submissionData = sub.submission_data;
        }

        // Get output (final artifact only to save tokens)
         if (exJob.artifacts && exJob.artifacts.length > 0) {
            const artId = exJob.artifacts[exJob.artifacts.length - 1];
            const art = await db.get(ARTIFACTS_TABLE, { artifact_id: artId });
            if (art && art.s3_key) {
               const txt = await fetchS3Text(art.s3_key);
               if (txt) exData.finalArtifactSummary = txt;
            }
         }

         if (exData.submissionData && exData.finalArtifactSummary) {
           referenceExamples.push(exData);
         }
      }
    } catch (err: any) {
      logger.warn('[WorkflowAI] Failed to fetch reference examples', { error: err.message });
    }

    try {
      // Get OpenAI client
      const openai = await getOpenAIClient();
      const aiService = new WorkflowAIService(openai);

      // Prepare the request
      const aiRequest: WorkflowAIEditRequest = {
        userPrompt: userPrompt,
        workflowContext: {
          workflow_id: workflowId,
          workflow_name: workflow.workflow_name || 'Untitled Workflow',
          workflow_description: workflow.workflow_description || '',
          template_id: workflow.template_id,
          current_steps: workflow.steps || [],
        },
        executionHistory,
        referenceExamples
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
