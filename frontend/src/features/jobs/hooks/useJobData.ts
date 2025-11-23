'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/shared/lib/api'
import { withOwnCustomerId, loadWorkflowData, loadSubmissionData } from './jobDataUtils'

interface UseJobDataParams {
  jobId: string
  onJobIdChange?: () => void
}

/**
 * Hook to manage job data loading and related resources
 * 
 * Features:
 * - Loads job data, execution steps, workflow, submission, and form
 * - Handles loading and error states
 * - Provides loadJob function for manual reloads
 * 
 * @param params - Configuration object with jobId and optional onJobIdChange callback
 * @returns Job data state and loadJob function
 */
export function useJobData({ jobId, onJobIdChange }: UseJobDataParams) {
  const [job, setJob] = useState<any>(null)
  const [workflow, setWorkflow] = useState<any>(null)
  const [submission, setSubmission] = useState<any>(null)
  const [form, setForm] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [executionStepsError, setExecutionStepsError] = useState<string | null>(null)

  // Clear state when jobId changes
  useEffect(() => {
    if (onJobIdChange) {
      onJobIdChange()
    }
    setJob(null)
    setWorkflow(null)
    setSubmission(null)
    setForm(null)
    setExecutionStepsError(null)
  }, [jobId, onJobIdChange])

  /**
   * Load execution steps from API (proxied from S3)
   * Consolidated logic used by both loadJob and polling
   * 
   * @param jobData - Job data object (required, always passed by callers)
   * @param isPolling - Whether this is a polling update (affects error handling)
   */
  const loadExecutionSteps = useCallback(async (jobData: any, isPolling: boolean = false) => {
    if (!jobData || !jobId) return
    const data = jobData

    try {
      const executionSteps = await withOwnCustomerId(() => api.getExecutionSteps(jobId))
      
      // Only update if we got valid data and this is still the current job (Bug 4.1 fix)
      if (Array.isArray(executionSteps)) {
        if (isPolling) {
          // During polling, update job state atomically
          setJob((prevJob: any) => {
            // Only update if this is still the current job
            if (prevJob?.job_id !== data.job_id) {
              return prevJob
            }
            return {
              ...prevJob,
              execution_steps: executionSteps,
            }
          })
        } else {
          // During initial load, attach to data object
          data.execution_steps = executionSteps
        }
        setExecutionStepsError(null)
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Loaded execution_steps from API for job ${jobId}`, {
            stepsCount: executionSteps.length,
          })
        }
      } else {
        const errorMsg = `Invalid execution steps data format: expected array, got ${typeof executionSteps}`
        console.error(`❌ ${errorMsg} for job ${jobId}`)
        if (!isPolling) {
          setExecutionStepsError(errorMsg)
          data.execution_steps = []
        }
      }
    } catch (err: any) {
      // Handle errors gracefully - execution steps may not exist yet
      if (err.response?.status === 404 || err.message?.includes('not found')) {
        // Execution steps may not have been created yet (job still processing)
        if (process.env.NODE_ENV === 'development' && !isPolling) {
          console.log(`ℹ️ No execution_steps for job ${jobId} - steps may not be created yet`)
        }
        if (!isPolling) {
          setExecutionStepsError(null)
          data.execution_steps = []
        }
      } else {
        let errorMsg = `Error fetching execution steps: ${err.response?.data?.message || err.message || 'Unknown error'}`
        if (data?.execution_steps_s3_key) {
          errorMsg += ` (S3 Key: ${data.execution_steps_s3_key})`
        }
        console.error(`❌ ${errorMsg} for job ${jobId}`, {
          error: err,
          response: err.response,
        })
        if (!isPolling) {
          setExecutionStepsError(errorMsg)
          data.execution_steps = []
        }
      }
    }
  }, [jobId])

  /**
   * Load job data and all related resources (execution steps, workflow, submission, form)
   */
  const loadJob = useCallback(async () => {
    try {
      const data = await withOwnCustomerId(() => api.getJob(jobId))
      
      // Load execution steps from API (proxied from S3)
      await loadExecutionSteps(data, false)
      
      setJob(data)
      
      // Load related data in parallel
      const promises: Promise<void>[] = []
      if (data.workflow_id) {
        promises.push(loadWorkflowData(data.workflow_id, setWorkflow))
      }
      if (data.submission_id) {
        promises.push(loadSubmissionData(data.submission_id, setSubmission, setForm))
      }
      await Promise.allSettled(promises)
      
      setError(null)
    } catch (error: any) {
      console.error('Failed to load job:', error)
      setError(error.response?.data?.message || error.message || 'Failed to load lead magnet')
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }, [jobId, loadExecutionSteps])

  // Load job data when jobId changes
  useEffect(() => {
    if (jobId && jobId.trim() !== '' && jobId !== '_') {
      loadJob()
    } else if (!jobId || jobId.trim() === '' || jobId === '_') {
      setError('Invalid job ID. Please select a job from the list.')
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  return {
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
  }
}

