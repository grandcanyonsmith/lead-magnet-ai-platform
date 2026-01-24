import OpenAI from 'openai';
import { WORKFLOW_STEP_SYSTEM_PROMPT } from '@config/prompts';
import {
  getPromptOverridesForTenant,
  resolvePromptOverride,
  type PromptOverrides,
} from '@services/promptOverrides';
import { stripMarkdownCodeFences } from '@utils/openaiHelpers';
import { parseJsonFromText } from '@utils/jsonParsing';
import { ToolChoice } from '@utils/types';
import { WorkflowStep } from './workflow/workflowConfigSupport';
import { AVAILABLE_MODELS } from './workflow/modelDescriptions';

export interface AIStepGenerationRequest {
  userPrompt: string;
  action?: 'update' | 'add';
  defaultToolChoice?: ToolChoice;
  defaultServiceTier?: string;
  defaultTextVerbosity?: string;
  tenantId?: string;
  promptOverrides?: PromptOverrides;
  workflowContext: {
    workflow_id: string;
    workflow_name: string;
    workflow_description: string;
    current_steps: Array<{
      step_name: string;
      step_description?: string;
      model: string;
      tools?: any[];
      depends_on?: number[];
      step_order?: number;
    }>;
  };
  currentStep?: WorkflowStep;
  currentStepIndex?: number;
}

export interface AIStepGenerationResponse {
  action: 'update' | 'add';
  step_index?: number;
  step: WorkflowStep;
}

type WorkflowStepAIStreamHandlers = {
  onDelta?: (text: string) => void;
  onEvent?: (event: any) => void;
};

const AVAILABLE_TOOLS = [
  'web_search',
  'code_interpreter',
  'computer_use_preview',
  'image_generation',
  'shell',
];

const DEFAULT_MODEL = 'gpt-5.2';
const DEFAULT_REASONING_EFFORT = 'high';
const DEFAULT_SERVICE_TIER = 'priority';
const DEFAULT_TOOL_CHOICE: ToolChoice = 'required';
const VALID_TOOL_CHOICES = new Set<ToolChoice>(['auto', 'required', 'none']);
const VALID_SERVICE_TIERS = new Set(['auto', 'default', 'flex', 'scale', 'priority']);
const VALID_TEXT_VERBOSITIES = new Set(['low', 'medium', 'high']);
const VALID_REASONING_EFFORTS = new Set(['none', 'low', 'medium', 'high', 'xhigh']);

type StepGenerationContext = {
  userPrompt: string;
  workflowContext: AIStepGenerationRequest['workflowContext'];
  currentStep?: WorkflowStep;
  currentStepIndex?: number;
  suggestedAction: 'update' | 'add';
  resolvedDefaultToolChoice: ToolChoice;
  resolvedDefaultServiceTier?: string;
  resolvedDefaultTextVerbosity?: string;
  shouldOverrideServiceTier: boolean;
  resolved: ReturnType<typeof resolvePromptOverride>;
};

const resolveDefaultToolChoice = (defaultToolChoice?: ToolChoice): ToolChoice =>
  VALID_TOOL_CHOICES.has(defaultToolChoice as ToolChoice)
    ? (defaultToolChoice as ToolChoice)
    : DEFAULT_TOOL_CHOICE;

const resolveDefaultServiceTier = (
  defaultServiceTier?: string,
): string | undefined =>
  defaultServiceTier && VALID_SERVICE_TIERS.has(defaultServiceTier)
    ? defaultServiceTier
    : undefined;

const resolveDefaultTextVerbosity = (
  defaultTextVerbosity?: string,
): string | undefined =>
  defaultTextVerbosity && VALID_TEXT_VERBOSITIES.has(defaultTextVerbosity)
    ? defaultTextVerbosity
    : undefined;

const buildStepSummary = (
  step: AIStepGenerationRequest['workflowContext']['current_steps'][number],
  index: number,
) => {
  const tools =
    step.tools && step.tools.length > 0
      ? ` [Tools: ${step.tools
          .map((tool) => (typeof tool === 'string' ? tool : tool.type))
          .join(', ')}]`
      : '';
  const dependsOn = Array.isArray(step.depends_on)
    ? ` [depends_on: ${
        step.depends_on.length > 0 ? step.depends_on.join(', ') : '[]'
      }]`
    : ' [depends_on: []]';
  const orderSuffix =
    typeof step.step_order === 'number' && step.step_order !== index
      ? ` [order: ${step.step_order}]`
      : '';
  const descriptionSuffix = step.step_description
    ? ` - ${step.step_description}`
    : '';

  return `Index ${index} (Step ${index + 1}): ${step.step_name} (${step.model})${tools}${dependsOn}${orderSuffix}${descriptionSuffix}`;
};

