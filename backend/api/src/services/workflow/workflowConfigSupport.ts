import { logger } from '../../utils/logger';
import { ValidationError } from '../../utils/errors';
import { isArray, isString, validateWorkflowSteps as baseValidateWorkflowSteps } from '../../utils/validators';
import { WorkflowStep, ToolConfig, LegacyWorkflowData } from '../../utils/types';

export interface ParsedWorkflowConfig {
  workflow_name: string;
  workflow_description: string;
  steps: WorkflowStep[];
}

interface RawStep {
  step_name?: string;
  step_description?: string;
  model?: string;
  instructions?: string;
  step_order?: number;
  depends_on?: number[];
  tools?: string[] | unknown[];
  tool_choice?: string;
  [key: string]: unknown;
}

interface RawWorkflowData {
  workflow_name?: string;
  workflow_description?: string;
  steps?: RawStep[];
  research_instructions?: string;
  [key: string]: unknown;
}

export function parseWorkflowConfig(content: string, description: string): ParsedWorkflowConfig {
  if (!isString(content) || content.trim().length === 0) {
    logger.warn('[Workflow Config Parser] Empty content provided, using defaults');
    return getDefaultConfig(description);
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
        steps: parsed.steps.map((step: RawStep, index: number) => normalizeStep(step, index)),
      };
    }

    if (isString(parsed.research_instructions)) {
      return {
        workflow_name: isString(parsed.workflow_name) ? parsed.workflow_name : 'Generated Lead Magnet',
        workflow_description: isString(parsed.workflow_description) ? parsed.workflow_description : description,
        steps: createLegacySteps(parsed.research_instructions),
      };
    }

    const defaultConfig = getDefaultConfig(description);
    return {
      ...defaultConfig,
      workflow_name: isString(parsed.workflow_name) ? parsed.workflow_name : defaultConfig.workflow_name,
      workflow_description: isString(parsed.workflow_description) ? parsed.workflow_description : defaultConfig.workflow_description,
    };
  } catch (error) {
    logger.warn('[Workflow Config Parser] Failed to parse workflow JSON, using defaults', {
      error: error instanceof Error ? error.message : String(error),
    });
    return getDefaultConfig(description);
  }
}

function getDefaultConfig(description: string): ParsedWorkflowConfig {
  return {
    workflow_name: 'Generated Lead Magnet',
    workflow_description: description,
    steps: [
      {
        step_name: 'Deep Research',
        step_description: 'Generate comprehensive research report',
        model: 'gpt-5',
        instructions: 'Generate a personalized report based on form submission data. Use [field_name] to reference form fields.',
        step_order: 0,
        depends_on: [],
        tools: ['web_search'],
        tool_choice: 'auto',
      },
      {
        step_name: 'HTML Rewrite',
        step_description: 'Rewrite content into styled HTML matching template',
        model: 'gpt-5',
        instructions: "Rewrite the research content into styled HTML matching the provided template. Ensure the output is complete, valid HTML that matches the template's design and structure.",
        step_order: 1,
        depends_on: [0],
        tools: [],
        tool_choice: 'none',
      },
    ],
  };
}

function normalizeStep(step: RawStep, index: number): WorkflowStep {
  const model = isString(step.model) && step.model.trim().length > 0 ? step.model : 'gpt-5';
  const shouldAddDefaultWebSearch = index === 0 && model !== 'o4-mini-deep-research';

  const tools: (string | ToolConfig)[] = isArray(step.tools)
    ? (step.tools as unknown[]).filter((t): t is string | ToolConfig => typeof t === 'string' || (typeof t === 'object' && t !== null && 'type' in t))
    : shouldAddDefaultWebSearch
      ? ['web_search']
      : [];

  const toolChoice =
    step.tool_choice === 'auto' || step.tool_choice === 'required' || step.tool_choice === 'none'
      ? step.tool_choice
      : index === 0
        ? 'auto'
        : 'none';

  return {
    step_name: isString(step.step_name) && step.step_name.trim().length > 0 ? step.step_name : `Step ${index + 1}`,
    step_description: isString(step.step_description) ? step.step_description : '',
    model,
    instructions: isString(step.instructions) && step.instructions.trim().length > 0 ? step.instructions : 'Generate content based on form submission data.',
    step_order: typeof step.step_order === 'number' && step.step_order >= 0 ? step.step_order : index,
    depends_on: isArray(step.depends_on) ? step.depends_on.filter((d): d is number => typeof d === 'number' && d >= 0 && d < 1000) : [],
    tools: tools.length > 0 ? tools : undefined,
    tool_choice: toolChoice,
  };
}

