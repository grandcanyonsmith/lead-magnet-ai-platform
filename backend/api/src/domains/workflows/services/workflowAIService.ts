import OpenAI from 'openai';
import { WorkflowStep, ensureStepDefaults } from './workflow/workflowConfigSupport';
import { ToolChoice } from '@utils/types';
import { validateDependencies } from '@utils/dependencyResolver';
import { logger } from '@utils/logger';
import { stripMarkdownCodeFences, callResponsesWithTimeout } from '@utils/openaiHelpers';
import { parseJsonFromText } from '@utils/jsonParsing';
import { retryWithBackoff } from '@utils/errorHandling';
import {
  getPromptOverridesForTenant,
  resolvePromptOverride,
  type PromptOverride,
  type PromptOverrides,
} from '@services/promptOverrides';

export interface WorkflowAIEditRequest {
  userPrompt: string;
  defaultToolChoice?: ToolChoice;
  defaultServiceTier?: string;
  defaultTextVerbosity?: string;
  reviewServiceTier?: string;
  reviewReasoningEffort?: string;
  tenantId?: string;
  promptOverrides?: PromptOverrides;
  reviewerUser?: {
    user_id: string;
    name?: string;
    email?: string;
    role?: string;
  };
  workflowContext: {
    workflow_id: string;
    workflow_name: string;
    workflow_description: string;
    template_id?: string;
    current_steps: WorkflowStep[];
  };
  // Context from the current job being analyzed
  executionHistory?: {
    submissionData?: any;
    stepExecutionResults?: any[]; // Full or summarized step outputs
    finalArtifactSummary?: string;
  };
  // Context from other successful jobs (few-shot learning)
  referenceExamples?: Array<{
    jobId: string;
    submissionData: any;
    finalArtifactSummary: string;
  }>;
}

export interface WorkflowAIEditResponse {
  workflow_name?: string;
  workflow_description?: string;
  steps: WorkflowStep[];
  changes_summary: string;
}

type WorkflowAIStreamHandlers = {
  onDelta?: (text: string) => void;
  onEvent?: (event: any) => void;
};

import { AVAILABLE_MODELS } from './workflow/modelDescriptions';
import { WORKFLOW_AI_SYSTEM_PROMPT } from '@config/prompts';

const AVAILABLE_TOOLS = [
  'web_search',
  'code_interpreter',
  'computer_use_preview',
  'image_generation',
  'shell',
];

const DEFAULT_TOOL_CHOICE: ToolChoice = 'required';
const VALID_TOOL_CHOICES = new Set<ToolChoice>(['auto', 'required', 'none']);
const VALID_SERVICE_TIERS = new Set(['auto', 'default', 'flex', 'scale', 'priority']);
const VALID_REASONING_EFFORTS = new Set(['none', 'low', 'medium', 'high', 'xhigh']);
const VALID_TEXT_VERBOSITIES = new Set(['low', 'medium', 'high']);

type WorkflowAIContextParams = Pick<
  WorkflowAIEditRequest,
  'workflowContext' | 'executionHistory' | 'referenceExamples' | 'reviewerUser'
>;

type ResolvedWorkflowAISettings = {
  resolvedDefaultToolChoice: ToolChoice;
  resolvedDefaultServiceTier?: string;
  resolvedDefaultTextVerbosity?: string;
  shouldOverrideServiceTier: boolean;
  resolvedReviewServiceTier: string;
  resolvedReviewReasoningEffort: string;
};

export const buildWorkflowAiSystemPrompt = (
  defaultToolChoice: ToolChoice,
  defaultServiceTier?: string,
  defaultTextVerbosity?: string,
) => {
  return WORKFLOW_AI_SYSTEM_PROMPT
    .replace('{{defaultToolChoice}}', defaultToolChoice)
    .replace('{{defaultServiceTier}}', defaultServiceTier || "auto")
    .replace('{{defaultTextVerbosity}}', defaultTextVerbosity || "model default");
};

export class WorkflowAIService {
  constructor(private openaiClient: OpenAI) {}

