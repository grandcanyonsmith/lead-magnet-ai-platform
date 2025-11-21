/**
 * Utility functions for workflow step normalization and validation.
 *
 * @module workflowMigration
 */
import { WorkflowStep } from './types';
export type { WorkflowStep } from './types';
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
export declare function ensureStepDefaults(steps: WorkflowStep[]): WorkflowStep[];
/**
 * Re-export workflow steps validation from validators module.
 * This maintains backward compatibility while using centralized validation.
 */
export { validateWorkflowSteps } from './validators';
//# sourceMappingURL=workflowMigration.d.ts.map