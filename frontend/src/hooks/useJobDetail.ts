'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { extractJobId } from '@/utils/jobIdExtraction'

/**
 * Load workflow data by workflow ID
 * 
 * @param workflowId - Workflow ID to load
 * @param setWorkflow - State setter for workflow
 */
async function loadWorkflowData(workflowId: string, setWorkflow: (data: any) => void): Promise<void> {
  try {
    const workflowData = await api.getWorkflow(workflowId)
    setWorkflow(workflowData)
  } catch (err) {
    console.error('Failed to load workflow:', err)
    // Continue without workflow data
  }
}

/**
 * Load submission and associated form data
 * 
 * @param submissionId - Submission ID to load
 * @param setSubmission - State setter for submission
 * @param setForm - State setter for form
 */
async function loadSubmissionData(
  submissionId: string,
  setSubmission: (data: any) => void,
  setForm: (data: any) => void
): Promise<void> {
  try {
    const submissionData = await api.getSubmission(submissionId)
    setSubmission(submissionData)
    
    if (submissionData.form_id) {
      try {
        const formData = await api.getForm(submissionData.form_id)
        setForm(formData)
      } catch (err) {
        console.error('Failed to load form:', err)
        // Continue without form data
      }
    }
  } catch (err) {
    console.error('Failed to load submission:', err)
    // Continue without submission data
  }
}

/**
 * Hook to manage job detail data loading and resubmission
 * 
 * Features:
 * - Loads job data, execution steps, workflow, submission, and form
 * - Polls for updates when job is processing
 * - Handles job resubmission
 * - Manages step rerun functionality
 * 
 * @returns Job detail state and handlers
 */
export function useJobDetail() {
  const router = useRouter()
  const params = useParams()
  
  const [jobId, setJobId] = useState<string>(() => extractJobId(params))
  const [job, setJob] = useState<any>(null)
  const [workflow, setWorkflow] = useState<any>(null)
  const [submission, setSubmission] = useState<any>(null)
  const [form, setForm] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resubmitting, setResubmitting] = useState(false)
  const [rerunningStep, setRerunningStep] = useState<number | null>(null)
  const [executionStepsError, setExecutionStepsError] = useState<string | null>(null)
  
  // Refs to track rerun polling intervals for cleanup
  const rerunPollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const rerunReloadTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Cleanup rerun intervals when jobId changes or component unmounts
  useEffect(() => {
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

  // Update jobId when params change (for client-side navigation)
  useEffect(() => {
    const newJobId = extractJobId(params)
    if (newJobId && newJobId !== jobId && newJobId.trim() !== '' && newJobId !== '_') {
      // Clear stale state when job changes (Bug 1.2 fix)
      // Cleanup rerun intervals
      if (rerunPollIntervalRef.current) {
        clearInterval(rerunPollIntervalRef.current)
        rerunPollIntervalRef.current = null
      }
      if (rerunReloadTimeoutRef.current) {
        clearTimeout(rerunReloadTimeoutRef.current)
        rerunReloadTimeoutRef.current = null
      }
      setJob(null)
      setWorkflow(null)
      setSubmission(null)
      setForm(null)
      setRerunningStep(null)
      setExecutionStepsError(null)
      setJobId(newJobId)
    }
  }, [params?.id, jobId, params])
  
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
      const executionSteps = await api.getExecutionSteps(jobId)
      
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

  // Poll for job and execution steps updates when job is processing
  // Fixed: Properly include jobId in dependencies and use useCallback for loadExecutionSteps (Bug 1.3, 4.2 fix)
  useEffect(() => {
    if (!job || !jobId) {
      return
    }

    // Poll if job is processing OR if a step is being rerun (Bug 2.5, 3.2 fix)
    const shouldPoll = job.status === 'processing' || rerunningStep !== null
    if (!shouldPoll) {
      return
    }

    // Poll every 3 seconds for updates
    const pollInterval = setInterval(async () => {
      try {
        // Refresh job status and execution steps
        const data = await api.getJob(jobId)
        
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
        if (rerunningStep !== null && data.status !== 'processing') {
          const steps = data.execution_steps || []
          const rerunStepOrder = rerunningStep + 1
          const rerunStep = steps.find((s: any) => s.step_order === rerunStepOrder)
          if (rerunStep && rerunStep.output !== null && rerunStep.output !== undefined && rerunStep.output !== '') {
            setRerunningStep(null)
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
  }, [job?.status, jobId, rerunningStep, loadExecutionSteps])

  /**
   * Load job data and all related resources (execution steps, workflow, submission, form)
   */
  const loadJob = async () => {
    try {
      const data = await api.getJob(jobId)
      
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
  }

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

