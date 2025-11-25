/**
 * Utility functions for migrating legacy workflow formats to the new steps-based format.
 * 
 * @module workflowMigration
 */

import { WorkflowStep, LegacyWorkflowData } from './types';
import { ValidationError } from './errors';

// Re-export WorkflowStep for convenience
export type { WorkflowStep } from './types';

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
      tools: ['web_search'],
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
      tools: ['web_search'],
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
 * Ensure step defaults are set (step_order, tools, tool_choice, step_description, depends_on).
 * 
 * @param steps - Workflow steps to normalize
 * @returns Steps with defaults applied
 * @throws {ValidationError} If steps array is invalid
 * 
 * @example
 * ```typescript
 * const normalizedSteps = ensureStepDefaults(steps);
 * ```
 */
export function ensureStepDefaults(steps: WorkflowStep[]): WorkflowStep[] {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new ValidationError('Steps must be a non-empty array');
  }

  return steps.map((step: Partial<WorkflowStep>, index: number) => {
    const stepOrder = step.step_order !== undefined ? step.step_order : index;
    
    // Clean up and validate depends_on array
    let dependsOn = step.depends_on;
    let shouldAutoGenerate = false;
    
    // If depends_on is explicitly provided, clean it up
    if (dependsOn !== undefined && dependsOn !== null) {
      if (Array.isArray(dependsOn)) {
        // Filter out invalid indices: must be >= 0, < steps.length, and not equal to current index
        const validDeps = dependsOn.filter((depIndex: number) => 
          typeof depIndex === 'number' && 
          depIndex >= 0 && 
          depIndex < steps.length && 
          depIndex !== index
        );
        
        // If step_order > 0 and depends_on is empty, auto-generate dependencies
        // (empty array for step_order > 0 likely means AI didn't provide dependencies)
        // But if step_order === 0, empty array is correct (no dependencies)
        if (validDeps.length === 0 && stepOrder > 0) {
          shouldAutoGenerate = true;
        } else {
          dependsOn = validDeps;
        }
      } else {
        // Invalid type, reset to auto-generate
        shouldAutoGenerate = true;
      }
    } else {
      // Not provided at all, auto-generate
      shouldAutoGenerate = true;
    }
    
    // Auto-generate depends_on from step_order if needed
    if (shouldAutoGenerate) {
      if (stepOrder === 0) {
        // First step (stepOrder === 0) - no dependencies
        dependsOn = [];
      } else {
        // Find all steps with lower step_order
        const lowerOrderSteps = steps
          .map((s: Partial<WorkflowStep>, i: number) => ({ 
            step: s, 
            index: i, 
            order: s.step_order !== undefined ? s.step_order : i 
          }))
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
      }
    }
    
    return {
      ...step,
      step_name: step.step_name || `Step ${index + 1}`,
      step_order: stepOrder,
      step_description: step.step_description || step.step_name || `Step ${index + 1}`,
      depends_on: dependsOn,
      tools: step.tools || (index === 0 ? ['web_search'] : []),
      tool_choice: (step.tool_choice || (index === 0 ? 'auto' : 'none')) as 'auto' | 'required' | 'none',
      model: step.model || 'gpt-4',
      instructions: step.instructions || '',
    } as WorkflowStep;
  });
}

/**
 * Re-export workflow steps validation from validators module.
 * This maintains backward compatibility while using centralized validation.
 */
export { validateWorkflowSteps } from './validators';

