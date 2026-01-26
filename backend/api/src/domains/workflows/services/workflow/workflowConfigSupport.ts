import { logger } from '@utils/logger';
import { ValidationError } from '@utils/errors';
import { isArray, isString, validateWorkflowSteps as baseValidateWorkflowSteps } from '@utils/validators';
import { WorkflowStep, ToolConfig, ToolChoice } from '@utils/types';

export interface ParsedWorkflowConfig {
  workflow_name: string;
  workflow_description: string;
  steps: WorkflowStep[];
}

interface WorkflowDefaults {
  defaultToolChoice?: ToolChoice;
  defaultServiceTier?: string;
  defaultTextVerbosity?: string;
}

interface RawStep {
  step_name?: string;
  step_description?: string;
  model?: string;
  reasoning_effort?: string;
  service_tier?: string;
  text_verbosity?: string;
  max_output_tokens?: number;
  output_format?: unknown;
  is_deliverable?: boolean;
  instructions?: string;
  step_order?: number;
  depends_on?: number[];
  tools?: string[] | unknown[];
  tool_choice?: string;
  shell_settings?: {
    max_iterations?: number;
    max_duration_seconds?: number;
    command_timeout_ms?: number;
    command_max_output_length?: number;
  };
  [key: string]: unknown;
}

interface RawWorkflowData {
  workflow_name?: string;
  workflow_description?: string;
  steps?: RawStep[];
  [key: string]: unknown;
}

const DEFAULT_TOOL_CHOICE: ToolChoice = 'required';
const VALID_SERVICE_TIERS = new Set(['auto', 'default', 'flex', 'scale', 'priority']);
const VALID_TEXT_VERBOSITIES = new Set(['low', 'medium', 'high']);

function resolveDefaultToolChoice(defaultToolChoice?: ToolChoice): ToolChoice {
  return defaultToolChoice === 'auto' || defaultToolChoice === 'required' || defaultToolChoice === 'none'
    ? defaultToolChoice
    : DEFAULT_TOOL_CHOICE;
}

function resolveDefaultServiceTier(
  defaultServiceTier?: string,
): WorkflowStep["service_tier"] | undefined {
  if (!defaultServiceTier || !VALID_SERVICE_TIERS.has(defaultServiceTier)) {
    return undefined;
  }
  return defaultServiceTier === "auto"
    ? undefined
    : (defaultServiceTier as WorkflowStep["service_tier"]);
}

function resolveDefaultTextVerbosity(
  defaultTextVerbosity?: string,
): WorkflowStep["text_verbosity"] | undefined {
  if (!defaultTextVerbosity || !VALID_TEXT_VERBOSITIES.has(defaultTextVerbosity)) {
    return undefined;
  }
  return defaultTextVerbosity as WorkflowStep["text_verbosity"];
}

function normalizeShellSettings(
  value: unknown,
): WorkflowStep["shell_settings"] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const normalizeInt = (input: unknown, min: number, max: number): number | undefined => {
    if (typeof input !== "number" || !Number.isFinite(input)) return undefined;
    const coerced = Math.floor(input);
    if (coerced < min || coerced > max) return undefined;
    return coerced;
  };

  const settings: WorkflowStep["shell_settings"] = {};
  const maxIterations = normalizeInt(raw.max_iterations, 1, 100);
  if (maxIterations !== undefined) settings.max_iterations = maxIterations;
  const maxDuration = normalizeInt(raw.max_duration_seconds, 30, 840);
  if (maxDuration !== undefined) settings.max_duration_seconds = maxDuration;
  const commandTimeout = normalizeInt(raw.command_timeout_ms, 1000, 900000);
  if (commandTimeout !== undefined) settings.command_timeout_ms = commandTimeout;
  const commandMaxOutput = normalizeInt(raw.command_max_output_length, 256, 10_000_000);
  if (commandMaxOutput !== undefined) settings.command_max_output_length = commandMaxOutput;

  return Object.keys(settings).length > 0 ? settings : undefined;
}

