'use client'

import { useEffect } from 'react'
import { api } from '@/shared/lib/api'
import { withOwnCustomerId } from './jobDataUtils'

interface UseJobStatusParams {
  jobId: string
  job: any
  setJob: (job: any) => void
  rerunningStep: number | null
  loadExecutionSteps: (jobData: any, isPolling: boolean) => Promise<void>
}

/**
 * Hook to manage polling for job status and execution steps updates
 * 
 * Features:
 * - Polls for job status updates when job is processing
 * - Polls for execution steps updates
 * - Handles rerun polling state
 * - Cleans up intervals on unmount or jobId change
 * 
 * @param params - Configuration object with jobId, job, setJob, rerunningStep, and loadExecutionSteps
 */
export function useJobStatus({
  jobId,
  job,
  setJob,
  rerunningStep,
  loadExecutionSteps,
}: UseJobStatusParams) {
  const currentJobRecordId = job?.job_id
  const currentJobStatus = job?.status

  // Poll for job and execution steps updates when job is processing
  // Fixed: Properly include jobId in dependencies and use useCallback for loadExecutionSteps (Bug 1.3, 4.2 fix)
  useEffect(() => {
    if (!currentJobRecordId || !jobId) {
      return
    }

    // Poll if job is processing OR if a step is being rerun (Bug 2.5, 3.2 fix)
    const shouldPoll = currentJobStatus === 'processing' || rerunningStep !== null
    if (!shouldPoll) {
      return
    }

    // Poll every 3 seconds for updates
    const pollInterval = setInterval(async () => {
      try {
        // Refresh job status and execution steps
        const data = await withOwnCustomerId(() => api.getJob(jobId))
        
        // Update job status and execution steps atomically (Bug 4.1 fix)
        setJob((prevJob: any) => {
          // Only update if this is still the current job
          if (prevJob?.job_id !== data.job_id) {
            return prevJob
          }
          return {
            ...prevJob,
            status: data.status,
            updated_at: data.updated_at,
            execution_steps: data.execution_steps || prevJob.execution_steps,
          }
        })
        
        // Load execution steps through API (polling mode)
        await loadExecutionSteps(data, true)
        
        // If rerun completed (step has output and job is no longer processing), clear rerun state (Bug 3.3 fix)
        // Note: This is handled in useJobActions, but we check here too for the main polling loop
        if (rerunningStep !== null && data.status !== 'processing') {
          const steps = data.execution_steps || []
          const rerunStepOrder = rerunningStep + 1
          const rerunStep = steps.find((s: any) => s.step_order === rerunStepOrder)
          if (rerunStep && rerunStep.output !== null && rerunStep.output !== undefined && rerunStep.output !== '') {
            // Rerun completed - state will be cleared by useJobActions polling
          }
        }
      } catch (err) {
        // Silently fail during polling - don't spam console
        if (process.env.NODE_ENV === 'development') {
          console.warn('Polling error:', err)
        }
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [currentJobRecordId, currentJobStatus, jobId, rerunningStep, loadExecutionSteps, setJob])
}

