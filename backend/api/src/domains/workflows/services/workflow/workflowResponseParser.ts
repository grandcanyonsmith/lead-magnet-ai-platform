import { WorkflowStep, ensureStepDefaults } from './workflowConfigSupport';
import { ToolChoice } from '@utils/types';
import { validateDependencies } from '@utils/dependencyResolver';
import { logger } from '@utils/logger';
import { parseJsonFromText } from '@utils/jsonParsing';
import { AVAILABLE_MODELS } from './modelDescriptions';

export interface WorkflowAIEditResponse {
  workflow_name?: string;
  workflow_description?: string;
  steps: WorkflowStep[];
  changes_summary: string;
}

const AVAILABLE_TOOLS = [
  'web_search',
  'code_interpreter',
  'computer_use_preview',
  'image_generation',
  'shell',
];

const VALID_TOOL_CHOICES = new Set<ToolChoice>(['auto', 'required', 'none']);
const VALID_SERVICE_TIERS = new Set(['auto', 'default', 'flex', 'scale', 'priority']);
const VALID_REASONING_EFFORTS = new Set(['none', 'low', 'medium', 'high', 'xhigh']);
const VALID_TEXT_VERBOSITIES = new Set(['low', 'medium', 'high']);
const DEFAULT_STEP_INSTRUCTIONS = 'Generate content based on form submission data.';

export class WorkflowResponseParser {
  parseWorkflowResponse(
    cleaned: string,
    fallbackSteps?: WorkflowStep[],
  ): WorkflowAIEditResponse {
    const parsedResponse = parseJsonFromText<any>(cleaned, {
      preferLast: true,
    });

    if (!parsedResponse) {
      throw new Error('Invalid response from OpenAI (expected JSON object)');
    }

    return this.normalizeWorkflowAiResponse(parsedResponse, fallbackSteps);
  }

  normalizeWorkflowResponse(
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
      originalSteps?: WorkflowStep[];
    },
  ): WorkflowAIEditResponse {
    const {
      resolvedDefaultToolChoice,
      resolvedDefaultServiceTier,
      resolvedDefaultTextVerbosity,
      shouldOverrideServiceTier,
      dependencyUpdate,
      originalSteps,
    } = options;

    const fallbackSteps =
      dependencyUpdate?.originalSteps ?? originalSteps ?? [];

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
      const baseStep = fallbackSteps[index];
      const baseStepName =
        typeof baseStep?.step_name === 'string' ? baseStep.step_name.trim() : '';
      const baseInstructions =
        typeof baseStep?.instructions === 'string'
          ? baseStep.instructions.trim()
          : '';
      const rawStepName =
        typeof step.step_name === 'string' ? step.step_name.trim() : '';
      const rawInstructions =
        typeof step.instructions === 'string' ? step.instructions.trim() : '';

      step.step_name = rawStepName || baseStepName || `Step ${index + 1}`;
      step.instructions =
        rawInstructions || baseInstructions || DEFAULT_STEP_INSTRUCTIONS;

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

  private normalizeWorkflowAiResponse(
    parsedResponse: any,
    fallbackSteps?: WorkflowStep[],
  ): WorkflowAIEditResponse {
    const candidates = this.collectResponseCandidates(parsedResponse);
    const steps = this.extractStepsFromCandidates(candidates);
    const { workflow_name, workflow_description } =
      this.extractWorkflowMeta(candidates);
    const changes_summary = this.extractChangesSummary(candidates);
    const resolvedSteps =
      steps ||
      (Array.isArray(fallbackSteps) && fallbackSteps.length > 0
        ? fallbackSteps
        : null);

    if (!resolvedSteps) {
      throw new Error('Invalid response structure from AI - missing steps array');
    }

    if (!steps && resolvedSteps === fallbackSteps) {
      logger.warn('[WorkflowAI] Missing steps array; using current workflow steps');
    }

    return {
      workflow_name,
      workflow_description,
      steps: resolvedSteps,
      changes_summary,
    };
  }

  private collectResponseCandidates(parsedResponse: any): any[] {
    const candidates: any[] = [parsedResponse];
    if (!parsedResponse || typeof parsedResponse !== 'object') {
      return candidates;
    }

    const nestedKeys = [
      'workflow',
      'updated_workflow',
      'workflow_config',
      'workflowConfig',
      'result',
      'data',
      'payload',
    ];

    nestedKeys.forEach((key) => {
      const value = (parsedResponse as any)[key];
      if (value && typeof value === 'object') {
        candidates.push(value);
      }
    });

    return candidates;
  }

  private extractStepsFromCandidates(candidates: any[]): WorkflowStep[] | null {
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate as WorkflowStep[];
      }
      if (!candidate || typeof candidate !== 'object') {
        continue;
      }

      const arrays = [
        candidate.steps,
        candidate.workflow_steps,
        candidate.updated_steps,
        candidate.current_steps,
      ];

      for (const arr of arrays) {
        if (Array.isArray(arr)) {
          return arr as WorkflowStep[];
        }
      }
    }

    return null;
  }

  private extractWorkflowMeta(candidates: any[]): {
    workflow_name?: string;
    workflow_description?: string;
  } {
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object') {
        continue;
      }
      const workflowName =
        typeof candidate.workflow_name === 'string'
          ? candidate.workflow_name.trim()
          : '';
      const workflowDescription =
        typeof candidate.workflow_description === 'string'
          ? candidate.workflow_description.trim()
          : '';
      if (workflowName || workflowDescription) {
        return {
          workflow_name: workflowName || undefined,
          workflow_description: workflowDescription || undefined,
        };
      }
    }

    return {};
  }

  private extractChangesSummary(candidates: any[]): string {
    const summaryKeys = [
      'changes_summary',
      'change_summary',
      'summary',
      'changes',
      'message',
    ];

    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object') {
        continue;
      }
      for (const key of summaryKeys) {
        const value = (candidate as any)[key];
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }
    }

    return 'Updated workflow configuration based on the request.';
  }
}
