/**
 * Utility functions for job components
 */

import { ExecutionStep, MergedStep, StepStatus } from '@/types/job'

/**
 * Check if a step has completed (has output)
 */
function hasCompleted(step: MergedStep): boolean {
  return step.output !== null && step.output !== undefined && step.output !== ''
}

/**
 * Determine step status based on step data and job status
 * 
 * @param step - Step to determine status for
 * @param sortedSteps - All steps sorted by order
 * @param jobStatus - Current job status
 * @param rerunningStep - Zero-based index of step being rerun (optional)
 */
export function getStepStatus(
  step: MergedStep,
  sortedSteps: MergedStep[],
  jobStatus?: string,
  rerunningStep?: number | null
): StepStatus {
  // Check if this step is being rerun (Bug 2.1, 2.3 fix)
  const stepOrder = step.step_order ?? 0
  const isBeingRerun = rerunningStep !== null && rerunningStep !== undefined && stepOrder > 0 && rerunningStep === stepOrder - 1
  
  // If step is being rerun, show as in_progress (Bug 2.1, 2.3 fix)
  if (isBeingRerun) {
    return 'in_progress'
  }

  // Use explicit status if provided
  if (step._status) {
    return step._status
  }

  // If step has output, it's completed
  if (hasCompleted(step)) {
    return 'completed'
  }

  const stepIndex = sortedSteps.indexOf(step)
  const completedSteps = sortedSteps.filter(hasCompleted)

  // If job is processing, check if this is the current step
  if (jobStatus === 'processing') {
    // If this step comes right after the last completed step, it's in progress
    if (stepIndex === completedSteps.length && stepIndex < sortedSteps.length) {
      return 'in_progress'
    }
  }

  // If job failed and step was supposed to run but didn't complete
  if (jobStatus === 'failed') {
    if (stepIndex <= completedSteps.length && !hasCompleted(step)) {
      return 'failed'
    }
  }

  return 'pending'
}

/**
 * Get previous steps for context (excluding form submission)
 */
export function getPreviousSteps(
  currentStep: MergedStep,
  sortedSteps: MergedStep[]
): ExecutionStep[] {
  const currentOrder = currentStep.step_order ?? 0

  return sortedSteps
    .filter((step) => {
      const stepOrder = step.step_order ?? 0
      return (
        stepOrder < currentOrder &&
        stepOrder > 0 && // Exclude form submission (step 0)
        hasCompleted(step)
      )
    })
    .sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0))
    .map((step) => ({
      step_order: step.step_order ?? 0,
      step_type: step.step_type,
      step_name: step.step_name || `Step ${step.step_order}`,
      output: step.output,
      image_urls: step.image_urls,
    }))
}

/**
 * Get form submission data (step with order 0)
 */
export function getFormSubmission(sortedSteps: MergedStep[]): any {
  const formSubmissionStep = sortedSteps.find((s) => s.step_order === 0)
  return formSubmissionStep?.output || null
}

