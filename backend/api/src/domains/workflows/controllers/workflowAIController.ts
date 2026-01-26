import { ApiError } from '@utils/errors';
import { RouteResponse } from '@routes/routes';
import { RequestContext } from '@routes/router';
import { WorkflowStepAIService, AIStepGenerationRequest } from '@domains/workflows/services/workflowStepAIService';
import { WorkflowAIService, WorkflowAIEditRequest } from '@domains/workflows/services/workflowAIService';
import { workflowInstructionsService } from '@domains/workflows/services/workflowInstructionsService';
import { logger } from '@utils/logger';
import { getOpenAIClient } from '@services/openaiService';
import { workflowGenerationJobService } from '@domains/workflows/services/workflowGenerationJobService';
import { workflowAIEditJobService } from '@domains/workflows/services/workflowAIEditJobService';
import { getPromptOverridesFromSettings } from '@services/promptOverrides';
import { workflowIdeationService } from '@domains/workflows/services/workflowIdeationService';
import { handleStream } from './helpers/streamHelper';
import { testJobService } from '@domains/workflows/services/workflow/testJobService';

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
    const formatModelName = (modelId: string) =>
      modelId
        .replace("gpt-", "GPT-")
        .replace("turbo", "Turbo")
        .replace("computer-use-preview", "Computer Use");

    try {
      const openai = await getOpenAIClient();
      const response = await openai.models.list();
      const data = Array.isArray((response as any)?.data)
        ? (response as any).data
        : [];

      const { MODEL_DESCRIPTIONS_DETAILED } = await import(
        "@domains/workflows/services/workflow/modelDescriptions"
      );

      const models = data
        .map((model: any) => {
          const id = typeof model?.id === "string" ? model.id : "";
          if (!id) return null;
          const description = MODEL_DESCRIPTIONS_DETAILED[id]?.bestFor || "";
          return {
            id,
            name: formatModelName(id),
            description,
            ...MODEL_DESCRIPTIONS_DETAILED[id],
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.name.localeCompare(b.name));

      return {
        statusCode: 200,
        body: { models },
      };
    } catch (error: any) {
      logger.error("[WorkflowAIController] Failed to fetch OpenAI models", {
        error: error?.message || String(error),
      });
      const { MODEL_DESCRIPTIONS_DETAILED, AVAILABLE_MODELS } = await import(
        "@domains/workflows/services/workflow/modelDescriptions"
      );
      const models = AVAILABLE_MODELS.map((id) => ({
        id,
        name: formatModelName(id),
        description: MODEL_DESCRIPTIONS_DETAILED[id]?.bestFor || "",
        ...MODEL_DESCRIPTIONS_DETAILED[id],
      }));
      return {
        statusCode: 200,
        body: { models },
      };
    }
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
   * Stream workflow ideation response.
   */
  async ideateWorkflowStream(
    tenantId: string,
    body: any,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    return handleStream(
      context,
      (options) => workflowIdeationService.ideateWorkflowStream(tenantId, body, options),
      () => this.ideateWorkflow(tenantId, body),
      '[Workflow Ideation]'
    );
  }

  /**
   * Generate mockup images for a selected deliverable.
   */
  async generateIdeationMockups(
    tenantId: string,
    body: any,
  ): Promise<RouteResponse> {
    const result = await workflowIdeationService.generateDeliverableMockups(
      tenantId,
      body,
    );
    return {
      statusCode: 200,
      body: result,
    };
  }

  /**
   * Test a single workflow step.
   */
  async testStep(tenantId: string, body: any, context?: any): Promise<RouteResponse> {
    const { step, input } = body;

    if (!step) {
      throw new ApiError('Step configuration is required', 400);
    }

    const result = await testJobService.createAndRunTestJob(
      tenantId,
      {
        workflow_name: 'Test Step Workflow',
        workflow_description: 'Temporary workflow for testing a step',
        steps: [step]
      },
      input,
      0, // stepIndex 0
      context
    );

    if (result.handled) {
        return { statusCode: 200, body: { handled: true } };
    }

    return {
      statusCode: 202,
      body: {
        job_id: result.jobId,
        status: result.status,
        message: result.message
      }
    };
  }

  /**
   * Test a full temporary workflow.
   */
  async testWorkflow(tenantId: string, body: any, context?: any): Promise<RouteResponse> {
    const { steps, input } = body;

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      throw new ApiError('Steps array is required', 400);
    }

    const result = await testJobService.createAndRunTestJob(
      tenantId,
      {
        workflow_name: 'Test Workflow Playground',
        workflow_description: 'Temporary playground workflow',
        steps: steps
      },
      input,
      undefined, // full workflow
      context
    );

    if (result.handled) {
        return { statusCode: 200, body: { handled: true } };
    }

    return {
      statusCode: 202,
      body: {
        job_id: result.jobId,
        status: result.status,
        message: result.message
      }
    };
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
   * Generate a workflow step using AI with streaming output.
   */
  async aiGenerateStepStream(
    tenantId: string,
    workflowId: string,
    body: any,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    const { db } = await import('@utils/db');
    const { env } = await import('@utils/env');
    const WORKFLOWS_TABLE = env.workflowsTable;
    const USER_SETTINGS_TABLE = env.userSettingsTable;

    if (!body.userPrompt || typeof body.userPrompt !== 'string') {
      throw new ApiError('userPrompt is required and must be a string', 400);
    }

    const workflow = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });

    if (!workflow || workflow.deleted_at) {
      throw new ApiError('This lead magnet doesn\'t exist or has been removed', 404);
    }

    if (workflow.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this lead magnet', 403);
    }

    return handleStream(
      context,
      async (options) => {
        logger.info('[AI Step Generation] Starting streamed generation', {
          workflowId,
          workflowName: workflow.workflow_name,
          userPrompt: body.userPrompt.substring(0, 100),
          action: body.action,
          currentStepIndex: body.currentStepIndex,
        });

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

        const openai = await getOpenAIClient();
        const aiService = new WorkflowStepAIService(openai);

        return await aiService.streamGenerateStep(aiRequest, options);
      },
      () => this.aiGenerateStep(tenantId, workflowId, body),
      '[AI Step Generation]'
    );
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

  /**
   * Edit a workflow using AI with streaming output.
   */
  async aiEditWorkflowStream(
    tenantId: string,
    workflowId: string,
    body: any,
    context?: RequestContext,
  ): Promise<RouteResponse> {
    const { db } = await import('@utils/db');
    const { env } = await import('@utils/env');
    const WORKFLOWS_TABLE = env.workflowsTable;
    const USER_SETTINGS_TABLE = env.userSettingsTable;

    const userPrompt = typeof body.userPrompt === 'string' ? body.userPrompt : '';
    const contextJobId = typeof body.contextJobId === 'string' ? body.contextJobId : null;

    if (!userPrompt && !contextJobId) {
      throw new ApiError('Either userPrompt or contextJobId is required', 400);
    }

    const workflow = await db.get(WORKFLOWS_TABLE, { workflow_id: workflowId });

    if (!workflow || workflow.deleted_at) {
      throw new ApiError('This lead magnet doesn\'t exist or has been removed', 404);
    }

    if (workflow.tenant_id !== tenantId) {
      throw new ApiError('You don\'t have permission to access this lead magnet', 403);
    }

    return handleStream(
      context,
      async (options) => {
        logger.info('[AI Workflow Edit] Starting streamed edit', {
          workflowId,
          workflowName: workflow.workflow_name,
          userPrompt: userPrompt.substring(0, 100),
          currentStepCount: workflow.steps?.length || 0,
          contextJobId,
        });

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
        const reviewServiceTier =
          settings?.default_workflow_improvement_service_tier &&
          ["auto", "default", "flex", "scale", "priority"].includes(
            settings.default_workflow_improvement_service_tier,
          )
            ? settings.default_workflow_improvement_service_tier
            : "priority";
        const reviewReasoningEffort =
          settings?.default_workflow_improvement_reasoning_effort &&
          ["none", "low", "medium", "high", "xhigh"].includes(
            settings.default_workflow_improvement_reasoning_effort,
          )
            ? settings.default_workflow_improvement_reasoning_effort
            : "high";
        const promptOverrides = getPromptOverridesFromSettings(settings || undefined);

        const aiRequest: WorkflowAIEditRequest = {
          userPrompt,
          defaultToolChoice,
          defaultServiceTier,
          defaultTextVerbosity,
          reviewServiceTier,
          reviewReasoningEffort,
          tenantId,
          promptOverrides,
          workflowContext: {
            workflow_id: workflowId,
            workflow_name: workflow.workflow_name || 'Untitled Workflow',
            workflow_description: workflow.workflow_description || '',
            template_id: workflow.template_id,
            current_steps: workflow.steps || [],
          },
        };

        const openai = await getOpenAIClient();
        const aiService = new WorkflowAIService(openai);

        return await aiService.streamEditWorkflow(aiRequest, options);
      },
      () => this.aiEditWorkflow(tenantId, workflowId, body, context),
      '[AI Workflow Edit]'
    );
  }
}

export const workflowAIController = new WorkflowAIController();
