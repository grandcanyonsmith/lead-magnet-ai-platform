/**
 * Workflow Config Parser
 * Parses and validates workflow configuration from AI responses.
 * 
 * Handles parsing of AI-generated workflow configurations, supporting both:
 * - New format: JSON with steps array
 * - Legacy format: JSON with research_instructions field
 * 
 * @module workflowConfigParser
 */

import { WorkflowStep, ToolConfig } from './types';
import { logger } from './logger';
import { isArray, isString } from './validators';

/**
 * Parsed workflow configuration result.
 */
export interface ParsedWorkflowConfig {
  workflow_name: string;
  workflow_description: string;
  steps: WorkflowStep[];
}

/**
 * Raw step data from AI response (may be incomplete).
 */
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

/**
 * Raw workflow data from AI response.
 */
interface RawWorkflowData {
  workflow_name?: string;
  workflow_description?: string;
  steps?: RawStep[];
  research_instructions?: string;
  [key: string]: unknown;
}

/**
 * Parse workflow configuration from AI response.
 * 
 * Handles both new format (with steps array) and legacy format (with research_instructions).
 * Provides sensible defaults for missing fields and validates the structure.
 * 
 * @param content - Raw content string from AI response (may contain JSON)
 * @param description - Default workflow description if not provided in content
 * @returns Parsed workflow configuration with validated steps
 * 
 * @example
 * ```typescript
 * const config = parseWorkflowConfig(aiResponse, 'My workflow');
 * // Returns: { workflow_name: '...', workflow_description: '...', steps: [...] }
 * ```
 */
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

    // If parsed data has steps, use it (new format)
    if (parsed.steps && isArray(parsed.steps) && parsed.steps.length > 0) {
      return {
        workflow_name: isString(parsed.workflow_name) ? parsed.workflow_name : 'Generated Lead Magnet',
        workflow_description: isString(parsed.workflow_description) ? parsed.workflow_description : description,
        steps: parsed.steps.map((step: RawStep, index: number) => normalizeStep(step, index)),
      };
    } 
    // Legacy format - convert to steps
    else if (isString(parsed.research_instructions)) {
      return {
        workflow_name: isString(parsed.workflow_name) ? parsed.workflow_name : 'Generated Lead Magnet',
        workflow_description: isString(parsed.workflow_description) ? parsed.workflow_description : description,
        steps: createLegacySteps(parsed.research_instructions),
      };
    } 
    // Partial update - merge with defaults
    else {
      const defaultConfig = getDefaultConfig(description);
      return {
        ...defaultConfig,
        workflow_name: isString(parsed.workflow_name) ? parsed.workflow_name : defaultConfig.workflow_name,
        workflow_description: isString(parsed.workflow_description) ? parsed.workflow_description : defaultConfig.workflow_description,
      };
    }
  } catch (error) {
    logger.warn('[Workflow Config Parser] Failed to parse workflow JSON, using defaults', {
      error: error instanceof Error ? error.message : String(error),
    });
    return getDefaultConfig(description);
  }
}

/**
 * Get default workflow configuration.
 * 
 * @param description - Workflow description
 * @returns Default configuration with two steps
 */
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
        instructions: 'Rewrite the research content into styled HTML matching the provided template. Ensure the output is complete, valid HTML that matches the template\'s design and structure.',
        step_order: 1,
        depends_on: [0],
        tools: [],
        tool_choice: 'none',
      },
    ],
  };
}

/**
 * Normalize a raw step from AI response to WorkflowStep.
 * 
 * @param step - Raw step data
 * @param index - Step index for defaults
 * @returns Normalized workflow step
 */
function normalizeStep(step: RawStep, index: number): WorkflowStep {
  const tools: (string | ToolConfig)[] = isArray(step.tools) 
    ? (step.tools as unknown[]).filter((t): t is string | ToolConfig => 
        typeof t === 'string' || (typeof t === 'object' && t !== null && 'type' in t)
      )
    : (index === 0 ? ['web_search'] : []);

  const toolChoice = (step.tool_choice === 'auto' || step.tool_choice === 'required' || step.tool_choice === 'none')
    ? step.tool_choice
    : (index === 0 ? 'auto' : 'none');

  return {
    step_name: isString(step.step_name) && step.step_name.trim().length > 0 
      ? step.step_name 
      : `Step ${index + 1}`,
    step_description: isString(step.step_description) ? step.step_description : '',
    model: isString(step.model) && step.model.trim().length > 0 ? step.model : 'gpt-5',
    instructions: isString(step.instructions) && step.instructions.trim().length > 0 
      ? step.instructions 
      : 'Generate content based on form submission data.',
    step_order: typeof step.step_order === 'number' && step.step_order >= 0 
      ? step.step_order 
      : index,
    depends_on: isArray(step.depends_on) 
      ? step.depends_on.filter((d): d is number => typeof d === 'number' && d >= 0 && d < 1000)
      : [], // Default to empty array if not provided - ensureStepDefaults will generate proper dependencies
    tools: tools.length > 0 ? tools : undefined,
    tool_choice: toolChoice,
  };
}

/**
 * Create steps from legacy research_instructions format.
 * 
 * @param researchInstructions - Research instructions from legacy format
 * @returns Array of workflow steps
 */
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
      instructions: 'Rewrite the research content into styled HTML matching the provided template. Ensure the output is complete, valid HTML that matches the template\'s design and structure.',
      step_order: 1,
      depends_on: [0],
      tools: [],
      tool_choice: 'none',
    },
  ];
}

