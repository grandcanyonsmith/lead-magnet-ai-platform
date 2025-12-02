'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import type { Job } from '@/types/job'
import type { Workflow } from '@/types/workflow'
import type { FormSubmission, Form } from '@/types/form'

type RouterInstance = ReturnType<typeof useRouter>

export function useJobDetail() {
  const router = useRouter()
  const jobId = useJobIdentifier()
  const jobResource = useJobResource(jobId, router)
  const execution = useJobExecution({
    jobId,
    job: jobResource.job,
    setJob: jobResource.setJob,
    loadJob: jobResource.loadJob,
  })

  return {
    job: jobResource.job,
    workflow: jobResource.workflow,
    submission: jobResource.submission,
    form: jobResource.form,
    loading: jobResource.loading,
    error: jobResource.error,
    resubmitting: jobResource.resubmitting,
    handleResubmit: jobResource.handleResubmit,
    rerunningStep: execution.rerunningStep,
    handleRerunStep: execution.handleRerunStep,
    executionStepsError: execution.executionStepsError,
    refreshJob: jobResource.refreshJob,
    refreshing: jobResource.refreshing,
    lastLoadedAt: jobResource.lastLoadedAt,
  }
}

function useJobIdentifier() {
  const params = useParams()
  const [jobId, setJobId] = useState<string>(() => resolveJobId(params?.id as string | undefined))

  const getJobId = useCallback(() => resolveJobId(params?.id as string | undefined), [params?.id])

  useEffect(() => {
    const resolved = getJobId()
    setJobId((current) => {
      if (resolved && resolved !== current && resolved !== '_') {
        return resolved
      }
      return current
    })
  }, [getJobId])

  return jobId
}

