/**
 * Shared hook for processing job card data
 * Extracts common logic used by both JobCard and JobTableRow components
 */

import { useMemo } from 'react'
import type { Job } from '@/features/jobs/types'

export interface JobCardData {
  duration: number | null
  stepProgress: { completed: number; total: number } | null
  hasError: boolean
  errorMessage: string | null
  hasDocument: boolean
}

/**
 * Calculate step progress for a job
 */
function getStepProgress(job: Job): { completed: number; total: number } | null {
  const steps = job.execution_steps || []
  if (steps.length === 0) return null
  
  // For failed jobs, count steps with outputs but cap at failed step
  // For other jobs, count all steps with outputs
  let completedSteps = 0
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const hasOutput = step.output !== null && step.output !== undefined && step.output !== ''
    
    // If this step has explicit failed status, stop counting here
    if (step._status === 'failed' || (job.status === 'failed' && !hasOutput)) {
      break
    }
    
    if (hasOutput) {
      completedSteps++
    }
  }
  
  return { completed: completedSteps, total: steps.length }
}

/**
 * Hook to compute shared job card data
 */
export function useJobCardData(job: Job): JobCardData {
  return useMemo(() => {
    const duration = job.completed_at && job.created_at
      ? Math.round((new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000)
      : null
    
    const stepProgress = getStepProgress(job)
    
    const hasError = job.status === 'failed' && Boolean(job.error_message)
    const errorMessage = hasError ? job.error_message || null : null
    
    const hasDocument = Boolean(job.output_url)
    
    return {
      duration,
      stepProgress,
      hasError,
      errorMessage,
      hasDocument,
    }
  }, [job])
}

