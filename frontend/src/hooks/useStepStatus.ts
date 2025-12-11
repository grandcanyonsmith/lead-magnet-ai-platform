/**
 * Hook for calculating step status based on step data and job status
 */

import { useMemo } from 'react'
import { MergedStep, StepStatus } from '@/types/job'

interface UseStepStatusOptions {
  steps: MergedStep[]
  jobStatus?: string
}

/**
 * Calculate step status for a given step
 */
// Helper function to check if a step has completed (matches utils.ts logic)
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

export function useStepStatus(step: MergedStep, options: UseStepStatusOptions): StepStatus {
  const { steps, jobStatus } = options
  
  return useMemo(() => {
    // Use explicit status if provided
    if (step._status) {
      return step._status
    }
    
    // Determine status from step data
    if (hasCompleted(step)) {
      return 'completed'
    }
    
    // Sort steps for status calculation
    const sortedSteps = [...steps].sort((a, b) => {
      const orderA = a.step_order ?? 0
      const orderB = b.step_order ?? 0
      return orderA - orderB
    })
    
    // Check if job is processing and this might be the current step
    if (jobStatus === 'processing') {
      // Find all completed steps
      const completedSteps = sortedSteps.filter(hasCompleted)
      const stepIndex = sortedSteps.indexOf(step)
      // If this step comes right after the last completed step, it's in progress
      if (stepIndex === completedSteps.length && stepIndex < sortedSteps.length) {
        return 'in_progress'
      }
    }
    
    // Check if job failed and step has no output
    if (jobStatus === 'failed') {
      const completedSteps = sortedSteps.filter(hasCompleted)
      const stepIndex = sortedSteps.indexOf(step)
      // If step was supposed to run but didn't complete, mark as failed
      if (stepIndex <= completedSteps.length && step.output === null) {
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
      const stepIndex = sortedSteps.indexOf(step)
      const lastStepIndex = sortedSteps.length - 1
      if (stepIndex <= lastStepIndex) {
        return 'completed'
      }
    }
    
    return 'pending'
  }, [step, steps, jobStatus])
}

/**
 * Get status for all steps
 */
export function useAllStepStatuses(options: UseStepStatusOptions): Map<number, StepStatus> {
  const { steps, jobStatus } = options
  
  return useMemo(() => {
    const statusMap = new Map<number, StepStatus>()
    
    // Sort steps for status calculation
    const sortedSteps = [...steps].sort((a, b) => {
      const orderA = a.step_order ?? 0
      const orderB = b.step_order ?? 0
      return orderA - orderB
    })
    
    steps.forEach((step) => {
      // Inline the status calculation logic instead of calling useStepStatus hook
      let status: StepStatus
      
      // Use explicit status if provided
      if (step._status) {
        status = step._status
      } else if (hasCompleted(step)) {
        status = 'completed'
      } else if (jobStatus === 'processing') {
        // Find all completed steps
        const completedSteps = sortedSteps.filter(hasCompleted)
        const stepIndex = sortedSteps.indexOf(step)
        // If this step comes right after the last completed step, it's in progress
        if (stepIndex === completedSteps.length && stepIndex < sortedSteps.length) {
          status = 'in_progress'
        } else {
          status = 'pending'
        }
      } else if (jobStatus === 'failed') {
        const completedSteps = sortedSteps.filter(hasCompleted)
        const stepIndex = sortedSteps.indexOf(step)
        // If step was supposed to run but didn't complete, mark as failed
        if (stepIndex <= completedSteps.length && step.output === null) {
          status = 'failed'
        } else {
          status = 'pending'
        }
      } else if (jobStatus === 'completed') {
        // If job is completed, all steps that should have run are completed
        if (step.error) {
          status = 'failed'
        } else {
          const stepIndex = sortedSteps.indexOf(step)
          const lastStepIndex = sortedSteps.length - 1
          if (stepIndex <= lastStepIndex) {
            status = 'completed'
          } else {
            status = 'pending'
          }
        }
      } else {
        status = 'pending'
      }
      
      statusMap.set(step.step_order ?? 0, status)
    })
    
    return statusMap
  }, [steps, jobStatus])
}

