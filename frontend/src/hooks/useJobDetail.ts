'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'

/**
 * Hook to manage job detail data loading and resubmission
 */
export function useJobDetail() {
  const router = useRouter()
  const params = useParams()
  
  // Extract job ID from params, or fallback to URL pathname if param is '_' (Vercel rewrite)
  const getJobId = () => {
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
  }
  
  const [jobId, setJobId] = useState<string>(getJobId())
  const [job, setJob] = useState<any>(null)
  const [workflow, setWorkflow] = useState<any>(null)
  const [submission, setSubmission] = useState<any>(null)
  const [form, setForm] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resubmitting, setResubmitting] = useState(false)
  const [rerunningStep, setRerunningStep] = useState<number | null>(null)
  
  // Update jobId when params change (for client-side navigation)
  useEffect(() => {
    const newJobId = getJobId()
    if (newJobId && newJobId !== jobId && newJobId.trim() !== '' && newJobId !== '_') {
      setJobId(newJobId)
    }
  }, [params?.id, jobId])
  
  useEffect(() => {
    if (jobId && jobId.trim() !== '' && jobId !== '_') {
      loadJob()
    } else if (!jobId || jobId.trim() === '' || jobId === '_') {
      setError('Invalid job ID. Please select a job from the list.')
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  // Poll for job and execution steps updates when job is processing
  useEffect(() => {
    if (!job || job.status !== 'processing') {
      return
    }

    // Poll every 3 seconds for updates
    const pollInterval = setInterval(async () => {
      try {
        // Refresh job status and execution steps
        const data = await api.getJob(jobId)
        
        // Update job status
        setJob((prevJob: any) => ({
          ...prevJob,
          status: data.status,
          updated_at: data.updated_at,
        }))
        
        // Load execution steps if URL is available
        if (data.execution_steps_s3_url) {
          await loadExecutionSteps(data)
        }
      } catch (err) {
        // Silently fail during polling - don't spam console
        if (process.env.NODE_ENV === 'development') {
          console.warn('Polling error:', err)
        }
      }
    }, 3000)

    return () => clearInterval(pollInterval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status, job?.execution_steps_s3_url, jobId])

  // Load execution steps from S3 (can be called independently for polling)
  const loadExecutionSteps = async (jobData?: any) => {
    const data = jobData || job
    if (!data) return

    // Execution steps are ALWAYS stored in S3 (never in DynamoDB).
    // Fetch execution steps from S3 using the provided URL.
    if (data.execution_steps_s3_url) {
      try {
        // Add cache-busting query parameter to ensure we get fresh data during polling
        const url = new URL(data.execution_steps_s3_url)
        url.searchParams.set('_t', Date.now().toString())
        
        const response = await fetch(url.toString())
        if (response.ok) {
          const executionSteps = await response.json()
          
          // Only update if we got valid data
          if (Array.isArray(executionSteps)) {
            setJob((prevJob: any) => ({
              ...prevJob,
              execution_steps: executionSteps,
            }))
            if (process.env.NODE_ENV === 'development') {
              console.log(`Loaded execution_steps from S3 for job ${jobId}`, {
                stepsCount: executionSteps.length,
              })
            }
          }
        } else if (response.status === 404) {
          // S3 file doesn't exist yet (job just started) - this is normal
          if (process.env.NODE_ENV === 'development') {
            console.log(`Execution steps not yet available in S3 for job ${jobId}`)
          }
        } else {
          // Don't overwrite existing steps if fetch fails during polling
          if (!jobData) {
            console.warn(`Failed to fetch execution_steps from S3 for job ${jobId}`, {
              status: response.status,
              statusText: response.statusText,
            })
          }
        }
      } catch (err) {
        // Don't overwrite existing steps if fetch fails during polling
        if (!jobData) {
          console.error(`Error fetching execution_steps from S3 for job ${jobId}:`, err)
        }
      }
    }
  }

  const loadJob = async () => {
    try {
      const data = await api.getJob(jobId)
      
      // Load execution steps from S3
      if (data.execution_steps_s3_url) {
        try {
          const response = await fetch(data.execution_steps_s3_url)
          if (response.ok) {
            const executionSteps = await response.json()
            data.execution_steps = executionSteps
            if (process.env.NODE_ENV === 'development') {
              console.log(`Loaded execution_steps from S3 for job ${jobId}`, {
                stepsCount: Array.isArray(executionSteps) ? executionSteps.length : 0,
              })
            }
          } else {
            console.warn(`Failed to fetch execution_steps from S3 for job ${jobId}`, {
              status: response.status,
              statusText: response.statusText,
            })
            // Set empty array if fetch fails
            data.execution_steps = []
          }
        } catch (err) {
          console.error(`Error fetching execution_steps from S3 for job ${jobId}:`, err)
          // Set empty array if fetch fails
          data.execution_steps = []
        }
      } else {
        // No S3 URL means no execution steps yet (job may still be processing)
        data.execution_steps = []
      }
      
      setJob(data)
      
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
    } catch (error: any) {
      console.error('Failed to load job:', error)
      setError(error.response?.data?.message || error.message || 'Failed to load lead magnet')
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }

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

  const handleRerunStep = async (stepIndex: number) => {
    setRerunningStep(stepIndex)
    setError(null)

    try {
      await api.rerunStep(jobId, stepIndex)
      // Reload job data after a short delay to see the update
      setTimeout(() => {
        loadJob()
      }, 2000)
    } catch (error: any) {
      console.error('Failed to rerun step:', error)
      setError(error.response?.data?.message || error.message || 'Failed to rerun step')
    } finally {
      setRerunningStep(null)
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
  }
}