function createLegacySteps(researchInstructions: string): WorkflowStep[] {
  return [
    {
      step_name: 'Deep Research',
      step_description: 'Generate comprehensive research report',
      model: 'gpt-5',
      instructions: researchInstructions,
      step_order: 0,
      depends_on: [],
      tools: ['web_search'],
      tool_choice: 'auto',
    },
    {
      step_name: 'HTML Rewrite',
      step_description: 'Rewrite content into styled HTML matching template',
      model: 'gpt-5',
      instructions: "Rewrite the research content into styled HTML matching the provided template. Ensure the output is complete, valid HTML that matches the template's design and structure.",
      step_order: 1,
      depends_on: [0],
      tools: [],
      tool_choice: 'none',
    },
  ];
}

export function ensureStepDefaults(steps: WorkflowStep[]): WorkflowStep[] {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new ValidationError('Steps must be a non-empty array');
  }

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

    return {
      ...step,
      step_name: step.step_name || `Step ${index + 1}`,
      step_order: stepOrder,
      step_description: step.step_description || step.step_name || `Step ${index + 1}`,
      depends_on: dependsOn,
      tools: step.tools || defaultTools,
      tool_choice: (step.tool_choice || (index === 0 ? 'auto' : 'none')) as 'auto' | 'required' | 'none',
      model,
      instructions: step.instructions || '',
    } as WorkflowStep;
  });
}

export function migrateLegacyWorkflowToSteps(workflowData: LegacyWorkflowData): WorkflowStep[] {
  const steps: WorkflowStep[] = [];

  if (workflowData.research_enabled && workflowData.ai_instructions) {
    steps.push({
      step_name: 'Deep Research',
      step_description: 'Generate comprehensive research report',
      model: workflowData.ai_model || 'gpt-5',
      instructions: workflowData.ai_instructions,
      step_order: 0,
      tools: ['web_search'],
      tool_choice: 'auto',
    });
  }

  if (workflowData.html_enabled) {
    steps.push({
      step_name: 'HTML Rewrite',
      step_description: 'Rewrite content into styled HTML matching template',
      model: workflowData.rewrite_model || 'gpt-5',
      instructions:
        'Rewrite the research content into styled HTML matching the provided template. Ensure the output is complete, valid HTML that matches the template\'s design and structure.',
      step_order: steps.length,
      tools: [],
      tool_choice: 'none',
    });
  }

  return steps;
}

export function migrateLegacyWorkflowOnUpdate(updateData: LegacyWorkflowData, existingWorkflow: LegacyWorkflowData): WorkflowStep[] {
  const steps: WorkflowStep[] = [];
  const researchEnabled = updateData.research_enabled !== undefined ? updateData.research_enabled : existingWorkflow.research_enabled;
  const htmlEnabled = updateData.html_enabled !== undefined ? updateData.html_enabled : existingWorkflow.html_enabled;
  const aiInstructions = updateData.ai_instructions || existingWorkflow.ai_instructions;

  if (researchEnabled && aiInstructions) {
    steps.push({
      step_name: 'Deep Research',
      step_description: 'Generate comprehensive research report',
      model: updateData.ai_model || existingWorkflow.ai_model || 'gpt-5',
      instructions: aiInstructions,
      step_order: 0,
      tools: ['web_search'],
      tool_choice: 'auto',
    });
  }

  if (htmlEnabled) {
    steps.push({
      step_name: 'HTML Rewrite',
      step_description: 'Rewrite content into styled HTML matching template',
      model: updateData.rewrite_model || existingWorkflow.rewrite_model || 'gpt-5',
      instructions:
        'Rewrite the research content into styled HTML matching the provided template. Ensure the output is complete, valid HTML that matches the template\'s design and structure.',
      step_order: steps.length,
      tools: [],
      tool_choice: 'none',
    });
  }

  return steps;
}

export const workflowConfigSupport = {
  parseWorkflowConfig,
  ensureStepDefaults,
  migrateLegacyWorkflowToSteps,
  migrateLegacyWorkflowOnUpdate,
};

export type WorkflowConfigSupport = typeof workflowConfigSupport;
export type { WorkflowStep };
export const validateWorkflowSteps = baseValidateWorkflowSteps;