  private resolveRequestSettings(
    request: WorkflowAIEditRequest,
  ): ResolvedWorkflowAISettings {
    const {
      defaultToolChoice,
      defaultServiceTier,
      defaultTextVerbosity,
      reviewServiceTier,
      reviewReasoningEffort,
    } = request;
    const resolvedDefaultToolChoice = VALID_TOOL_CHOICES.has(
      defaultToolChoice as ToolChoice,
    )
      ? (defaultToolChoice as ToolChoice)
      : DEFAULT_TOOL_CHOICE;
    const resolvedDefaultServiceTier =
      defaultServiceTier && VALID_SERVICE_TIERS.has(defaultServiceTier)
        ? defaultServiceTier
        : undefined;
    const resolvedDefaultTextVerbosity =
      defaultTextVerbosity && VALID_TEXT_VERBOSITIES.has(defaultTextVerbosity)
        ? defaultTextVerbosity
        : undefined;
    const shouldOverrideServiceTier =
      resolvedDefaultServiceTier !== undefined &&
      resolvedDefaultServiceTier !== "auto";
    const resolvedReviewServiceTier =
      reviewServiceTier && VALID_SERVICE_TIERS.has(reviewServiceTier)
        ? reviewServiceTier
        : "priority";
    const resolvedReviewReasoningEffort =
      reviewReasoningEffort && VALID_REASONING_EFFORTS.has(reviewReasoningEffort)
        ? reviewReasoningEffort
        : "high";

    return {
      resolvedDefaultToolChoice,
      resolvedDefaultServiceTier,
      resolvedDefaultTextVerbosity,
      shouldOverrideServiceTier,
      resolvedReviewServiceTier,
      resolvedReviewReasoningEffort,
    };
  }

  private buildContextMessage({
    workflowContext,
    executionHistory,
    referenceExamples,
    reviewerUser,
  }: WorkflowAIContextParams): string {
    const contextParts: string[] = [
      `Current Workflow: ${workflowContext.workflow_name}`,
      `Description: ${workflowContext.workflow_description || '(none)'}`,
      workflowContext.template_id
        ? `Template: Configured (ID: ${workflowContext.template_id})`
        : 'Template: Not configured',
      '',
      'Current Steps:',
    ];

    if (workflowContext.current_steps.length === 0) {
      contextParts.push('(No steps yet)');
    } else {
      workflowContext.current_steps.forEach((step, index) => {
        const tools =
          step.tools && Array.isArray(step.tools) && step.tools.length > 0
            ? ` [Tools: ${step.tools
                .map((t: any) =>
                  typeof t === 'string' ? t : (t?.type || 'unknown'),
                )
                .join(', ')}]`
            : '';
        const deps = Array.isArray(step.depends_on)
          ? ` [depends_on: ${step.depends_on.length > 0 ? step.depends_on.join(', ') : '[]'}]`
          : ' [depends_on: []]';
        const orderSuffix =
          typeof step.step_order === "number" && step.step_order !== index
            ? ` [order: ${step.step_order}]`
            : '';
        contextParts.push(
          `Index ${index} (Step ${index + 1}): ${step.step_name} (${step.model})${tools}${deps}${orderSuffix}`,
        );
        if (step.step_description) {
          contextParts.push(`   ${step.step_description}`);
        }
      });
      contextParts.push('');
      contextParts.push(
        "IMPORTANT: Every step MUST have a depends_on array. If a step uses output from previous steps, it must list their indices in depends_on. If a step is the first step or doesn't use previous outputs, use depends_on: [].",
      );
    }

    if (reviewerUser) {
      const reviewerLabel =
        reviewerUser.name || reviewerUser.email || reviewerUser.user_id;
      const reviewerMeta = [
        reviewerUser.role ? `Role: ${reviewerUser.role}` : null,
        reviewerUser.email ? `Email: ${reviewerUser.email}` : null,
      ]
        .filter(Boolean)
        .join(" • ");
      contextParts.push("", "Reviewer Context:");
      contextParts.push(
        reviewerMeta ? `${reviewerLabel} (${reviewerMeta})` : reviewerLabel,
      );
    }

    if (referenceExamples && referenceExamples.length > 0) {
      contextParts.push('', '---', 'REFERENCE EXAMPLES (Past Successful Jobs):');
      contextParts.push(
        'Use these examples to understand how different inputs should be handled.',
      );
      referenceExamples.forEach((ex, idx) => {
        const inputSummary = JSON.stringify(ex.submissionData || {}, null, 2);
        const fullOutcome = String(ex.finalArtifactSummary || "");
        const outputSummary =
          fullOutcome.length > 1000
            ? fullOutcome.slice(0, 1000) + "... [truncated]"
            : fullOutcome;
        contextParts.push(`\nExample #${idx + 1}:`);
        contextParts.push(`Input:\n${inputSummary}`);
        contextParts.push(`Outcome:\n${outputSummary}`);
      });
    }

    if (executionHistory) {
      contextParts.push(
        '',
        '---',
        'CURRENT JOB CONTEXT (The run we are improving):',
      );
      
      if (executionHistory.submissionData) {
        contextParts.push(
          `Original Input:\n${JSON.stringify(
            executionHistory.submissionData,
            null,
            2,
          )}`,
        );
      }

      if (
        executionHistory.stepExecutionResults &&
        executionHistory.stepExecutionResults.length > 0
      ) {
        contextParts.push('\nStep Execution Results:');
        executionHistory.stepExecutionResults.forEach((step: any, idx: number) => {
          const status = step._status || step.status || 'unknown';
          const output = step.output 
            ? (typeof step.output === 'string' ? step.output : JSON.stringify(step.output))
            : '(no output)';
          const truncatedOutput =
            output.length > 4000 ? output.slice(0, 4000) + '... [truncated]' : output;
          
          contextParts.push(
            `Step ${step.step_order || idx + 1} (${status}):\n${truncatedOutput}\n`,
          );
        });
      }

      if (executionHistory.finalArtifactSummary) {
        const finalDoc =
          executionHistory.finalArtifactSummary.length > 15000
            ? executionHistory.finalArtifactSummary.slice(0, 15000) +
              '... [truncated]'
            : executionHistory.finalArtifactSummary;
        contextParts.push(`\nFinal Deliverable:\n${finalDoc}`);
      }
    }

    return contextParts.join('\n');
  }

