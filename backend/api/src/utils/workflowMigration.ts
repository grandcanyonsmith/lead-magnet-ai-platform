/**
 * Utility functions for migrating legacy workflow formats to the new steps-based format
 */

export interface LegacyWorkflowData {
  research_enabled?: boolean;
  html_enabled?: boolean;
  ai_instructions?: string;
  ai_model?: string;
  rewrite_model?: string;
  steps?: any[];
}

export interface WorkflowStep {
  step_name: string;
  step_description: string;
  model: string;
  instructions: string;
  step_order: number;
  tools?: string[];
  tool_choice?: 'auto' | 'required' | 'none';
}

/**
 * Migrate legacy workflow format to steps format
 */
export function migrateLegacyWorkflowToSteps(workflowData: LegacyWorkflowData): WorkflowStep[] {
  const steps: WorkflowStep[] = [];
  
  if (workflowData.research_enabled && workflowData.ai_instructions) {
    steps.push({
      step_name: 'Deep Research',
      step_description: 'Generate comprehensive research report',
      model: workflowData.ai_model || 'o3-deep-research',
      instructions: workflowData.ai_instructions,
      step_order: 0,
      tools: ['web_search_preview'],
      tool_choice: 'auto',
    });
  }
  
  if (workflowData.html_enabled) {
    steps.push({
      step_name: 'HTML Rewrite',
      step_description: 'Rewrite content into styled HTML matching template',
      model: workflowData.rewrite_model || 'gpt-5',
      instructions: workflowData.html_enabled 
        ? 'Rewrite the research content into styled HTML matching the provided template. Ensure the output is complete, valid HTML that matches the template\'s design and structure.'
        : 'Generate HTML output',
      step_order: steps.length,
      tools: [],
      tool_choice: 'none',
    });
  }
  
  return steps;
}

/**
 * Migrate legacy workflow during update (considers existing workflow state)
 */
export function migrateLegacyWorkflowOnUpdate(
  updateData: LegacyWorkflowData,
  existingWorkflow: LegacyWorkflowData
): WorkflowStep[] {
  const steps: WorkflowStep[] = [];
  const researchEnabled = updateData.research_enabled !== undefined 
    ? updateData.research_enabled 
    : existingWorkflow.research_enabled;
  const htmlEnabled = updateData.html_enabled !== undefined 
    ? updateData.html_enabled 
    : existingWorkflow.html_enabled;
  const aiInstructions = updateData.ai_instructions || existingWorkflow.ai_instructions;
  
  if (researchEnabled && aiInstructions) {
    steps.push({
      step_name: 'Deep Research',
      step_description: 'Generate comprehensive research report',
      model: updateData.ai_model || existingWorkflow.ai_model || 'o3-deep-research',
      instructions: aiInstructions,
      step_order: 0,
      tools: ['web_search_preview'],
      tool_choice: 'auto',
    });
  }
  
  if (htmlEnabled) {
    steps.push({
      step_name: 'HTML Rewrite',
      step_description: 'Rewrite content into styled HTML matching template',
      model: updateData.rewrite_model || existingWorkflow.rewrite_model || 'gpt-5',
      instructions: 'Rewrite the research content into styled HTML matching the provided template. Ensure the output is complete, valid HTML that matches the template\'s design and structure.',
      step_order: steps.length,
      tools: [],
      tool_choice: 'none',
    });
  }
  
  return steps;
}

/**
 * Ensure step defaults are set (step_order, tools, tool_choice)
 */
export function ensureStepDefaults(steps: WorkflowStep[]): WorkflowStep[] {
  return steps.map((step: any, index: number) => ({
    ...step,
    step_order: step.step_order !== undefined ? step.step_order : index,
    tools: step.tools || (index === 0 ? ['web_search_preview'] : []),
    tool_choice: (step.tool_choice || (index === 0 ? 'auto' : 'none')) as 'auto' | 'required' | 'none',
  }));
}

/**
 * Validate workflow steps structure
 */
export function validateWorkflowSteps(steps: WorkflowStep[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!Array.isArray(steps)) {
    errors.push('Steps must be an array');
    return { valid: false, errors };
  }
  
  if (steps.length === 0) {
    errors.push('At least one step is required');
    return { valid: false, errors };
  }
  
  steps.forEach((step, index) => {
    if (!step.step_name || typeof step.step_name !== 'string') {
      errors.push(`Step ${index + 1}: step_name is required and must be a string`);
    }
    if (!step.instructions || typeof step.instructions !== 'string') {
      errors.push(`Step ${index + 1}: instructions is required and must be a string`);
    }
    if (!step.model || typeof step.model !== 'string') {
      errors.push(`Step ${index + 1}: model is required and must be a string`);
    }
    if (step.step_order === undefined || typeof step.step_order !== 'number') {
      errors.push(`Step ${index + 1}: step_order is required and must be a number`);
    }
    if (step.tools && !Array.isArray(step.tools)) {
      errors.push(`Step ${index + 1}: tools must be an array`);
    }
    if (step.tool_choice && !['auto', 'required', 'none'].includes(step.tool_choice)) {
      errors.push(`Step ${index + 1}: tool_choice must be 'auto', 'required', or 'none'`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

