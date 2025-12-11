/**
 * Utility functions for job components
 */

import { ExecutionStep, MergedStep, StepStatus } from '@/types/job'

/**
 * Check if a step has completed
 * A step is considered completed if it has:
 * - output (non-empty)
 * - completed_at timestamp
 * - duration_ms (indicates execution)
 * - artifact_id (has generated artifact)
 * - image_urls (has generated images)
 */
function hasCompleted(step: MergedStep): boolean {
  // Check for explicit output
  if (step.output !== null && step.output !== undefined && step.output !== '') {
    return true
  }
  
  // Check for completion timestamp
  if (step.completed_at) {
    return true
  }
  
  // Check for duration (indicates step ran)
  if (step.duration_ms !== undefined && step.duration_ms !== null) {
    return true
  }
  
  // Check for artifact (output artifact exists)
  if (step.artifact_id) {
    return true
  }
  
  // Check for image URLs (images were generated)
  if (step.image_urls && Array.isArray(step.image_urls) && step.image_urls.length > 0) {
    return true
  }
  
  // Check if step has started and completed timestamps
  if (step.started_at && step.completed_at) {
    return true
  }
  
  return false
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

  // If job is completed, all steps that should have run are completed
  // This handles cases where step data might be missing but job completed successfully
  if (jobStatus === 'completed') {
    // If step has an error, mark as failed
    if (step.error) {
      return 'failed'
    }
    // Otherwise, if job completed, the step must have completed
    // Only mark as completed if this step should have run (not future steps)
    // Steps are sequential, so if job completed, all steps up to the last one completed
    const lastCompletedStepIndex = sortedSteps.length - 1
    if (stepIndex <= lastCompletedStepIndex) {
      return 'completed'
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