  private buildUserMessage(contextMessage: string, userPrompt: string): string {
    return `${contextMessage}

User Request: ${userPrompt}

Please generate the updated workflow configuration with all necessary changes.`;
  }

  private async resolveWorkflowEditPrompt(
    request: WorkflowAIEditRequest,
    contextMessage: string,
    settings: ResolvedWorkflowAISettings,
  ): Promise<PromptOverride> {
    const { workflowContext, userPrompt, tenantId, promptOverrides } = request;
    const {
      resolvedDefaultToolChoice,
      resolvedDefaultServiceTier,
      resolvedDefaultTextVerbosity,
      resolvedReviewServiceTier,
      resolvedReviewReasoningEffort,
    } = settings;
    const userMessage = this.buildUserMessage(contextMessage, userPrompt);

    const overrides =
      promptOverrides ?? (tenantId ? await getPromptOverridesForTenant(tenantId) : undefined);
    return resolvePromptOverride({
      key: "workflow_edit",
      defaults: {
        instructions: buildWorkflowAiSystemPrompt(
          resolvedDefaultToolChoice,
          resolvedDefaultServiceTier,
          resolvedDefaultTextVerbosity,
        ),
        prompt: userMessage,
      },
      overrides,
      variables: {
        workflow_name: workflowContext.workflow_name,
        workflow_description: workflowContext.workflow_description,
        context_message: contextMessage,
        user_prompt: userPrompt,
        review_service_tier: resolvedReviewServiceTier,
        review_reasoning_effort: resolvedReviewReasoningEffort,
        default_tool_choice: resolvedDefaultToolChoice,
        default_service_tier: resolvedDefaultServiceTier,
        default_text_verbosity: resolvedDefaultTextVerbosity,
      },
    });
  }

  private buildResponsePayload(
    resolved: PromptOverride,
    request: WorkflowAIEditRequest,
    stream = false,
  ): Record<string, unknown> {
    const { reviewReasoningEffort, reviewServiceTier } = request;
    return {
      model: resolved.model || 'gpt-5.2',
      instructions: resolved.instructions,
      input: resolved.prompt,
      reasoning: {
        effort:
          reviewReasoningEffort && VALID_REASONING_EFFORTS.has(reviewReasoningEffort)
            ? reviewReasoningEffort
            : (resolved.reasoning_effort || 'high'),
      },
      service_tier:
        reviewServiceTier && VALID_SERVICE_TIERS.has(reviewServiceTier)
          ? reviewServiceTier
          : (resolved.service_tier || 'priority'),
      ...(stream ? { stream: true } : {}),
    };
  }

