/**
 * Data fetching hooks for jobs using React Query
 */

'use client'

import { useMemo } from 'react'
import { useQuery } from '@/shared/hooks/useQuery'
import { useMutation } from '@/shared/hooks/useMutation'
import { api } from '@/shared/lib/api'
import { Job, JobListParams, JobListResponse, JobResubmitResponse } from '@/shared/types'
import { normalizeError, extractListData } from '@/shared/hooks/hookHelpers'

// Query keys factory
export const jobKeys = {
  all: ['jobs'] as const,
  lists: () => [...jobKeys.all, 'list'] as const,
  list: (params?: JobListParams) => [...jobKeys.lists(), params] as const,
  details: () => [...jobKeys.all, 'detail'] as const,
  detail: (id: string) => [...jobKeys.details(), id] as const,
  executionSteps: (id: string) => [...jobKeys.detail(id), 'execution-steps'] as const,
}

interface UseJobsResult {
  jobs: Job[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useJobs(params?: JobListParams): UseJobsResult {
  const queryKey = useMemo(() => jobKeys.list(params), [params])
  
  const { data, isLoading, error, refetch } = useQuery<JobListResponse>(
    queryKey,
    () => api.getJobs(params),
    {
      enabled: true,
    }
  )

  return {
    jobs: data?.jobs || [],
    loading: isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    refetch: () => refetch(),
  }
}

interface UseJobResult {
  job: Job | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useJob(id: string | null): UseJobResult {
  const queryKey = useMemo(() => (id ? jobKeys.detail(id) : ['jobs', 'detail', null]), [id])
  
  const { data, isLoading, error, refetch } = useQuery<Job>(
    queryKey,
    () => {
      if (!id) throw new Error('Job ID is required')
      return api.getJob(id)
    },
    {
      enabled: !!id,
    }
  )

  return {
    job: data || null,
    loading: isLoading,
    error: normalizeError(error),
    refetch: () => refetch(),
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
  const queryKey = useMemo(() => jobKeys.list(params), [params])
  
  const { data, isLoading, error, refetch } = useQuery<JobListResponse>(
    queryKey,
    () => api.getJobs(params),
    {
      enabled,
      refetchInterval: (query) => {
        if (!enabled) return false
        
        const jobs = query.state.data?.jobs || []
        if (!jobs.length) return false
        
        const hasProcessingJobs = filter
          ? jobs.some(filter)
          : jobs.some(job => job.status === 'processing' || job.status === 'pending')
        
        return hasProcessingJobs ? interval : false
      },
    }
  )

  return {
    jobs: data?.jobs ?? [],
    loading: isLoading,
    error: normalizeError(error),
    refetch: () => refetch(),
  }
}

interface UseResubmitJobResult {
  resubmitJob: (jobId: string) => Promise<JobResubmitResponse | null>
  loading: boolean
  error: string | null
}

export function useResubmitJob(): UseResubmitJobResult {
  const { mutateAsync, isPending, error } = useMutation<JobResubmitResponse, Error, string>(
    (jobId: string) => api.resubmitJob(jobId),
    {
      showSuccessToast: 'Job resubmitted successfully',
      showErrorToast: true,
      invalidateQueries: [jobKeys.all],
    }
  )

  return {
    resubmitJob: async (jobId: string) => {
      try {
        return await mutateAsync(jobId)
      } catch {
        return null
      }
    },
    loading: isPending,
    error: normalizeError(error),
  }
}

