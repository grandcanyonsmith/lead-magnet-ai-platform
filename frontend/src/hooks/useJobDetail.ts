'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { Job } from '@/types/job'
import { Workflow } from '@/types/workflow'
import { FormSubmission } from '@/types/form'
import { Form } from '@/types/form'
import toast from 'react-hot-toast'

/**
 * Hook to manage job detail data loading and resubmission
 */
export function useJobDetail() {
  const router = useRouter()
  const params = useParams()
  
  // Extract job ID from params, or fallback to URL pathname if param is '_' (Vercel rewrite)
  const getJobId = useCallback(() => {
    // First try to get from params
    const paramId = params?.id as string
    if (paramId && paramId !== '_' && paramId.trim() !== '') {
      return paramId
    }
    // Fallback: extract from browser URL (works for static exports and direct navigation)
    if (typeof window !== 'undefined') {
      const pathMatch = window.location.pathname.match(/\/dashboard\/jobs\/([^/?#]+)/)
      if (pathMatch && pathMatch[1] && pathMatch[1] !== '_' && pathMatch[1].trim() !== '') {
        return pathMatch[1]
      }
      // Also check hash in case of SPA routing
      const hashMatch = window.location.hash.match(/\/dashboard\/jobs\/([^/?#]+)/)
      if (hashMatch && hashMatch[1] && hashMatch[1] !== '_' && hashMatch[1].trim() !== '') {
        return hashMatch[1]
      }
    }
    return paramId || ''
  }, [params?.id])
  
  const [jobId, setJobId] = useState<string>(() => {
    const paramId = params?.id as string
    if (paramId && paramId !== '_' && paramId.trim() !== '') {
      return paramId
    }
    if (typeof window !== 'undefined') {
      const pathMatch = window.location.pathname.match(/\/dashboard\/jobs\/([^/?#]+)/)
      if (pathMatch && pathMatch[1] && pathMatch[1] !== '_' && pathMatch[1].trim() !== '') {
        return pathMatch[1]
      }
      const hashMatch = window.location.hash.match(/\/dashboard\/jobs\/([^/?#]+)/)
      if (hashMatch && hashMatch[1] && hashMatch[1] !== '_' && hashMatch[1].trim() !== '') {
        return hashMatch[1]
      }
    }
    return paramId || ''
  })
  const [job, setJob] = useState<Job | null>(null)
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [submission, setSubmission] = useState<FormSubmission | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resubmitting, setResubmitting] = useState(false)
  const [rerunningStep, setRerunningStep] = useState<number | null>(null)
  const [executionStepsError, setExecutionStepsError] = useState<string | null>(null)
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null)
  
  // Load execution steps from API (proxied from S3)
  const loadExecutionSteps = useCallback(async (jobData?: Job) => {
    const data = jobData || job
    if (!data) return

    // Fetch execution steps through the API endpoint (which proxies from S3)
    // This avoids presigned URL expiration issues
    try {
      const executionSteps = await api.getExecutionSteps(jobId)
      
      // Only update if we got valid data
      if (Array.isArray(executionSteps)) {
        setJob((prevJob) => {
          if (!prevJob) return prevJob
          return {
            ...prevJob,
            execution_steps: executionSteps,
          }
        })
        setExecutionStepsError(null) // Clear any previous errors
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Loaded execution_steps from API for job ${jobId}`, {
            stepsCount: executionSteps.length,
          })
        }
      } else {
        const errorMsg = `Invalid execution steps data format: expected array, got ${typeof executionSteps}`
        console.error(`❌ ${errorMsg} for job ${jobId}`)
        if (!jobData) {
          setExecutionStepsError(errorMsg)
        }
      }
    } catch (err: unknown) {
      // Don't overwrite existing steps if fetch fails during polling
      const error = err as { response?: { data?: { message?: string } }; message?: string }
      let errorMsg = `Error fetching execution steps: ${error.response?.data?.message || error.message || 'Unknown error'}`
      if (data?.execution_steps_s3_key) {
        errorMsg += ` (S3 Key: ${data.execution_steps_s3_key})`
      }
      console.error(`❌ ${errorMsg} for job ${jobId}`, {
        error: err,
        response: error.response,
      })
      if (!jobData) {
        setExecutionStepsError(errorMsg)
      }
    }
  }, [jobId, job])

  // Load job data
  const loadJob = useCallback(async () => {
    try {
      const data = await api.getJob(jobId)
      
      // Load execution steps from API (proxied from S3)
      try {
        const executionSteps = await api.getExecutionSteps(jobId)
        if (Array.isArray(executionSteps)) {
          data.execution_steps = executionSteps
          setExecutionStepsError(null)
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ Loaded execution_steps from API for job ${jobId}`, {
              stepsCount: executionSteps.length,
            })
          }
        } else {
          const errorMsg = `Invalid execution steps data format: expected array, got ${typeof executionSteps}`
          console.error(`❌ ${errorMsg} for job ${jobId}`)
          setExecutionStepsError(errorMsg)
          data.execution_steps = []
        }
      } catch (err: unknown) {
        // Handle errors gracefully - execution steps may not exist yet
        const error = err as { response?: { status?: number }; message?: string }
        if (error.response?.status === 404 || error.message?.includes('not found')) {
          // Execution steps may not have been created yet (job still processing)
          if (process.env.NODE_ENV === 'development') {
            console.log(`ℹ️ No execution_steps for job ${jobId} - steps may not be created yet`)
          }
          setExecutionStepsError(null)
          data.execution_steps = []
        } else {
          const error = err as { response?: { data?: { message?: string } }; message?: string }
          let errorMsg = `Error fetching execution steps: ${error.response?.data?.message || error.message || 'Unknown error'}`
          if (data?.execution_steps_s3_key) {
            errorMsg += ` (S3 Key: ${data.execution_steps_s3_key})`
          }
          console.error(`❌ ${errorMsg} for job ${jobId}`, {
            error: err,
            response: error.response,
          })
          setExecutionStepsError(errorMsg)
          data.execution_steps = []
        }
      }
      
      setJob(data)
      setLastLoadedAt(new Date())
      
      // Load workflow details if workflow_id exists
      if (data.workflow_id) {
        try {
          const workflowData = await api.getWorkflow(data.workflow_id)
          setWorkflow(workflowData)
        } catch (err) {
          console.error('Failed to load workflow:', err)
          // Continue without workflow data
        }
      }
      
      // Load submission details if submission_id exists
      if (data.submission_id) {
        try {
          const submissionData = await api.getSubmission(data.submission_id)
          setSubmission(submissionData)
          
          // Load form details if form_id exists
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
      
      setError(null)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string }
      console.error('Failed to load job:', error)
      setError(err.response?.data?.message || err.message || 'Failed to load lead magnet')
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }, [jobId])

  const refreshJob = useCallback(async () => {
    setRefreshing(true)
    try {
      await loadJob()
    } finally {
      setRefreshing(false)
    }
  }, [loadJob])

  // Update jobId when params change (for client-side navigation)
  useEffect(() => {
    const newJobId = getJobId()
    setJobId((currentJobId) => {
      if (newJobId && newJobId !== currentJobId && newJobId.trim() !== '' && newJobId !== '_') {
        return newJobId
      }
      return currentJobId
    })
  }, [params?.id, getJobId])
  
  useEffect(() => {
    if (jobId && jobId.trim() !== '' && jobId !== '_') {
      loadJob()
    } else if (!jobId || jobId.trim() === '' || jobId === '_') {
      setError('Invalid job ID. Please select a job from the list.')
      setLoading(false)
    }
  }, [jobId, loadJob])

  // Poll for job and execution steps updates when job is processing or when rerunning a step
  useEffect(() => {
    const shouldPoll = job && (job.status === 'processing' || rerunningStep !== null)
    if (!shouldPoll) {
      return
    }

    // Poll every 3 seconds for updates
    const pollInterval = setInterval(async () => {
      try {
        // Refresh job status and execution steps
        const data = await api.getJob(jobId)
        
        // Update job status
        setJob((prevJob) => {
          if (!prevJob) return prevJob
          return {
            ...prevJob,
            status: data.status,
            updated_at: data.updated_at,
          }
        })
        
        // Load execution steps through API
        await loadExecutionSteps(data)
        
        // If we were rerunning a step and job is no longer processing, clear the rerunning state
        if (rerunningStep !== null && data.status !== 'processing') {
          setRerunningStep(null)
        }
      } catch (err) {
        // Silently fail during polling - don't spam console
        if (process.env.NODE_ENV === 'development') {
          console.warn('Polling error:', err)
        }
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [job?.status, jobId, loadExecutionSteps, rerunningStep, job])

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
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string }
      console.error('Failed to resubmit job:', error)
      setError(err.response?.data?.message || err.message || 'Failed to resubmit job')
    } finally {
      setResubmitting(false)
    }
  }

  const handleRerunStep = async (stepIndex: number) => {
    setRerunningStep(stepIndex)
    setError(null)

    try {
      console.log(`[useJobDetail] Rerunning step ${stepIndex} for job ${jobId}`)
      const result = await api.rerunStep(jobId, stepIndex)
      console.log('[useJobDetail] Rerun step response:', result)
      
      toast.success(`Step ${stepIndex + 1} rerun initiated. The step will be reprocessed shortly.`)
      
      // Reload job data after a short delay to see the update
      setTimeout(() => {
        loadJob()
      }, 2000)
      
      // Continue polling to see the step update
      // The existing polling useEffect will handle this
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string }
      const errorMessage = err.response?.data?.message || err.message || 'Failed to rerun step'
      console.error('[useJobDetail] Failed to rerun step:', error)
      setError(errorMessage)
      toast.error(`Failed to rerun step: ${errorMessage}`)
    } finally {
      // Don't clear rerunningStep immediately - keep it set until we see the step update
      // This will be cleared when the step status changes
      setTimeout(() => {
        setRerunningStep(null)
      }, 5000)
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
    refreshJob,
    refreshing,
    lastLoadedAt,
  }
}