const buildContextMessage = (
  workflowContext: AIStepGenerationRequest['workflowContext'],
  currentStep?: WorkflowStep,
  currentStepIndex?: number,
) => {
  const contextParts: string[] = [
    `Workflow: ${workflowContext.workflow_name}`,
    `Description: ${workflowContext.workflow_description}`,
    '',
    'Current Steps:',
  ];

  if (workflowContext.current_steps.length === 0) {
    contextParts.push('(No steps yet)');
  } else {
    workflowContext.current_steps.forEach((step, index) => {
      contextParts.push(buildStepSummary(step, index));
    });
  }

  if (currentStep && currentStepIndex !== undefined) {
    contextParts.push('');
    contextParts.push(`Editing Step ${currentStepIndex + 1}:`);
    contextParts.push(JSON.stringify(currentStep, null, 2));
    contextParts.push('');
    contextParts.push(
      'IMPORTANT: depends_on uses 0-based indices matching the "Current Steps" list.',
    );
    contextParts.push(
      'If you are not changing dependencies, return the existing depends_on array unchanged.',
    );
  }

  return contextParts.join('\n');
};

const buildUserMessage = (
  contextMessage: string,
  userPrompt: string,
  suggestedAction: 'update' | 'add',
) => `${contextMessage}

User Request: ${userPrompt}

Suggested Action: ${suggestedAction}

Please generate the workflow step configuration.`;

const parseResponseJson = (
  responseContent: string,
): AIStepGenerationResponse => {
  const parsed = parseJsonFromText<AIStepGenerationResponse>(responseContent, {
    preferLast: true,
  });

  if (!parsed) {
    throw new Error('Invalid response from OpenAI (expected JSON object)');
  }

  return parsed;
};

const getToolName = (tool: any): string | undefined =>
  typeof tool === 'string' ? tool : tool?.type;

const normalizeToolName = (toolName?: string): string | undefined =>
  toolName === 'web_search_preview' ? 'web_search' : toolName;

const sanitizeTools = (tools: any[]): any[] =>
  tools
    .filter((tool) => {
      const normalizedTool = normalizeToolName(getToolName(tool));
      return normalizedTool ? AVAILABLE_TOOLS.includes(normalizedTool) : false;
    })
    .map((tool) => {
      if (typeof tool === 'string') {
        return normalizeToolName(tool);
      }
      if (typeof tool === 'object' && tool?.type === 'web_search_preview') {
        return { ...tool, type: 'web_search' };
      }
      return tool;
    });

const normalizeDependsOn = (
  deps: any,
  maxIndex: number,
  selfIndex?: number,
): number[] | null => {
  if (deps === undefined || deps === null) return null;
  if (!Array.isArray(deps)) return null;
  const filtered = deps.filter(
    (dep) =>
      Number.isInteger(dep) &&
      dep >= 0 &&
      dep < maxIndex &&
      dep !== selfIndex,
  );
  return Array.from(new Set(filtered));
};

export const buildStepSystemPrompt = (
  defaultToolChoice: ToolChoice,
  defaultServiceTier?: string,
  defaultTextVerbosity?: string,
) => {
  return WORKFLOW_STEP_SYSTEM_PROMPT
    .replace('{{defaultToolChoice}}', defaultToolChoice)
    .replace('{{defaultServiceTier}}', defaultServiceTier || 'auto')
    .replace(
      '{{defaultTextVerbosity}}',
      defaultTextVerbosity || 'model default',
    );
};

export class WorkflowStepAIService {
  constructor(private openaiClient: OpenAI) {}