export function parseWorkflowConfig(
  content: string,
  description: string,
  defaults?: WorkflowDefaults,
): ParsedWorkflowConfig {
  if (!isString(content) || content.trim().length === 0) {
    logger.warn('[Workflow Config Parser] Empty content provided, using defaults');
    return getDefaultConfig(description, defaults);
  }

  if (!isString(description)) {
    description = 'Generated Lead Magnet';
  }

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('[Workflow Config Parser] No JSON found in response, using defaults');
      return getDefaultConfig(description);
    }

    const parsed = JSON.parse(jsonMatch[0]) as RawWorkflowData;

    if (parsed.steps && isArray(parsed.steps) && parsed.steps.length > 0) {
      return {
        workflow_name: isString(parsed.workflow_name) ? parsed.workflow_name : 'Generated Lead Magnet',
        workflow_description: isString(parsed.workflow_description) ? parsed.workflow_description : description,
        steps: parsed.steps.map((step: RawStep, index: number) => normalizeStep(step, index, defaults)),
      };
    }

    const defaultConfig = getDefaultConfig(description, defaults);
    return {
      ...defaultConfig,
      workflow_name: isString(parsed.workflow_name) ? parsed.workflow_name : defaultConfig.workflow_name,
      workflow_description: isString(parsed.workflow_description) ? parsed.workflow_description : defaultConfig.workflow_description,
    };
  } catch (error) {
    logger.warn('[Workflow Config Parser] Failed to parse workflow JSON, using defaults', {
      error: error instanceof Error ? error.message : String(error),
    });
    return getDefaultConfig(description, defaults);
  }
}

function getDefaultConfig(description: string, defaults?: WorkflowDefaults): ParsedWorkflowConfig {
  const resolvedDefaultToolChoice = resolveDefaultToolChoice(defaults?.defaultToolChoice);
  const resolvedDefaultServiceTier = resolveDefaultServiceTier(defaults?.defaultServiceTier);
  const resolvedDefaultTextVerbosity = resolveDefaultTextVerbosity(defaults?.defaultTextVerbosity);

  return {
    workflow_name: 'Generated Lead Magnet',
    workflow_description: description,
    steps: [
      {
        step_name: 'Deep Research',
        step_description: 'Generate comprehensive research report',
        model: 'gpt-5.2',
        instructions: 'Generate a personalized report based on form submission data. Use [field_name] to reference form fields.',
        step_order: 0,
        depends_on: [],
        tools: ['web_search'],
        tool_choice: resolvedDefaultToolChoice,
        service_tier: resolvedDefaultServiceTier,
        text_verbosity: resolvedDefaultTextVerbosity,
      },
      {
        step_name: 'HTML Rewrite',
        step_description: 'Rewrite content into styled HTML matching template',
        model: 'gpt-5.2',
        instructions: "Rewrite the research content into styled HTML matching the provided template. Ensure the output is complete, valid HTML that matches the template's design and structure.",
        step_order: 1,
        depends_on: [0],
        tools: [],
        tool_choice: 'none',
        service_tier: resolvedDefaultServiceTier,
        text_verbosity: resolvedDefaultTextVerbosity,
      },
    ],
  };
}

