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
export function useStepStatus(step: MergedStep, options: UseStepStatusOptions): StepStatus {
  const { steps, jobStatus } = options
  
  return useMemo(() => {
    // Use explicit status if provided
    if (step._status) {
      return step._status
    }
    
    // Determine status from step data
    if (step.output !== null && step.output !== undefined && step.output !== '') {
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
      // Find all completed steps (have output)
      const completedSteps = sortedSteps.filter((s) => 
        s.output !== null && s.output !== undefined && s.output !== ''
      )
      const stepIndex = sortedSteps.indexOf(step)
      // If this step comes right after the last completed step, it's in progress
      if (stepIndex === completedSteps.length && stepIndex < sortedSteps.length) {
        return 'in_progress'
      }
    }
    
    // Check if job failed and step has no output
    if (jobStatus === 'failed') {
      const completedSteps = sortedSteps.filter((s) => 
        s.output !== null && s.output !== undefined && s.output !== ''
      )
      const stepIndex = sortedSteps.indexOf(step)
      // If step was supposed to run but didn't complete, mark as failed
      if (stepIndex <= completedSteps.length && step.output === null) {
        return 'failed'
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
    
    steps.forEach((step) => {
      const status = useStepStatus(step, { steps, jobStatus })
      statusMap.set(step.step_order ?? 0, status)
    })
    
    return statusMap
  }, [steps, jobStatus])
}

