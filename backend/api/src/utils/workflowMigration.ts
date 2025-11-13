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
  depends_on?: number[]; // Array of step indices this step depends on
  tools?: string[];
  tool_choice?: 'auto' | 'required' | 'none';
}

/**
 * Migrate legacy workflow format to steps format
 * 
 * @deprecated Legacy format is no longer supported. All workflows must use steps format.
 * This function is kept for reference only and should not be used in new code.
 */
export function migrateLegacyWorkflowToSteps(workflowData: LegacyWorkflowData): WorkflowStep[] {
  const steps: WorkflowStep[] = [];
  
  if (workflowData.research_enabled && workflowData.ai_instructions) {
    steps.push({
      step_name: 'Deep Research',
      step_description: 'Generate comprehensive research report',
      model: workflowData.ai_model || 'gpt-5',
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
 * 
 * @deprecated Legacy format is no longer supported. All workflows must use steps format.
 * This function is kept for reference only and should not be used in new code.
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
      model: updateData.ai_model || existingWorkflow.ai_model || 'gpt-5',
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
 * Ensure step defaults are set (step_order, tools, tool_choice, step_description, depends_on)
 */
export function ensureStepDefaults(steps: WorkflowStep[]): WorkflowStep[] {
  return steps.map((step: any, index: number) => {
    const stepOrder = step.step_order !== undefined ? step.step_order : index;
    
    // Clean up and validate depends_on array
    let dependsOn = step.depends_on;
    
    // If depends_on is explicitly provided (even if empty array), clean it up
    if (dependsOn !== undefined && dependsOn !== null) {
      if (Array.isArray(dependsOn)) {
        // Filter out invalid indices: must be >= 0, < steps.length, and not equal to current index
        dependsOn = dependsOn.filter((depIndex: number) => 
          typeof depIndex === 'number' && 
          depIndex >= 0 && 
          depIndex < steps.length && 
          depIndex !== index
        );
      } else {
        // Invalid type, reset to undefined to auto-generate
        dependsOn = undefined;
      }
    }
    
    // Auto-generate depends_on from step_order if not provided
    if (dependsOn === undefined && stepOrder > 0) {
      // Find all steps with lower step_order
      const lowerOrderSteps = steps
        .map((s: any, i: number) => ({ step: s, index: i, order: s.step_order !== undefined ? s.step_order : i }))
        .filter(({ order }) => order < stepOrder)
        .map(({ index }) => index)
        .filter((depIndex: number) => depIndex >= 0 && depIndex < steps.length && depIndex !== index);
      
      // If there are lower order steps, depend on all of them
      // Otherwise, if index > 0, depend on the previous step by index
      if (lowerOrderSteps.length > 0) {
        dependsOn = lowerOrderSteps;
      } else if (index > 0) {
        dependsOn = [index - 1];
      } else {
        // First step (index 0) with stepOrder > 0 but no lower order steps - no dependencies
        dependsOn = [];
      }
    } else if (dependsOn === undefined) {
      // First step (stepOrder === 0) - no dependencies
      dependsOn = [];
    }
    
    return {
      ...step,
      step_order: stepOrder,
      step_description: step.step_description || step.step_name || `Step ${index + 1}`,
      depends_on: dependsOn,
      tools: step.tools || (index === 0 ? ['web_search_preview'] : []),
      tool_choice: (step.tool_choice || (index === 0 ? 'auto' : 'none')) as 'auto' | 'required' | 'none',
    };
  });
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