function normalizeStep(step: RawStep, index: number, defaults?: WorkflowDefaults): WorkflowStep {
  const model = isString(step.model) && step.model.trim().length > 0 ? step.model : 'gpt-5.2';
  const shouldAddDefaultWebSearch = index === 0 && model !== 'o4-mini-deep-research';

  const reasoning_effort =
    isString(step.reasoning_effort) &&
    ['none', 'low', 'medium', 'high', 'xhigh'].includes(step.reasoning_effort)
      ? (step.reasoning_effort as any)
      : undefined;

  const resolvedDefaultServiceTier = resolveDefaultServiceTier(defaults?.defaultServiceTier);
  const normalizedServiceTier =
    isString(step.service_tier) && VALID_SERVICE_TIERS.has(step.service_tier)
      ? (step.service_tier as WorkflowStep["service_tier"])
      : undefined;
  const service_tier = normalizedServiceTier ?? resolvedDefaultServiceTier;

  const resolvedDefaultTextVerbosity = resolveDefaultTextVerbosity(defaults?.defaultTextVerbosity);
  const text_verbosity =
    isString(step.text_verbosity) &&
    ['low', 'medium', 'high'].includes(step.text_verbosity)
      ? (step.text_verbosity as any)
      : resolvedDefaultTextVerbosity;

  const max_output_tokens =
    typeof step.max_output_tokens === 'number' &&
    Number.isFinite(step.max_output_tokens) &&
    step.max_output_tokens >= 1
      ? Math.floor(step.max_output_tokens)
      : undefined;

  const shell_settings = normalizeShellSettings(step.shell_settings);

  const tools: (string | ToolConfig)[] = isArray(step.tools)
    ? (step.tools as unknown[]).filter((t): t is string | ToolConfig => typeof t === 'string' || (typeof t === 'object' && t !== null && 'type' in t))
    : shouldAddDefaultWebSearch
      ? ['web_search']
      : [];

  const resolvedDefaultToolChoice = resolveDefaultToolChoice(defaults?.defaultToolChoice);
  const hasTools = tools.length > 0;
  const toolChoice =
    step.tool_choice === 'auto' || step.tool_choice === 'required' || step.tool_choice === 'none'
      ? step.tool_choice
      : hasTools
        ? resolvedDefaultToolChoice
        : 'none';

  // Structured Outputs / output format (Responses API text.format)
  let output_format: any = undefined;
  if (step.output_format && typeof step.output_format === 'object' && step.output_format !== null) {
    const t = (step.output_format as any).type;
    if (t === 'text') {
      output_format = { type: 'text' };
    } else if (t === 'json_object') {
      output_format = { type: 'json_object' };
    } else if (t === 'json_schema') {
      const name = (step.output_format as any).name;
      const schema = (step.output_format as any).schema;
      const description = (step.output_format as any).description;
      const strict = (step.output_format as any).strict;
      if (isString(name) && name.trim().length > 0 && typeof schema === 'object' && schema !== null) {
        output_format = {
          type: 'json_schema',
          name,
          schema,
          ...(isString(description) ? { description } : {}),
          ...(typeof strict === 'boolean' ? { strict } : {}),
        };
      }
    }
  }

  const is_deliverable =
    typeof step.is_deliverable === "boolean" ? step.is_deliverable : undefined;

  return {
    step_name: isString(step.step_name) && step.step_name.trim().length > 0 ? step.step_name : `Step ${index + 1}`,
    step_description: isString(step.step_description) ? step.step_description : '',
    model,
    reasoning_effort,
    service_tier,
    text_verbosity,
    max_output_tokens,
    output_format,
    is_deliverable,
    shell_settings,
    instructions: isString(step.instructions) && step.instructions.trim().length > 0 ? step.instructions : 'Generate content based on form submission data.',
    step_order: typeof step.step_order === 'number' && step.step_order >= 0 ? step.step_order : index,
    depends_on: isArray(step.depends_on) ? step.depends_on.filter((d): d is number => typeof d === 'number' && d >= 0 && d < 1000) : [],
    tools: tools.length > 0 ? tools : undefined,
    tool_choice: toolChoice,
  };
}

export function ensureStepDefaults(
  steps: WorkflowStep[],
  defaults?: WorkflowDefaults,
): WorkflowStep[] {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new ValidationError('Steps must be a non-empty array');
  }

  return ensureStepDefaultsWithOptions(steps, defaults);
}

