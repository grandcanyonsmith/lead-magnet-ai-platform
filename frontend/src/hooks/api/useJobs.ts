/**
 * Data fetching hooks for jobs
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Job, JobListParams, JobListResponse, JobResubmitResponse } from '@/types'

interface UseJobsResult {
  jobs: Job[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useJobs(params?: JobListParams): UseJobsResult {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.getJobs(params)
      setJobs(response.jobs || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load jobs'
      setError(errorMessage)
      console.error('Failed to load jobs:', err)
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  return {
    jobs,
    loading,
    error,
    refetch: fetchJobs,
  }
}

interface UseJobResult {
  job: Job | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useJob(id: string | null): UseJobResult {
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchJob = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await api.getJob(id)
      setJob(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load job'
      setError(errorMessage)
      console.error('Failed to load job:', err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchJob()
  }, [fetchJob])

  return {
    job,
    loading,
    error,
    refetch: fetchJob,
  }
}

interface UseJobsPollingOptions {
  enabled?: boolean
  interval?: number
  filter?: (job: Job) => boolean
}

export function useJobsPolling(
  params?: JobListParams,
  options: UseJobsPollingOptions = {}
): UseJobsResult {
  const { enabled = true, interval = 5000, filter } = options
  const result = useJobs(params)

  useEffect(() => {
    if (!enabled || !result.jobs.length) return

    const hasProcessingJobs = filter
      ? result.jobs.some(filter)
      : result.jobs.some(job => job.status === 'processing' || job.status === 'pending')

    if (!hasProcessingJobs) return

    const pollInterval = setInterval(() => {
      result.refetch()
    }, interval)

    return () => clearInterval(pollInterval)
  }, [enabled, interval, result.jobs, result.refetch, filter])

  return result
}

interface UseResubmitJobResult {
  resubmitJob: (jobId: string) => Promise<JobResubmitResponse | null>
  loading: boolean
  error: string | null
}

export function useResubmitJob(): UseResubmitJobResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resubmitJob = useCallback(async (jobId: string): Promise<JobResubmitResponse | null> => {
    try {
      setLoading(true)
      setError(null)
      return await api.resubmitJob(jobId)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resubmit job'
      setError(errorMessage)
      console.error('Failed to resubmit job:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    resubmitJob,
    loading,
    error,
  }
}

