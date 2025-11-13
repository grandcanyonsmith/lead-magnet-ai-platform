/**
 * Utility functions for job components
 */

import { MergedStep, StepStatus } from '@/types/job'

/**
 * Check if a step has completed (has output)
 */
function hasCompleted(step: MergedStep): boolean {
  return step.output !== null && step.output !== undefined && step.output !== ''
}

/**
 * Determine step status based on step data and job status
 */
export function getStepStatus(
  step: MergedStep,
  sortedSteps: MergedStep[],
  jobStatus?: string
): StepStatus {
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
): Array<{
  step_order: number
  step_name: string
  output: any
  image_urls?: string[]
}> {
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