function ensureStepDefaultsWithOptions(
  steps: WorkflowStep[],
  defaults?: WorkflowDefaults,
): WorkflowStep[] {
  const resolvedDefaultToolChoice = resolveDefaultToolChoice(defaults?.defaultToolChoice);
  const resolvedDefaultServiceTier = resolveDefaultServiceTier(defaults?.defaultServiceTier);
  const resolvedDefaultTextVerbosity = resolveDefaultTextVerbosity(defaults?.defaultTextVerbosity);

  return steps.map((step: Partial<WorkflowStep>, index: number) => {
    const stepOrder = step.step_order !== undefined ? step.step_order : index;

    let dependsOn = step.depends_on;
    let shouldAutoGenerate = false;

    if (dependsOn !== undefined && dependsOn !== null) {
      if (Array.isArray(dependsOn)) {
        const validDeps = dependsOn.filter(
          (depIndex: number) => typeof depIndex === 'number' && depIndex >= 0 && depIndex < steps.length && depIndex !== index
        );

        if (validDeps.length === 0 && stepOrder > 0) {
          shouldAutoGenerate = true;
        } else {
          dependsOn = validDeps;
        }
      } else {
        shouldAutoGenerate = true;
      }
    } else {
      shouldAutoGenerate = true;
    }

    if (shouldAutoGenerate) {
      if (stepOrder === 0) {
        dependsOn = [];
      } else {
        const lowerOrderSteps = steps
          .map((s: Partial<WorkflowStep>, i: number) => ({
            step: s,
            index: i,
            order: s.step_order !== undefined ? s.step_order : i,
          }))
          .filter(({ order }) => order < stepOrder)
          .map(({ index: depIndex }) => depIndex)
          .filter((depIndex: number) => depIndex >= 0 && depIndex < steps.length && depIndex !== index);

        if (lowerOrderSteps.length > 0) {
          dependsOn = lowerOrderSteps;
        } else if (index > 0) {
          dependsOn = [index - 1];
        } else {
          dependsOn = [];
        }
      }
    }

    const model = step.model || 'gpt-4';
    const shouldAddDefaultWebSearch = index === 0 && model !== 'o4-mini-deep-research';
    const defaultTools = shouldAddDefaultWebSearch ? ['web_search'] : [];
    const resolvedTools = Array.isArray(step.tools) ? step.tools : defaultTools;
    const hasTools = resolvedTools.length > 0;
    const validToolChoice =
      step.tool_choice === 'auto' || step.tool_choice === 'required' || step.tool_choice === 'none'
        ? step.tool_choice
        : undefined;

    const normalizedServiceTier =
      step.service_tier && VALID_SERVICE_TIERS.has(String(step.service_tier))
        ? (step.service_tier as WorkflowStep["service_tier"])
        : undefined;
    const normalizedTextVerbosity =
      isString(step.text_verbosity) && VALID_TEXT_VERBOSITIES.has(step.text_verbosity)
        ? (step.text_verbosity as WorkflowStep["text_verbosity"])
        : undefined;

    const shell_settings = normalizeShellSettings(step.shell_settings);

    return {
      ...step,
      step_name: step.step_name || `Step ${index + 1}`,
      step_order: stepOrder,
      step_description: step.step_description || step.step_name || `Step ${index + 1}`,
      depends_on: dependsOn,
      tools: resolvedTools,
      tool_choice: (validToolChoice || (hasTools ? resolvedDefaultToolChoice : 'none')) as ToolChoice,
      service_tier: normalizedServiceTier ?? resolvedDefaultServiceTier,
      text_verbosity: normalizedTextVerbosity ?? resolvedDefaultTextVerbosity,
      shell_settings,
      model,
      instructions: step.instructions || '',
    } as WorkflowStep;
  });
}

export const workflowConfigSupport = {
  parseWorkflowConfig,
  ensureStepDefaults,
};

export type WorkflowConfigSupport = typeof workflowConfigSupport;
export type { WorkflowStep };
export const validateWorkflowSteps = baseValidateWorkflowSteps;
