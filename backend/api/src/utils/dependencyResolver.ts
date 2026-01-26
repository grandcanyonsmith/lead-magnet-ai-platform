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

import {
  WorkflowStep,
  DependencyGraph,
  ExecutionGroup,
  ExecutionPlan,
  StepStatus,
  ValidationResult,
} from "./types";

/**
 * Build dependency graph from workflow steps.
 *
 * Creates a bidirectional dependency graph that tracks both:
 * - Dependencies: which steps each step depends on
 * - Dependents: which steps depend on each step
 *
 * Dependencies can be explicitly defined via `depends_on` (source of truth) or auto-detected from `step_order` (legacy fallback).
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
export function buildDependencyGraph(steps: WorkflowStep[]): DependencyGraph {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error("Steps must be a non-empty array");
  }
  const dependencies = new Map<number, number[]>();
  const dependents = new Map<number, number[]>();

  // Initialize maps
  steps.forEach((_, index) => {
    dependencies.set(index, []);
    dependents.set(index, []);
  });

  steps.forEach((step, index) => {
    if (step.depends_on && Array.isArray(step.depends_on)) {
      // Explicit dependencies provided
      const deps = step.depends_on.filter(
        (depIndex) =>
          depIndex >= 0 && depIndex < steps.length && depIndex !== index,
      );
      dependencies.set(index, deps);

      // Update dependents map
      deps.forEach((depIndex) => {
        const currentDependents = dependents.get(depIndex) || [];
        if (!currentDependents.includes(index)) {
          currentDependents.push(index);
          dependents.set(depIndex, currentDependents);
        }
      });
    } else {
      // Auto-detect from step_order
      const stepOrder = step.step_order !== undefined ? step.step_order : index;

      // Find all steps with lower step_order
      const lowerOrderSteps = steps
        .map((s, i) => ({
          step: s,
          index: i,
          order: s.step_order !== undefined ? s.step_order : i,
        }))
        .filter(({ order }) => order < stepOrder)
        .map(({ index }) => index);

      if (lowerOrderSteps.length > 0) {
        dependencies.set(index, lowerOrderSteps);

        // Update dependents map
        lowerOrderSteps.forEach((depIndex) => {
          const currentDependents = dependents.get(depIndex) || [];
          if (!currentDependents.includes(index)) {
            currentDependents.push(index);
            dependents.set(depIndex, currentDependents);
          }
        });
      }
    }
  });

  return {
    steps,
    dependencies,
    dependents,
  };
}

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
export function detectParallelOpportunities(
  steps: WorkflowStep[],
): Map<number, number[]> {
  const orderGroups = new Map<number, number[]>();

  steps.forEach((step, index) => {
    const stepOrder = step.step_order !== undefined ? step.step_order : index;

    if (!orderGroups.has(stepOrder)) {
      orderGroups.set(stepOrder, []);
    }
    orderGroups.get(stepOrder)!.push(index);
  });

  return orderGroups;
}

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
export function resolveExecutionGroups(steps: WorkflowStep[]): ExecutionPlan {
  if (steps.length === 0) {
    return {
      executionGroups: [],
      totalSteps: 0,
    };
  }

  const graph = buildDependencyGraph(steps);
  const executionGroups: ExecutionGroup[] = [];
  const completed = new Set<number>();
  let groupIndex = 0;

  while (completed.size < steps.length) {
    // Find all steps that are ready to execute (all dependencies completed)
    const readySteps: number[] = [];

    for (let i = 0; i < steps.length; i++) {
      if (completed.has(i)) {
        continue; // Already completed
      }

      const deps = graph.dependencies.get(i) || [];
      const allDepsCompleted =
        deps.length === 0 || deps.every((depIndex) => completed.has(depIndex));

      if (allDepsCompleted) {
        readySteps.push(i);
      }
    }

    if (readySteps.length === 0) {
      // This shouldn't happen if dependencies are valid, but handle gracefully
      console.warn(
        "No ready steps found, but not all steps completed. Possible circular dependency.",
      );
      break;
    }

    // Check if steps in this group can run in parallel
    // Steps can run in parallel if they don't depend on each other
    const canRunInParallel =
      readySteps.length > 1 && !hasInternalDependencies(readySteps, graph);

    executionGroups.push({
      groupIndex,
      stepIndices: readySteps,
      canRunInParallel: canRunInParallel || readySteps.length === 1,
    });

    // Mark these steps as completed for next iteration
    readySteps.forEach((stepIndex) => completed.add(stepIndex));
    groupIndex++;
  }

  return {
    executionGroups,
    totalSteps: steps.length,
  };
}

/**
 * Check if steps in a group have internal dependencies (can't run in parallel)
 */
