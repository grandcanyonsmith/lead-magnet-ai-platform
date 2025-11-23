'use client'

import { useJobId } from './useJobId'
import { useJobData } from './useJobData'
import { useJobStatus } from './useJobStatus'
import { useJobActions } from './useJobActions'

/**
 * Hook to manage job detail data loading and resubmission
 * 
 * Features:
 * - Loads job data, execution steps, workflow, submission, and form
 * - Polls for updates when job is processing
 * - Handles job resubmission
 * - Manages step rerun functionality
 * 
 * This hook composes smaller, focused hooks:
 * - useJobId: Manages job ID extraction from URL params
 * - useJobData: Handles data loading (job, workflow, submission, form, execution steps)
 * - useJobStatus: Manages polling for job status updates
 * - useJobActions: Handles resubmit and rerun step actions
 * 
 * @returns Job detail state and handlers
 */
export function useJobDetail() {
  const { jobId } = useJobId()
  
  const {
    job,
    setJob,
    workflow,
    submission,
    form,
    loading,
    error,
    setError,
    executionStepsError,
    loadJob,
    loadExecutionSteps,
  } = useJobData({
    jobId,
    onJobIdChange: () => {
      // Clear state when jobId changes - handled in useJobData
    },
  })

  const {
    resubmitting,
    handleResubmit,
    rerunningStep,
    handleRerunStep,
  } = useJobActions({
    jobId,
    job,
    setJob,
    setError,
    loadJob,
  })

  // Set up polling for job status updates
  useJobStatus({
    jobId,
    job,
    setJob,
    rerunningStep,
    loadExecutionSteps,
  })

  return {
    jobId,
    job,
    workflow,
    submission,
    form,
    loading,
    error,
    resubmitting,
    handleResubmit,
    rerunningStep,
    handleRerunStep,
    executionStepsError,
  }
}
