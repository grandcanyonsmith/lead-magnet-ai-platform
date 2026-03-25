import { WorkflowStep } from "@/types/workflow";

function normalizeDependencyArray(
  dependsOn: WorkflowStep["depends_on"],
  stepCount: number,
  currentIndex: number,
): number[] | undefined {
  if (!Array.isArray(dependsOn)) {
    return dependsOn;
  }

  const normalized = Array.from(
    new Set(
      dependsOn.filter(
        (dep): dep is number =>
          Number.isInteger(dep) &&
          dep >= 0 &&
          dep < stepCount &&
          dep !== currentIndex,
      ),
    ),
  ).sort((a, b) => a - b);

  return normalized;
}

export function normalizeLoadedWorkflowSteps(
  steps: WorkflowStep[],
): WorkflowStep[] {
  return steps.map((step, index) => ({
    ...step,
    step_order: index,
    depends_on: normalizeDependencyArray(step.depends_on, steps.length, index),
  }));
}

export function normalizeEditedWorkflowSteps(
  steps: WorkflowStep[],
): WorkflowStep[] {
  const previousIndexToNextIndex = new Map<number, number>();

  steps.forEach((step, nextIndex) => {
    const previousIndex =
      typeof step.step_order === "number" &&
      Number.isInteger(step.step_order) &&
      step.step_order >= 0
        ? step.step_order
        : nextIndex;

    previousIndexToNextIndex.set(previousIndex, nextIndex);
  });

  return steps.map((step, nextIndex) => {
    const remappedDependsOn = Array.isArray(step.depends_on)
      ? normalizeDependencyArray(
          step.depends_on
            .map((dep) => previousIndexToNextIndex.get(dep))
            .filter((dep): dep is number => dep !== undefined),
          steps.length,
          nextIndex,
        )
      : step.depends_on;

    return {
      ...step,
      step_order: nextIndex,
      depends_on: remappedDependsOn,
    };
  });
}
