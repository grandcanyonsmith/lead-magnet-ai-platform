"use strict";
/**
 * Utility functions for workflow step normalization and validation.
 *
 * @module workflowMigration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateWorkflowSteps = void 0;
exports.ensureStepDefaults = ensureStepDefaults;
const errors_1 = require("./errors");
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
function ensureStepDefaults(steps) {
    if (!Array.isArray(steps) || steps.length === 0) {
        throw new errors_1.ValidationError('Steps must be a non-empty array');
    }
    return steps.map((step, index) => {
        const stepOrder = step.step_order !== undefined ? step.step_order : index;
        // Clean up and validate depends_on array
        let dependsOn = step.depends_on;
        let shouldAutoGenerate = false;
        // If depends_on is explicitly provided, clean it up
        if (dependsOn !== undefined && dependsOn !== null) {
            if (Array.isArray(dependsOn)) {
                // Filter out invalid indices: must be >= 0, < steps.length, and not equal to current index
                const validDeps = dependsOn.filter((depIndex) => typeof depIndex === 'number' &&
                    depIndex >= 0 &&
                    depIndex < steps.length &&
                    depIndex !== index);
                // If step_order > 0 and depends_on is empty, auto-generate dependencies
                // (empty array for step_order > 0 likely means AI didn't provide dependencies)
                // But if step_order === 0, empty array is correct (no dependencies)
                if (validDeps.length === 0 && stepOrder > 0) {
                    shouldAutoGenerate = true;
                }
                else {
                    dependsOn = validDeps;
                }
            }
            else {
                // Invalid type, reset to auto-generate
                shouldAutoGenerate = true;
            }
        }
        else {
            // Not provided at all, auto-generate
            shouldAutoGenerate = true;
        }
        // Auto-generate depends_on from step_order if needed
        if (shouldAutoGenerate) {
            if (stepOrder === 0) {
                // First step (stepOrder === 0) - no dependencies
                dependsOn = [];
            }
            else {
                // Find all steps with lower step_order
                const lowerOrderSteps = steps
                    .map((s, i) => ({
                    step: s,
                    index: i,
                    order: s.step_order !== undefined ? s.step_order : i
                }))
                    .filter(({ order }) => order < stepOrder)
                    .map(({ index }) => index)
                    .filter((depIndex) => depIndex >= 0 && depIndex < steps.length && depIndex !== index);
                // If there are lower order steps, depend on all of them
                // Otherwise, if index > 0, depend on the previous step by index
                if (lowerOrderSteps.length > 0) {
                    dependsOn = lowerOrderSteps;
                }
                else if (index > 0) {
                    dependsOn = [index - 1];
                }
                else {
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
            tools: step.tools || (index === 0 ? ['web_search_preview'] : []),
            tool_choice: (step.tool_choice || (index === 0 ? 'auto' : 'none')),
            model: step.model || 'gpt-4',
            instructions: step.instructions || '',
        };
    });
}
/**
 * Re-export workflow steps validation from validators module.
 * This maintains backward compatibility while using centralized validation.
 */
var validators_1 = require("./validators");
Object.defineProperty(exports, "validateWorkflowSteps", { enumerable: true, get: function () { return validators_1.validateWorkflowSteps; } });
//# sourceMappingURL=workflowMigration.js.map