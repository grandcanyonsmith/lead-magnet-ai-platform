'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/shared/lib/api'

interface UseJobActionsParams {
  jobId: string
  job: any
  setJob: (job: any) => void
  setError: (error: string | null) => void
  loadJob: () => Promise<void>
}

/**
 * Hook to manage job actions (resubmit and rerun step)
 * 
 * Features:
 * - Handles job resubmission
 * - Handles step rerun with polling
 * - Manages rerun polling intervals
 * - Updates job state optimistically during rerun
 * 
 * @param params - Configuration object with jobId, job, setJob, setError, and loadJob
 * @returns Action handlers and state
 */
export function useJobActions({
  jobId,
  job,
  setJob,
  setError,
  loadJob,
}: UseJobActionsParams) {
  const router = useRouter()
  const [resubmitting, setResubmitting] = useState(false)
  const [rerunningStep, setRerunningStep] = useState<number | null>(null)
  
  // Refs to track rerun polling intervals for cleanup
  const rerunPollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const rerunReloadTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup rerun intervals and reset state when jobId changes or component unmounts
  useEffect(() => {
    // Clear rerun state when jobId changes
    setRerunningStep(null)
    
    return () => {
      if (rerunPollIntervalRef.current) {
        clearInterval(rerunPollIntervalRef.current)
        rerunPollIntervalRef.current = null
      }
      if (rerunReloadTimeoutRef.current) {
        clearTimeout(rerunReloadTimeoutRef.current)
        rerunReloadTimeoutRef.current = null
      }
    }
  }, [jobId])

  /**
   * Resubmit job with the same submission data
   * Creates a new job and redirects to it
   */
  const handleResubmit = async () => {
    setResubmitting(true)
    setError(null)

    try {
      const result = await api.resubmitJob(jobId)
      // Redirect to the new job - use window.location for static export compatibility
      if (typeof window !== 'undefined') {
        window.location.href = `/dashboard/jobs/${result.job_id}`
      } else {
        router.push(`/dashboard/jobs/${result.job_id}`)
      }
    } catch (error: any) {
      console.error('Failed to resubmit job:', error)
      setError(error.response?.data?.message || error.message || 'Failed to resubmit job')
    } finally {
      setResubmitting(false)
    }
  }

  /**
   * Rerun a specific step in the job execution
   * 
   * @param stepIndex - Zero-based index of the step to rerun
   */
  const handleRerunStep = async (stepIndex: number) => {
    // Prevent multiple simultaneous reruns (Bug 3.5 fix)
    if (rerunningStep !== null) {
      return
    }

    // Cleanup any existing intervals
    if (rerunPollIntervalRef.current) {
      clearInterval(rerunPollIntervalRef.current)
      rerunPollIntervalRef.current = null
    }
    if (rerunReloadTimeoutRef.current) {
      clearTimeout(rerunReloadTimeoutRef.current)
      rerunReloadTimeoutRef.current = null
    }

    setRerunningStep(stepIndex)
    setError(null)

    try {
      await api.rerunStep(jobId, stepIndex)
      
      // Immediately update job status to processing if it was completed (Bug 2.5 fix)
      setJob((prevJob: any) => {
        if (!prevJob || prevJob.job_id !== jobId) {
          return prevJob
        }
        // If job was completed, mark as processing to trigger polling
        if (prevJob.status === 'completed') {
          return {
            ...prevJob,
            status: 'processing',
          }
        }
        return prevJob
      })

      // Mark the step as in progress by clearing its output temporarily (Bug 2.6 fix)
      setJob((prevJob: any) => {
        if (!prevJob || prevJob.job_id !== jobId) {
          return prevJob
        }
        const stepOrder = stepIndex + 1
        const executionSteps = prevJob.execution_steps || []
        const updatedSteps = executionSteps.map((step: any) => {
          if (step.step_order === stepOrder) {
            // Clear output to show step as in progress
            return {
              ...step,
              output: null,
              error: null,
            }
          }
          return step
        })
        return {
          ...prevJob,
          execution_steps: updatedSteps,
        }
      })

      // Start polling check to detect when rerun completes (Bug 2.2, 3.3 fix)
      let pollCount = 0
      const maxPollAttempts = 60 // 3 minutes max (3 second intervals)
      
      rerunPollIntervalRef.current = setInterval(async () => {
        try {
          const data = await api.getJob(jobId)
          const steps = data.execution_steps || []
          const stepOrder = stepIndex + 1
          const rerunStep = steps.find((s: any) => s.step_order === stepOrder)
          
          // Check if rerun completed (has output) or job failed
          if (rerunStep && (rerunStep.output !== null && rerunStep.output !== undefined && rerunStep.output !== '') || data.status === 'failed') {
            // Reload full job data to get updated execution steps
            await loadJob()
            setRerunningStep(null)
            if (rerunPollIntervalRef.current) {
              clearInterval(rerunPollIntervalRef.current)
              rerunPollIntervalRef.current = null
            }
          } else if (pollCount >= maxPollAttempts) {
            // Timeout - reload anyway and clear rerun state
            await loadJob()
            setRerunningStep(null)
            if (rerunPollIntervalRef.current) {
              clearInterval(rerunPollIntervalRef.current)
              rerunPollIntervalRef.current = null
            }
          }
          pollCount++
        } catch (err) {
          // On error, just reload and clear state (Bug 3.1 fix)
          if (process.env.NODE_ENV === 'development') {
            console.warn('Rerun polling error:', err)
          }
          await loadJob()
          setRerunningStep(null)
          if (rerunPollIntervalRef.current) {
            clearInterval(rerunPollIntervalRef.current)
            rerunPollIntervalRef.current = null
          }
        }
      }, 3000)

      // Also reload after initial delay as fallback (Bug 2.2 fix)
      rerunReloadTimeoutRef.current = setTimeout(async () => {
        await loadJob()
        rerunReloadTimeoutRef.current = null
      }, 2000)
    } catch (error: any) {
      console.error('Failed to rerun step:', error)
      setError(error.response?.data?.message || error.message || 'Failed to rerun step')
      setRerunningStep(null) // Clear on error (Bug 3.1 fix)
    }
  }

  return {
    resubmitting,
    handleResubmit,
    rerunningStep,
    handleRerunStep,
  }
}

