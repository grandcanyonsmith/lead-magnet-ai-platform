/**
 * Dependency Resolution Engine
 * Handles building dependency graphs, detecting parallel opportunities, and resolving execution groups.
 *
 * This module provides algorithms for:
 * - Building dependency graphs from workflow steps
 * - Detecting opportunities for parallel execution
 * - Resolving execution groups for optimal step ordering
 * - Validating dependencies and detecting cycles
 *
 * @module dependencyResolver
 */
import { WorkflowStep, DependencyGraph, ExecutionPlan, StepStatus, ValidationResult } from './types';
/**
 * Build dependency graph from workflow steps.
 *
 * Creates a bidirectional dependency graph that tracks both:
 * - Dependencies: which steps each step depends on
 * - Dependents: which steps depend on each step
 *
 * Dependencies can be explicitly defined via `depends_on` or auto-detected from `step_order`.
 *
 * @param steps - Array of workflow steps
 * @returns Dependency graph with dependencies and dependents maps
 * @throws {Error} If steps array is empty or invalid
 *
 * @example
 * ```typescript
 * const steps: WorkflowStep[] = [
 *   { step_name: 'Step 1', model: 'gpt-4', instructions: '...', step_order: 0 },
 *   { step_name: 'Step 2', model: 'gpt-4', instructions: '...', step_order: 1, depends_on: [0] },
 *   { step_name: 'Step 3', model: 'gpt-4', instructions: '...', step_order: 1, depends_on: [0] },
 * ];
 * const graph = buildDependencyGraph(steps);
 * // graph.dependencies: Map(0 => [], 1 => [0], 2 => [0])
 * // graph.dependents: Map(0 => [1, 2], 1 => [], 2 => [])
 * ```
 */
export declare function buildDependencyGraph(steps: WorkflowStep[]): DependencyGraph;
/**
 * Detect parallel opportunities from step_order.
 * Steps with the same step_order can potentially run in parallel.
 *
 * @param steps - Array of workflow steps
 * @returns Map of step_order to array of step indices with that order
 *
 * @example
 * ```typescript
 * const opportunities = detectParallelOpportunities(steps);
 * // If steps 0, 1, 2 all have step_order: 0, returns Map(0 => [0, 1, 2])
 * ```
 */
export declare function detectParallelOpportunities(steps: WorkflowStep[]): Map<number, number[]>;
/**
 * Resolve execution groups - group steps into batches that can run in parallel.
 *
 * Uses topological sorting to determine the optimal execution order while maximizing
 * parallel execution opportunities. Steps in the same group can run simultaneously.
 *
 * @param steps - Array of workflow steps
 * @returns Execution plan with grouped steps
 *
 * @example
 * ```typescript
 * const plan = resolveExecutionGroups(steps);
 * // plan.executionGroups: [
 * //   { groupIndex: 0, stepIndices: [0], canRunInParallel: false },
 * //   { groupIndex: 1, stepIndices: [1, 2], canRunInParallel: true },
 * // ]
 * ```
 */
export declare function resolveExecutionGroups(steps: WorkflowStep[]): ExecutionPlan;
/**
 * Validate dependencies - check for circular dependencies and invalid references.
 *
 * Performs comprehensive validation:
 * - Checks for invalid dependency indices (out of range, self-references)
 * - Detects circular dependencies using DFS
 * - Validates both explicit and auto-detected dependencies
 *
 * @param steps - Array of workflow steps to validate
 * @returns Validation result with errors if any
 *
 * @example
 * ```typescript
 * const validation = validateDependencies(steps);
 * if (!validation.valid) {
 *   console.error('Dependency errors:', validation.errors);
 * }
 * ```
 */
export declare function validateDependencies(steps: WorkflowStep[]): ValidationResult;
/**
 * Get steps that are ready to execute based on completed steps.
 *
 * A step is ready when all of its dependencies have been completed.
 *
 * @param completedStepIndices - Array of indices of completed steps
 * @param allSteps - All workflow steps
 * @returns Array of step indices that are ready to execute
 *
 * @example
 * ```typescript
 * const readySteps = getReadySteps([0], allSteps);
 * // Returns steps that only depend on step 0
 * ```
 */
export declare function getReadySteps(completedStepIndices: number[], allSteps: WorkflowStep[]): number[];
/**
 * Get step status for all steps.
 *
 * Determines the current status of each step:
 * - 'completed': Step has finished execution
 * - 'running': Step is currently executing
 * - 'ready': Step is ready to execute (all dependencies completed)
 * - 'waiting': Step is waiting for dependencies to complete
 *
 * @param completedStepIndices - Array of indices of completed steps
 * @param runningStepIndices - Array of indices of currently running steps
 * @param allSteps - All workflow steps
 * @returns Map of step index to status
 *
 * @example
 * ```typescript
 * const status = getStepStatus([0], [1], allSteps);
 * // status.get(0): 'completed'
 * // status.get(1): 'running'
 * // status.get(2): 'ready' or 'waiting' depending on dependencies
 * ```
 */
export declare function getStepStatus(completedStepIndices: number[], runningStepIndices: number[], allSteps: WorkflowStep[]): Map<number, StepStatus>;
//# sourceMappingURL=dependencyResolver.d.ts.map