  private getErrorStatus(error: any): number | undefined {
    return typeof error?.status === 'number'
      ? error.status
      : typeof error?.statusCode === 'number'
        ? error.statusCode
        : typeof error?.response?.status === 'number'
          ? error.response.status
          : undefined;
  }

  private isRetryableError(error: any): boolean {
    const status = this.getErrorStatus(error);
    if (status === 429 || status === 503) return true;
    if (typeof status === 'number' && status >= 500) return true;
    const msg = String(error?.message || '').toLowerCase();
    return (
      msg.includes('timeout') ||
      msg.includes('overloaded') ||
      msg.includes('service unavailable') ||
      msg.includes('rate limit')
    );
  }

  async editWorkflow(request: WorkflowAIEditRequest): Promise<WorkflowAIEditResponse> {
    const {
      userPrompt,
      workflowContext,
      executionHistory,
      referenceExamples,
      reviewerUser,
    } = request;
    const settings = this.resolveRequestSettings(request);
    const contextMessage = this.buildContextMessage({
      workflowContext,
      executionHistory,
      referenceExamples,
      reviewerUser,
    });
    const resolved = await this.resolveWorkflowEditPrompt(
      request,
      contextMessage,
      settings,
    );

    logger.info('[WorkflowAI] Editing workflow', {
      workflow: workflowContext.workflow_name,
      userPrompt: userPrompt.substring(0, 100),
      currentStepCount: workflowContext.current_steps.length,
      hasContext: !!executionHistory,
      referenceCount: referenceExamples?.length || 0,
    });

    try {
      // Use the Responses API with retry logic for reliability (no timeout - can take up to 5 minutes)
      const completion = await retryWithBackoff(
        () =>
          callResponsesWithTimeout(
            () =>
              (this.openaiClient as any).responses.create(
                this.buildResponsePayload(resolved, request),
              ),
            'Workflow AI Edit',
            0, // No timeout - allow up to 5 minutes for complex workflow edits
          ),
        {
          maxAttempts: 3,
          initialDelayMs: 1000,
          retryableErrors: (error) => this.isRetryableError(error),
          onRetry: (attempt, error) => {
            logger.warn('[WorkflowAI] Retrying OpenAI call', {
              attempt,
              error: error instanceof Error ? error.message : String(error),
            });
          },
        },
      );

      const outputText = String((completion as any)?.output_text || '');
      const cleaned = stripMarkdownCodeFences(outputText).trim();
      if (!cleaned) {
        throw new Error('No response from OpenAI');
      }

      const parsedResponse = this.parseWorkflowResponse(cleaned);
      const dependencyUpdate = this.getDependencyOnlyUpdate(
        userPrompt,
        workflowContext.current_steps,
      );
      return this.normalizeWorkflowResponse(parsedResponse, {
        resolvedDefaultToolChoice: settings.resolvedDefaultToolChoice,
        resolvedDefaultServiceTier: settings.resolvedDefaultServiceTier,
        resolvedDefaultTextVerbosity: settings.resolvedDefaultTextVerbosity,
        shouldOverrideServiceTier: settings.shouldOverrideServiceTier,
        dependencyUpdate,
      });
    } catch (error: any) {
      const status = this.getErrorStatus(error);
      const isServiceUnavailable =
        status === 503 ||
        String(error?.message || '').toLowerCase().includes('service unavailable');

      logger.error('[WorkflowAI] Error editing workflow', {
        error: error.message,
        status,
        isServiceUnavailable,
        stack: error.stack,
      });

      if (isServiceUnavailable) {
        throw new Error(
          'OpenAI service is temporarily unavailable. Please try again in a few moments. ' +
          'If the issue persists, the service may be experiencing high load.'
        );
      }

      throw new Error(`Failed to edit workflow: ${error.message}`);
    }
  }