function hasInternalDependencies(
  stepIndices: number[],
  graph: DependencyGraph,
): boolean {
  for (const stepIndex of stepIndices) {
    const deps = graph.dependencies.get(stepIndex) || [];
    // If any dependency is also in this group, they can't run in parallel
    if (deps.some((depIndex) => stepIndices.includes(depIndex))) {
      return true;
    }
  }
  return false;
}

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
export function validateDependencies(steps: WorkflowStep[]): ValidationResult {
  const errors: string[] = [];

  if (!steps || steps.length === 0) {
    return { valid: true, errors: [] };
  }

  // Check for invalid dependency indices
  steps.forEach((step, index) => {
    if (step.depends_on && Array.isArray(step.depends_on)) {
      step.depends_on.forEach((depIndex: number) => {
        if (depIndex < 0 || depIndex >= steps.length) {
          errors.push(
            `Step ${index} (${step.step_name}): depends_on index ${depIndex} is out of range`,
          );
        }
        if (depIndex === index) {
          errors.push(
            `Step ${index} (${step.step_name}): cannot depend on itself`,
          );
        }
      });
    }
  });

  // Check for circular dependencies using DFS
  const visited = new Set<number>();
  const recStack = new Set<number>();

  function hasCycle(nodeIndex: number): boolean {
    if (recStack.has(nodeIndex)) {
      return true; // Found a cycle
    }
    if (visited.has(nodeIndex)) {
      return false; // Already processed
    }

    visited.add(nodeIndex);
    recStack.add(nodeIndex);

    const step = steps[nodeIndex];
    const deps = step.depends_on || [];

    // If no explicit dependencies, check step_order
    if (deps.length === 0 && step.step_order !== undefined) {
      const stepOrder = step.step_order;
      const lowerOrderSteps = steps
        .map((s, i) => ({
          step: s,
          index: i,
          order: s.step_order !== undefined ? s.step_order : i,
        }))
        .filter(({ order }) => order < stepOrder)
        .map(({ index }) => index);

      for (const depIndex of lowerOrderSteps) {
        if (hasCycle(depIndex)) {
          return true;
        }
      }
    } else {
      for (const depIndex of deps) {
        if (hasCycle(depIndex)) {
          return true;
        }
      }
    }

    recStack.delete(nodeIndex);
    return false;
  }

  for (let i = 0; i < steps.length; i++) {
    if (!visited.has(i) && hasCycle(i)) {
      errors.push(
        `Circular dependency detected involving step ${i} (${steps[i].step_name})`,
      );
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

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
export function getReadySteps(
  completedStepIndices: number[],
  allSteps: WorkflowStep[],
): number[] {
  const completed = new Set(completedStepIndices);
  const graph = buildDependencyGraph(allSteps);
  const readySteps: number[] = [];

  for (let i = 0; i < allSteps.length; i++) {
    if (completed.has(i)) {
      continue; // Already completed
    }

    const deps = graph.dependencies.get(i) || [];
    const allDepsCompleted =
      deps.length === 0 || deps.every((depIndex) => completed.has(depIndex));

    if (allDepsCompleted) {
      readySteps.push(i);
    }
  }

  return readySteps;
}

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
export function getStepStatus(
  completedStepIndices: number[],
  runningStepIndices: number[],
  allSteps: WorkflowStep[],
): Map<number, StepStatus> {
  const status = new Map<number, StepStatus>();
  const completed = new Set(completedStepIndices);
  const running = new Set(runningStepIndices);
  const readySteps = getReadySteps(completedStepIndices, allSteps);

  allSteps.forEach((_, index) => {
    if (completed.has(index)) {
      status.set(index, "completed");
    } else if (running.has(index)) {
      status.set(index, "running");
    } else if (readySteps.includes(index)) {
      status.set(index, "ready");
    } else {
      status.set(index, "waiting");
    }
  });

  return status;
}