function resolveJobId(paramId?: string) {
  if (paramId && paramId.trim() !== '' && paramId !== '_') {
    return paramId
  }
  if (typeof window !== 'undefined') {
    const pathMatch = window.location.pathname.match(/\/dashboard\/jobs\/([^/?#]+)/)
    if (pathMatch && pathMatch[1] && pathMatch[1].trim() !== '' && pathMatch[1] !== '_') {
      return pathMatch[1]
    }
    const hashMatch = window.location.hash.match(/\/dashboard\/jobs\/([^/?#]+)/)
    if (hashMatch && hashMatch[1] && hashMatch[1].trim() !== '' && hashMatch[1] !== '_') {
      return hashMatch[1]
    }
  }
  return paramId || ''
}

interface UseJobResourceResult {
  job: Job | null
  setJob: React.Dispatch<React.SetStateAction<Job | null>>
  workflow: Workflow | null
  submission: FormSubmission | null
  form: Form | null
  loading: boolean
  error: string | null
  resubmitting: boolean
  refreshing: boolean
  lastLoadedAt: Date | null
  refreshJob: () => Promise<void>
  handleResubmit: () => Promise<void>
  loadJob: () => Promise<void>
}

export function useJobResource(jobId: string | null, router: RouterInstance): UseJobResourceResult {
  const [job, setJob] = useState<Job | null>(null)
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [submission, setSubmission] = useState<FormSubmission | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resubmitting, setResubmitting] = useState(false)
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null)

  const loadJob = useCallback(async () => {
    if (!jobId || jobId.trim() === '' || jobId === '_') {
      setError('Invalid job ID. Please select a job from the list.')
      setLoading(false)
      return
    }

    try {
      const data = await api.getJob(jobId)
      setJob(data)
      setLastLoadedAt(new Date())

      if (data.workflow_id) {
        try {
          const workflowData = await api.getWorkflow(data.workflow_id)
          setWorkflow(workflowData)
        } catch (err) {
          console.error('Failed to load workflow:', err)
        }
      } else {
        setWorkflow(null)
      }

      if (data.submission_id) {
        try {
          const submissionData = await api.getSubmission(data.submission_id)
          setSubmission(submissionData)

          if (submissionData.form_id) {
            try {
              const formData = await api.getForm(submissionData.form_id)
              setForm(formData)
            } catch (err) {
              console.error('Failed to load form:', err)
              setForm(null)
            }
          } else {
            setForm(null)
          }
        } catch (err) {
          console.error('Failed to load submission:', err)
          setSubmission(null)
          setForm(null)
        }
      } else {
        setSubmission(null)
        setForm(null)
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

  const handleResubmit = useCallback(async () => {
    if (!jobId) {
      toast.error('Job ID is missing')
      return
    }

    setResubmitting(true)
    setError(null)

    try {
      const result = await api.resubmitJob(jobId)
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
  }, [jobId, router])

  useEffect(() => {
    if (jobId && jobId.trim() !== '' && jobId !== '_') {
      loadJob()
    } else {
      setError('Invalid job ID. Please select a job from the list.')
      setLoading(false)
    }
  }, [jobId, loadJob])

  return {
    job,
    setJob,
    workflow,
    submission,
    form,
    loading,
    error,
    resubmitting,
    refreshing,
    lastLoadedAt,
    refreshJob,
    handleResubmit,
    loadJob,
  }
}

interface UseJobExecutionArgs {
  jobId: string | null
  job: Job | null
  setJob: React.Dispatch<React.SetStateAction<Job | null>>
  loadJob: () => Promise<void>
}

interface UseJobExecutionResult {
  executionStepsError: string | null
  rerunningStep: number | null
  handleRerunStep: (stepIndex: number, continueAfter?: boolean) => Promise<void>
}

export function useJobExecution({ jobId, job, setJob, loadJob }: UseJobExecutionArgs): UseJobExecutionResult {
  const [executionStepsError, setExecutionStepsError] = useState<string | null>(null)
  const [rerunningStep, setRerunningStep] = useState<number | null>(null)

  const loadExecutionSteps = useCallback(
    async (jobSnapshot?: Job | null) => {
      if (!jobId) return
      const snapshot = jobSnapshot ?? job
      if (!snapshot) return

      try {
        const executionSteps = await api.getExecutionSteps(jobId)
        if (Array.isArray(executionSteps)) {
          setJob((prevJob) => (prevJob ? { ...prevJob, execution_steps: executionSteps } : prevJob))
          setExecutionStepsError(null)
        } else {
          const errorMsg = `Invalid execution steps data format: expected array, got ${typeof executionSteps}`
          console.error(`❌ ${errorMsg} for job ${jobId}`)
          setExecutionStepsError(errorMsg)
        }
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } }; message?: string }
        let errorMsg = `Error fetching execution steps: ${error.response?.data?.message || error.message || 'Unknown error'}`
        if (snapshot?.execution_steps_s3_key) {
          errorMsg += ` (S3 Key: ${snapshot.execution_steps_s3_key})`
        }
        console.error(`❌ ${errorMsg} for job ${jobId}`, {
          error: err,
          response: error.response,
        })
        setExecutionStepsError(errorMsg)
      }
    },
    [jobId, job, setJob]
  )

  useEffect(() => {
    if (!jobId || !job) {
      return
    }
    if (!job.execution_steps || job.execution_steps.length === 0) {
      loadExecutionSteps(job)
    }
  }, [jobId, job, loadExecutionSteps])

  useEffect(() => {
    if (!job || !jobId) {
      return
    }

    const shouldPoll = job.status === 'processing' || rerunningStep !== null
    if (!shouldPoll) {
      return
    }

    const pollInterval = setInterval(async () => {
      try {
        const data = await api.getJob(jobId)
        setJob((prevJob) => (prevJob ? { ...prevJob, status: data.status, updated_at: data.updated_at } : prevJob))
        await loadExecutionSteps(data)

        if (rerunningStep !== null && data.status !== 'processing') {
          setRerunningStep(null)
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Polling error:', err)
        }
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [job, jobId, loadExecutionSteps, rerunningStep, setJob])

  const handleRerunStep = useCallback(
    async (stepIndex: number, continueAfter: boolean = false) => {
      if (!jobId) {
        toast.error('Job ID is missing')
        return
      }

      setRerunningStep(stepIndex)
      setExecutionStepsError(null)

      try {
        const result = await api.rerunStep(jobId, stepIndex, continueAfter)
        console.log('[useJobExecution] Rerun step response:', result)
        const actionText = continueAfter ? 'rerun and continue' : 'rerun'
        toast.success(`Step ${stepIndex + 1} ${actionText} initiated. The step will be reprocessed shortly.`)

        setTimeout(() => {
          loadJob()
          loadExecutionSteps()
        }, 2000)
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } }; message?: string }
        const errorMessage = err.response?.data?.message || err.message || 'Failed to rerun step'
        console.error('[useJobExecution] Failed to rerun step:', error)
        setExecutionStepsError(errorMessage)
        toast.error(`Failed to rerun step: ${errorMessage}`)
      } finally {
        setTimeout(() => {
          setRerunningStep(null)
        }, 5000)
      }
    },
    [jobId, loadExecutionSteps, loadJob]
  )

  return {
    executionStepsError,
    rerunningStep,
    handleRerunStep,
  }
}