  async streamEditWorkflow(
    request: WorkflowAIEditRequest,
    handlers?: WorkflowAIStreamHandlers,
  ): Promise<WorkflowAIEditResponse> {
    const {
      userPrompt,
      workflowContext,
      executionHistory,
      referenceExamples,
      reviewerUser,
    } = request;
    const settings = this.resolveRequestSettings(request);
    const contextMessage = this.buildContextMessage({
      workflowContext,
      executionHistory,
      referenceExamples,
      reviewerUser,
    });
    const resolved = await this.resolveWorkflowEditPrompt(
      request,
      contextMessage,
      settings,
    );

    logger.info('[WorkflowAI] Streaming workflow edit', {
      workflow: workflowContext.workflow_name,
      userPrompt: userPrompt.substring(0, 100),
      currentStepCount: workflowContext.current_steps.length,
      hasContext: !!executionHistory,
      referenceCount: referenceExamples?.length || 0
    });

    const stream = await (this.openaiClient as any).responses.create(
      this.buildResponsePayload(resolved, request, true),
    );

    let outputText = "";
    for await (const event of stream as any) {
      handlers?.onEvent?.(event);
      const eventType = String((event as any)?.type || "");
      if (!eventType.includes("output_text")) {
        continue;
      }
      const delta =
        typeof (event as any)?.delta === "string"
          ? (event as any).delta
          : typeof (event as any)?.text === "string"
            ? (event as any).text
            : undefined;
      if (!delta) {
        continue;
      }
      outputText += delta;
      handlers?.onDelta?.(delta);
    }

    const cleaned = stripMarkdownCodeFences(outputText).trim();
    if (!cleaned) {
      throw new Error('No response from OpenAI');
    }

    const parsedResponse = this.parseWorkflowResponse(cleaned);
    const dependencyUpdate = this.getDependencyOnlyUpdate(
      userPrompt,
      workflowContext.current_steps,
    );
    return this.normalizeWorkflowResponse(parsedResponse, {
      resolvedDefaultToolChoice: settings.resolvedDefaultToolChoice,
      resolvedDefaultServiceTier: settings.resolvedDefaultServiceTier,
      resolvedDefaultTextVerbosity: settings.resolvedDefaultTextVerbosity,
      shouldOverrideServiceTier: settings.shouldOverrideServiceTier,
      dependencyUpdate,
    });
  }

  private parseWorkflowResponse(cleaned: string): WorkflowAIEditResponse {
    const parsedResponse = parseJsonFromText<WorkflowAIEditResponse>(cleaned, {
      preferLast: true,
    });

    if (!parsedResponse) {
      throw new Error('Invalid response from OpenAI (expected JSON object)');
    }

    if (!parsedResponse.steps || !Array.isArray(parsedResponse.steps)) {
      throw new Error('Invalid response structure from AI - missing steps array');
    }

    return parsedResponse;
  }