  private async buildGenerationContext(
    request: AIStepGenerationRequest,
  ): Promise<StepGenerationContext> {
    const {
      userPrompt,
      action,
      workflowContext,
      currentStep,
      currentStepIndex,
      defaultToolChoice,
      defaultServiceTier,
      defaultTextVerbosity,
      tenantId,
      promptOverrides,
    } = request;
    const resolvedDefaultToolChoice = resolveDefaultToolChoice(defaultToolChoice);
    const resolvedDefaultServiceTier =
      resolveDefaultServiceTier(defaultServiceTier);
    const shouldOverrideServiceTier =
      resolvedDefaultServiceTier !== undefined &&
      resolvedDefaultServiceTier !== 'auto';
    const resolvedDefaultTextVerbosity =
      resolveDefaultTextVerbosity(defaultTextVerbosity);

    const contextMessage = buildContextMessage(
      workflowContext,
      currentStep,
      currentStepIndex,
    );

    const suggestedAction = action || (currentStep ? 'update' : 'add');

    const userMessage = buildUserMessage(
      contextMessage,
      userPrompt,
      suggestedAction,
    );

    const overrides =
      promptOverrides ?? (tenantId ? await getPromptOverridesForTenant(tenantId) : undefined);
    const resolved = resolvePromptOverride({
      key: 'workflow_step_generation',
      defaults: {
        instructions: buildStepSystemPrompt(
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
        suggested_action: suggestedAction,
        current_step_json: currentStep ? JSON.stringify(currentStep, null, 2) : '',
        current_step_index:
          currentStepIndex !== undefined ? String(currentStepIndex) : undefined,
        default_tool_choice: resolvedDefaultToolChoice,
        default_service_tier: resolvedDefaultServiceTier,
        default_text_verbosity: resolvedDefaultTextVerbosity,
      },
    });

    return {
      userPrompt,
      workflowContext,
      currentStep,
      currentStepIndex,
      suggestedAction,
      resolvedDefaultToolChoice,
      resolvedDefaultServiceTier,
      resolvedDefaultTextVerbosity,
      shouldOverrideServiceTier,
      resolved,
    };
  }

  private parseStepResponse(
    responseContent: string,
    context: StepGenerationContext,
  ): AIStepGenerationResponse {
    const {
      suggestedAction,
      currentStep,
      currentStepIndex,
      resolvedDefaultToolChoice,
      resolvedDefaultServiceTier,
      resolvedDefaultTextVerbosity,
      shouldOverrideServiceTier,
      workflowContext,
    } = context;

    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    const parsedResponse = parseResponseJson(responseContent);

    // Validate the response
    if (!parsedResponse.step || !parsedResponse.step.step_name || !parsedResponse.step.instructions) {
      throw new Error('Invalid response structure from AI');
    }

    // Validate model
    if (!parsedResponse.step.model) {
      parsedResponse.step.model = DEFAULT_MODEL;
    } else if (!AVAILABLE_MODELS.includes(parsedResponse.step.model)) {
      console.warn(
        `[WorkflowStepAI] Model ${parsedResponse.step.model} not in curated list; using as-is`,
      );
    }

    // Validate and sanitize tools
    if (parsedResponse.step.tools) {
      parsedResponse.step.tools = sanitizeTools(
        parsedResponse.step.tools as any[],
      );
    }

    // Validate tool_choice
    const hasTools =
      Array.isArray(parsedResponse.step.tools) && parsedResponse.step.tools.length > 0;
    if (!VALID_TOOL_CHOICES.has(parsedResponse.step.tool_choice as ToolChoice)) {
      parsedResponse.step.tool_choice = hasTools ? resolvedDefaultToolChoice : 'none';
    }

    // Validate service_tier (optional)
    if (
      (parsedResponse.step as any).service_tier &&
      !VALID_SERVICE_TIERS.has((parsedResponse.step as any).service_tier)
    ) {
      delete (parsedResponse.step as any).service_tier;
    }

    if (shouldOverrideServiceTier) {
      (parsedResponse.step as any).service_tier = resolvedDefaultServiceTier;
    }

    // Validate reasoning_effort
    if (
      !VALID_REASONING_EFFORTS.has(
        parsedResponse.step.reasoning_effort || '',
      )
    ) {
      parsedResponse.step.reasoning_effort = DEFAULT_REASONING_EFFORT;
    }

    const actionToApply = parsedResponse.action || suggestedAction;

    // Validate text_verbosity (optional)
    if (
      parsedResponse.step.text_verbosity &&
      !VALID_TEXT_VERBOSITIES.has(parsedResponse.step.text_verbosity)
    ) {
      delete (parsedResponse.step as any).text_verbosity;
    }
    const shouldApplyDefaultTextVerbosity =
      resolvedDefaultTextVerbosity !== undefined &&
      (actionToApply === 'add' || !currentStep?.text_verbosity);
    if (shouldApplyDefaultTextVerbosity) {
      parsedResponse.step.text_verbosity = resolvedDefaultTextVerbosity as any;
    } else if (!parsedResponse.step.text_verbosity && currentStep?.text_verbosity) {
      parsedResponse.step.text_verbosity = currentStep.text_verbosity as any;
    }

    // Validate max_output_tokens (optional)
    if (
      (parsedResponse.step as any).max_output_tokens !== undefined &&
      (typeof (parsedResponse.step as any).max_output_tokens !== 'number' ||
        !Number.isFinite((parsedResponse.step as any).max_output_tokens) ||
        (parsedResponse.step as any).max_output_tokens < 1)
    ) {
      delete (parsedResponse.step as any).max_output_tokens;
    }

    // Set action
    parsedResponse.action = actionToApply;

    // Set step_index for updates
    if (parsedResponse.action === 'update' && currentStepIndex !== undefined) {
      parsedResponse.step_index = currentStepIndex;
    }

    const normalizedDependsOn = normalizeDependsOn(
      parsedResponse.step.depends_on,
      workflowContext.current_steps.length,
      parsedResponse.action === 'update' ? currentStepIndex : undefined,
    );

    if (normalizedDependsOn !== null) {
      parsedResponse.step.depends_on = normalizedDependsOn;
    }

    // CRITICAL: Preserve existing dependencies if AI didn't return them
    // This ensures we don't accidentally delete dependency relationships
    if (parsedResponse.action === 'update' && currentStep) {
      if (normalizedDependsOn === null) {
        parsedResponse.step.depends_on = currentStep.depends_on || [];
        console.log('[WorkflowStepAI] Preserved existing dependencies', {
          depends_on: parsedResponse.step.depends_on,
        });
      }

      // Also preserve step_order if not provided
      if (parsedResponse.step.step_order === undefined) {
        parsedResponse.step.step_order = currentStep.step_order;
      }
    }

    console.log('[WorkflowStepAI] Step generated successfully', {
      action: parsedResponse.action,
      stepName: parsedResponse.step.step_name,
      model: parsedResponse.step.model,
      tools: parsedResponse.step.tools,
      depends_on: parsedResponse.step.depends_on,
    });

    return parsedResponse;
  }

  private buildResponsesRequest(
    context: StepGenerationContext,
    stream = false,
  ) {
    return {
      model: context.resolved.model || DEFAULT_MODEL,
      instructions: context.resolved.instructions,
      input: context.resolved.prompt,
      reasoning: {
        effort: context.resolved.reasoning_effort || DEFAULT_REASONING_EFFORT,
      },
      service_tier: context.resolved.service_tier || DEFAULT_SERVICE_TIER,
      ...(stream ? { stream: true } : {}),
    };
  }

  async generateStep(request: AIStepGenerationRequest): Promise<AIStepGenerationResponse> {
    const context = await this.buildGenerationContext(request);

    console.log('[WorkflowStepAI] Generating step', {
      workflow: context.workflowContext.workflow_name,
      userPrompt: context.userPrompt.substring(0, 100),
      action: context.suggestedAction,
    });

    try {
      const completion = await (this.openaiClient as any).responses.create(
        this.buildResponsesRequest(context),
      );

      const responseContent = stripMarkdownCodeFences(
        String((completion as any)?.output_text || ''),
      ).trim();

      return this.parseStepResponse(responseContent, context);
    } catch (error: any) {
      console.error('[WorkflowStepAI] Error generating step', {
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to generate step: ${error.message}`);
    }
  }

  async streamGenerateStep(
    request: AIStepGenerationRequest,
    handlers?: WorkflowStepAIStreamHandlers,
  ): Promise<AIStepGenerationResponse> {
    const context = await this.buildGenerationContext(request);

    console.log('[WorkflowStepAI] Streaming step generation', {
      workflow: context.workflowContext.workflow_name,
      userPrompt: context.userPrompt.substring(0, 100),
      action: context.suggestedAction,
    });

    try {
      const stream = await (this.openaiClient as any).responses.create(
        this.buildResponsesRequest(context, true),
      );

      let outputText = '';
      for await (const event of stream as any) {
        handlers?.onEvent?.(event);
        const eventType = String((event as any)?.type || '');
        if (!eventType.includes('output_text')) {
          continue;
        }
        const delta =
          typeof (event as any)?.delta === 'string'
            ? (event as any).delta
            : typeof (event as any)?.text === 'string'
              ? (event as any).text
              : undefined;
        if (!delta) {
          continue;
        }
        outputText += delta;
        handlers?.onDelta?.(delta);
      }

      const responseContent = stripMarkdownCodeFences(outputText).trim();
      return this.parseStepResponse(responseContent, context);
    } catch (error: any) {
      console.error('[WorkflowStepAI] Error streaming step generation', {
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to generate step: ${error.message}`);
    }
  }
}