  private normalizeWorkflowResponse(
    parsedResponse: WorkflowAIEditResponse,
    options: {
      resolvedDefaultToolChoice: ToolChoice;
      resolvedDefaultServiceTier?: string;
      resolvedDefaultTextVerbosity?: string;
      shouldOverrideServiceTier: boolean;
      dependencyUpdate?: {
        enabled: boolean;
        targetIndices: number[];
        originalSteps: WorkflowStep[];
      };
    },
  ): WorkflowAIEditResponse {
    const {
      resolvedDefaultToolChoice,
      resolvedDefaultServiceTier,
      resolvedDefaultTextVerbosity,
      shouldOverrideServiceTier,
      dependencyUpdate,
    } = options;

    if (dependencyUpdate?.enabled && dependencyUpdate.targetIndices.length > 0) {
      const baseSteps = dependencyUpdate.originalSteps.map((step) => ({
        ...step,
        depends_on: Array.isArray(step.depends_on) ? [...step.depends_on] : [],
        tools: Array.isArray(step.tools)
          ? step.tools.map((tool) =>
              typeof tool === "object" ? { ...tool } : tool,
            )
          : step.tools,
      }));

      dependencyUpdate.targetIndices.forEach((index) => {
        const aiStep = parsedResponse.steps[index];
        if (aiStep && Array.isArray(aiStep.depends_on)) {
          baseSteps[index].depends_on = [...aiStep.depends_on];
        }
      });

      parsedResponse.steps = baseSteps;
      parsedResponse.workflow_name = undefined;
      parsedResponse.workflow_description = undefined;
    }

    const validatedSteps = parsedResponse.steps.map((step: any, index: number) => {
      if (!step.step_name || !step.instructions) {
        throw new Error(`Step ${index + 1} is missing required fields (step_name or instructions)`);
      }

      if (!step.model) {
        step.model = 'gpt-5.2';
      } else if (!AVAILABLE_MODELS.includes(step.model)) {
        logger.warn(
          `[WorkflowAI] Model ${step.model} not in curated list; using as-is`,
        );
      }

      if (step.tools && Array.isArray(step.tools)) {
        step.tools = step.tools.filter((tool: string | { type: string }) => {
          const toolName = typeof tool === 'string' ? tool : (tool as { type: string }).type;
          return AVAILABLE_TOOLS.includes(toolName);
        });
      }

      const hasTools = Array.isArray(step.tools) && step.tools.length > 0;
      if (!VALID_TOOL_CHOICES.has(step.tool_choice as ToolChoice)) {
        step.tool_choice = hasTools ? resolvedDefaultToolChoice : 'none';
      }

      if (step.service_tier && !VALID_SERVICE_TIERS.has(step.service_tier)) {
        delete step.service_tier;
      }

      if (shouldOverrideServiceTier) {
        step.service_tier = resolvedDefaultServiceTier;
      }

      if (
        step.reasoning_effort &&
        !VALID_REASONING_EFFORTS.has(step.reasoning_effort)
      ) {
        step.reasoning_effort = 'high';
      }

      if (
        step.text_verbosity &&
        !VALID_TEXT_VERBOSITIES.has(step.text_verbosity)
      ) {
        delete step.text_verbosity;
      }

      if (step.max_output_tokens !== undefined) {
        if (
          typeof step.max_output_tokens !== 'number' ||
          !Number.isFinite(step.max_output_tokens) ||
          step.max_output_tokens < 1
        ) {
          delete step.max_output_tokens;
        } else {
          step.max_output_tokens = Math.floor(step.max_output_tokens);
        }
      }

      if (step.depends_on) {
        step.depends_on = step.depends_on.filter((dep: number) => 
          typeof dep === 'number' &&
          dep >= 0 && 
          dep < parsedResponse.steps.length &&
          dep !== index
        );
      }

      step.step_order = index;

      return step;
    });

    const normalizedSteps: WorkflowStep[] = ensureStepDefaults(validatedSteps, {
      defaultToolChoice: resolvedDefaultToolChoice,
      defaultServiceTier: resolvedDefaultServiceTier,
      defaultTextVerbosity: resolvedDefaultTextVerbosity,
    });

    try {
      validateDependencies(normalizedSteps);
    } catch (error: any) {
      logger.error('[WorkflowAI] Dependency validation failed', { error: error.message });
      throw new Error(`Invalid step dependencies: ${error.message}`);
    }

    parsedResponse.steps = normalizedSteps;

    logger.info('[WorkflowAI] Workflow edited successfully', {
      newStepCount: parsedResponse.steps.length,
      nameChanged: !!parsedResponse.workflow_name,
      descriptionChanged: !!parsedResponse.workflow_description,
    });

    return parsedResponse;
  }

  private getDependencyOnlyUpdate(
    userPrompt: string,
    currentSteps: WorkflowStep[],
  ): { enabled: boolean; targetIndices: number[]; originalSteps: WorkflowStep[] } {
    const prompt = String(userPrompt || "");
    const lowerPrompt = prompt.toLowerCase();
    const dependencyOnly =
      /dependenc/i.test(lowerPrompt) &&
      (/\bonly\b/.test(lowerPrompt) || /\bjust\b/.test(lowerPrompt));

    if (!dependencyOnly) {
      return { enabled: false, targetIndices: [], originalSteps: currentSteps };
    }

    const targetIndices = new Set<number>();
    const stepNumberRegex = /\bstep\s*(\d+)\b/gi;
    let match: RegExpExecArray | null;
    while ((match = stepNumberRegex.exec(lowerPrompt)) !== null) {
      const idx = Number(match[1]) - 1;
      if (Number.isInteger(idx) && idx >= 0 && idx < currentSteps.length) {
        targetIndices.add(idx);
      }
    }

    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const normalizedPrompt = normalize(prompt);

    currentSteps.forEach((step, index) => {
      if (!step?.step_name) return;
      const stepName = String(step.step_name);
      const normalizedStepName = normalize(stepName);
      if (
        lowerPrompt.includes(stepName.toLowerCase()) ||
        (normalizedStepName && normalizedPrompt.includes(normalizedStepName))
      ) {
        targetIndices.add(index);
      }
    });

    return {
      enabled: true,
      targetIndices: Array.from(targetIndices),
      originalSteps: currentSteps,
    };
  }
}
