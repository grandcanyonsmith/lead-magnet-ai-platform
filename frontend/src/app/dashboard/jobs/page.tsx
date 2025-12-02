'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import {
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiLoader,
  FiRefreshCw,
  FiExternalLink,
  FiChevronDown,
  FiChevronUp,
  FiAlertTriangle,
  FiTrendingUp,
  FiBarChart2,
} from 'react-icons/fi'
import { useJobFilters, useJobSorting } from '@/hooks/useJobFilters'
import { JobFiltersProvider } from '@/contexts/JobFiltersContext'

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: 'Queued',
    processing: 'Generating',
    completed: 'Ready',
    failed: 'Error',
  }
  return labels[status] || status
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <FiCheckCircle className="w-5 h-5 text-green-600" />
    case 'failed':
      return <FiXCircle className="w-5 h-5 text-red-600" />
    case 'processing':
      return <FiLoader className="w-5 h-5 text-yellow-600 animate-spin" />
    case 'pending':
      return <FiCheckCircle className="w-5 h-5 text-yellow-600" />
    default:
      return <FiCheckCircle className="w-5 h-5 text-yellow-600" />
  }
}

const getStatusBadge = (status: string) => {
  const colors: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    processing: 'bg-yellow-100 text-yellow-800',
    pending: 'bg-yellow-100 text-yellow-800',
  }
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {getStatusLabel(status)}
    </span>
  )
}

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const formatDuration = (seconds: number) => {
  if (seconds === 0) return 'Instant'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

const getStepProgress = (job: any) => {
  const steps = job.execution_steps || []
  if (steps.length === 0) return null
  
  // For failed jobs, count steps with outputs but cap at failed step
  // For other jobs, count all steps with outputs
  let completedSteps = 0
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const hasOutput = step.output !== null && step.output !== undefined && step.output !== ''
    
    // If this step has explicit failed status, stop counting here
    if (step._status === 'failed' || (job.status === 'failed' && !hasOutput)) {
      break
    }
    
    if (hasOutput) {
      completedSteps++
    }
  }
  
  return { completed: completedSteps, total: steps.length }
}

const getStepDisplayMeta = (
  job: any,
  workflowStepCounts: Record<string, number>
): { label: string | null; isActive: boolean } => {
  const progress = getStepProgress(job)
  const workflowTotal = workflowStepCounts[job.workflow_id]
  const progressTotal = progress?.total && progress.total > 0 ? progress.total : 0
  const totalSteps = workflowTotal || progressTotal || 0
  const isActive = job.status === 'processing' || job.status === 'pending'

  if (totalSteps > 0) {
    if (isActive) {
      const completed = progress?.completed ?? 0
      const current = Math.min(Math.max(completed + 1, 1), totalSteps)
      return { label: `Step ${current}/${totalSteps}`, isActive }
    }
    if (progress) {
      const safeCompleted = Math.min(progress.completed, totalSteps)
      return { label: `Step ${safeCompleted}/${totalSteps}`, isActive }
    }
    return { label: `Step ${totalSteps}/${totalSteps}`, isActive }
  }

  if (progress && progress.total > 0) {
    return { label: `Step ${progress.completed}/${progress.total}`, isActive }
  }

  return { label: null, isActive }
}

export default function JobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<any[]>([])
  const [workflows, setWorkflows] = useState<any[]>([])
  const [workflowMap, setWorkflowMap] = useState<Record<string, string>>({})
  const [workflowStepCounts, setWorkflowStepCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [totalJobs, setTotalJobs] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null)
  
  // Use extracted hooks for filtering and sorting
  const filters = useJobFilters(jobs, workflowMap)
  const sorting = useJobSorting(filters.filteredJobs)

  const statusCounts = useMemo(() => {
    return jobs.reduce(
      (acc, job) => {
        if (job.status in acc) {
          acc[job.status as keyof typeof acc] += 1
        }
        return acc
      },
      { pending: 0, processing: 0, completed: 0, failed: 0 }
    )
  }, [jobs])

  const summaryStats = useMemo(() => {
    const now = Date.now()
    const oneDayMs = 24 * 60 * 60 * 1000
    let completedLastDay = 0
    let totalDuration = 0
    let durationSamples = 0
    let latestJobCreatedAt: string | null = null

    jobs.forEach((job) => {
      const createdAt = job.created_at ? new Date(job.created_at).getTime() : null
      if (createdAt && (!latestJobCreatedAt || createdAt > new Date(latestJobCreatedAt).getTime())) {
        latestJobCreatedAt = job.created_at
      }

      if (job.status === 'completed' && createdAt && now - createdAt <= oneDayMs) {
        completedLastDay += 1
      }

      if (job.completed_at && job.created_at) {
        const durationSeconds = Math.max(
          0,
          Math.round((new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000)
        )
        totalDuration += durationSeconds
        durationSamples += 1
      }
    })

    const avgDurationSeconds = durationSamples ? Math.round(totalDuration / durationSamples) : 0

    return {
      activeJobs: statusCounts.processing + statusCounts.pending,
      completedLastDay,
      avgDurationSeconds,
      failedCount: statusCounts.failed,
      latestJobCreatedAt,
    }
  }, [jobs, statusCounts])

  const lastRefreshedLabel = useMemo(
    () => (lastLoadedAt ? formatRelativeTime(lastLoadedAt.toISOString()) : null),
    [lastLoadedAt]
  )

  const statusQuickFilters = useMemo<StatusQuickFilter[]>(
    () => [
      { label: 'All jobs', value: 'all', count: jobs.length, description: 'Show every run' },
      { label: 'Queued', value: 'pending', count: statusCounts.pending, description: 'Waiting to process' },
      { label: 'Generating', value: 'processing', count: statusCounts.processing, description: 'In progress' },
      { label: 'Ready', value: 'completed', count: statusCounts.completed, description: 'Completed runs' },
      { label: 'Errors', value: 'failed', count: statusCounts.failed, description: 'Failed runs' },
    ],
    [jobs.length, statusCounts]
  )

  const summaryCards = useMemo<SummaryCard[]>(
    () => [
      {
        label: 'Active jobs',
        value: summaryStats.activeJobs.toString(),
        subtext: `${statusCounts.processing} running · ${statusCounts.pending} queued`,
        icon: <FiLoader className="h-5 w-5 text-primary-600" />,
        accentClass: 'border-primary-100 bg-primary-50/70',
      },
      {
        label: 'Completed (24h)',
        value: summaryStats.completedLastDay.toString(),
        subtext: summaryStats.latestJobCreatedAt ? `Last job ${formatRelativeTime(summaryStats.latestJobCreatedAt)}` : 'No jobs yet',
        icon: <FiTrendingUp className="h-5 w-5 text-emerald-600" />,
        accentClass: 'border-emerald-100 bg-emerald-50/80',
      },
      {
        label: 'Avg processing time',
        value: summaryStats.avgDurationSeconds ? formatDuration(summaryStats.avgDurationSeconds) : '—',
        subtext: summaryStats.avgDurationSeconds ? 'Across completed jobs' : 'No completed jobs yet',
        icon: <FiClock className="h-5 w-5 text-blue-600" />,
        accentClass: 'border-blue-100 bg-blue-50/80',
      },
      {
        label: 'Failures',
        value: summaryStats.failedCount.toString(),
        subtext: jobs.length ? `${Math.round((summaryStats.failedCount / jobs.length) * 100)}% of this page` : 'No jobs yet',
        icon: <FiAlertTriangle className="h-5 w-5 text-red-600" />,
        accentClass: 'border-red-100 bg-red-50/80',
      },
    ],
    [summaryStats, statusCounts, jobs.length]
  )

  const handleQuickFilter = useCallback(
    (value: string) => {
      filters.setStatusFilter(value)
      setCurrentPage(1)
    },
    [filters.setStatusFilter]
  )

  const handleClearFilters = useCallback(() => {
    filters.setStatusFilter('all')
    filters.setWorkflowFilter('all')
    filters.setSearchQuery('')
    setCurrentPage(1)
  }, [filters.setStatusFilter, filters.setWorkflowFilter, filters.setSearchQuery])

  // Load workflows for filter dropdown
  useEffect(() => {
    const loadWorkflows = async () => {
      try {
        const data = await api.getWorkflows()
        setWorkflows(data.workflows || [])
        const map: Record<string, string> = {}
        const counts: Record<string, number> = {}
        data.workflows?.forEach((wf: any) => {
          map[wf.workflow_id] = wf.workflow_name || wf.workflow_id
          if (Array.isArray(wf.steps)) {
            counts[wf.workflow_id] = wf.steps.length
          } else if (typeof wf.total_steps === 'number') {
            counts[wf.workflow_id] = wf.total_steps
          }
        })
        setWorkflowMap(map)
        setWorkflowStepCounts(counts)
      } catch (error) {
        console.error('Failed to load workflows:', error)
      }
    }
    loadWorkflows()
  }, [])

  const loadJobs = useCallback(async (showRefreshing = false, page = currentPage) => {
    try {
      if (showRefreshing) setRefreshing(true)
      
      const params: any = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }
      if (filters.statusFilter !== 'all') {
        params.status = filters.statusFilter
      }
      if (filters.workflowFilter !== 'all') {
        params.workflow_id = filters.workflowFilter
      }
      
      const data = await api.getJobs(params)
      setJobs(data.jobs || [])
      setTotalJobs(data.total || 0)
      setHasMore(data.has_more || false)
      setLastLoadedAt(new Date())
    } catch (error) {
      console.error('Failed to load jobs:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filters.statusFilter, filters.workflowFilter, currentPage, pageSize])

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when filters change
  }, [filters.statusFilter, filters.workflowFilter])

  useEffect(() => {
    setCurrentPage(1)
  }, [filters.searchQuery])

  useEffect(() => {
    loadJobs(false, currentPage)
  }, [loadJobs, currentPage])

  // Auto-refresh for processing/pending jobs
  useEffect(() => {
    const hasProcessingJobs = jobs.some(job => job.status === 'processing' || job.status === 'pending')
    
    if (!hasProcessingJobs) return

    const interval = setInterval(() => {
      loadJobs(true)
    }, 5000)

    return () => clearInterval(interval)
  }, [jobs, loadJobs])


  const hasProcessingJobs = jobs.some(job => job.status === 'processing' || job.status === 'pending')

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <JobFiltersProvider 
      statusFilter={filters.statusFilter}
      workflowFilter={filters.workflowFilter}
      setStatusFilter={filters.setStatusFilter}
      setWorkflowFilter={filters.setWorkflowFilter}
      workflows={workflows}
    >
      <div>
        <div className="mb-4 sm:mb-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Generated Lead Magnets</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">Track generation progress, errors, and delivery status.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-500">
                <span>
                  {lastRefreshedLabel ? `Last refreshed ${lastRefreshedLabel}` : 'Waiting for first refresh'}
                </span>
                <span className="hidden sm:inline text-gray-300">•</span>
                <span>{jobs.length} total jobs on this page</span>
                {hasProcessingJobs && (
                  <>
                    <span className="hidden sm:inline text-gray-300">•</span>
                    <span className="inline-flex items-center gap-1 text-primary-700 font-medium">
                      <span className="h-2 w-2 rounded-full bg-primary-500 animate-pulse" />
                      Live auto-refresh enabled
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="text-xs sm:text-sm text-gray-600">
                <p className="font-semibold text-gray-900">{filters.filteredJobs.length} visible</p>
                <p>Sorted by {sorting.sortField}</p>
              </div>
              <button
                onClick={() => loadJobs(true)}
                disabled={refreshing}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiRefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin text-primary-600' : ''}`} />
                Refresh data
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className={`rounded-2xl border ${card.accentClass} p-4 shadow-sm`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">{card.value}</p>
                    {card.subtext && <p className="mt-1 text-sm text-gray-600">{card.subtext}</p>}
                  </div>
                  <span className="rounded-full bg-white/80 p-3 shadow-sm">{card.icon}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Quick status filters">
              {statusQuickFilters.map((filter) => {
                const isActive = filters.statusFilter === filter.value
                return (
                  <button
                    key={filter.value}
                    onClick={() => handleQuickFilter(filter.value)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-primary-600 bg-primary-600 text-white shadow-sm'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-primary-200 hover:text-primary-700'
                    }`}
                    title={filter.description}
                  >
                    <span>{filter.label}</span>
                    <span
                      className={`text-xs font-semibold ${
                        isActive ? 'text-white/80' : 'text-gray-500'
                      }`}
                    >
                      {filter.count}
                    </span>
                  </button>
                )
              })}
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:border-gray-300 hover:text-gray-900"
              >
                Clear filters
              </button>
            </div>
          </div>
        </div>

      {/* Search and Filters - Combined on desktop, search only on mobile */}
      <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-0">
        {/* Search Bar */}
        {jobs.length > 0 && (
          <div className="sm:mb-4">
            <div className="relative">
              <input
                type="text"
                value={filters.searchQuery}
                onChange={(e) => filters.setSearchQuery(e.target.value)}
                placeholder="Search by lead magnet name..."
                className="w-full px-4 py-2.5 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              />
              <svg
                className="absolute left-3 top-3 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        )}

        {/* Filters - Hidden on mobile, shown in user menu instead */}
        <div className="hidden sm:block bg-white rounded-lg shadow p-3 sm:p-4" data-tour="job-filters">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
            <select
              value={filters.statusFilter}
              onChange={(e) => filters.setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Queued</option>
              <option value="processing">Generating</option>
              <option value="completed">Ready</option>
              <option value="failed">Error</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Lead Magnet</label>
            <select
              value={filters.workflowFilter}
              onChange={(e) => filters.setWorkflowFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Lead Magnets</option>
              {workflows.map((wf) => (
                <option key={wf.workflow_id} value={wf.workflow_id}>
                  {wf.workflow_name || wf.workflow_id}
                </option>
              ))}
            </select>
          </div>
        </div>
        </div>
      </div>

      {sorting.sortedJobs.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 sm:p-12 text-center">
          <p className="text-gray-600 text-sm sm:text-base">No lead magnets yet</p>
          <p className="text-xs sm:text-sm text-gray-500 mt-2">Lead magnets will appear here once forms are submitted</p>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="block md:hidden space-y-3" data-tour="jobs-list">
            {sorting.sortedJobs.map((job) => {
              const duration = job.completed_at && job.created_at
                ? Math.round((new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000)
                : null
              
              const hasError = job.status === 'failed' && job.error_message
              const stepMeta = getStepDisplayMeta(job, workflowStepCounts)
              
              return (
                <div
                  key={job.job_id}
                  onClick={() => {
                    // Use window.location for static export compatibility on mobile
                    if (typeof window !== 'undefined') {
                      window.location.href = `/dashboard/jobs/${job.job_id}`
                    } else {
                      router.push(`/dashboard/jobs/${job.job_id}`)
                    }
                  }}
                  className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 cursor-pointer hover:shadow transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {workflowMap[job.workflow_id] || job.workflow_id || '-'}
                      </h3>
                      {stepMeta.label && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {stepMeta.label}
                        </div>
                      )}
                    </div>
                    <div className="ml-2 flex-shrink-0 text-right" data-tour="job-status">
                      <div className="inline-flex justify-end">{getStatusIcon(job.status)}</div>
                      {stepMeta.isActive && stepMeta.label && (
                        <div className="text-[11px] font-medium text-amber-600 mt-1">
                          {stepMeta.label}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between text-gray-600">
                      <span>{formatRelativeTime(job.created_at)}</span>
                      {duration !== null && <span>{formatDuration(duration)}</span>}
                    </div>
                    
                    {job.output_url && (
                      <div className="pt-1" onClick={(e) => e.stopPropagation()} data-tour="view-artifacts">
                        <a
                          href={job.output_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            if (typeof window !== 'undefined') {
                              window.open(job.output_url, '_blank', 'noopener,noreferrer')
                            }
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          className="inline-flex items-center text-primary-600 hover:text-primary-900 text-xs"
                        >
                          <FiExternalLink className="w-3 h-3 mr-1" />
                          View
                        </a>
                      </div>
                    )}
                    
                    {hasError && (
                      <div className="pt-1">
                        <p className="text-red-600 text-xs line-clamp-1">{job.error_message}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden" data-tour="jobs-list">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lead Magnet
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => sorting.handleSort('date')}
                >
                  <div className="flex items-center">
                    Date
                    {sorting.sortField === 'date' && (
                      sorting.sortDirection === 'asc' ? <FiChevronUp className="w-3 h-3 ml-1" /> : <FiChevronDown className="w-3 h-3 ml-1" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => sorting.handleSort('duration')}
                >
                  <div className="flex items-center">
                    Processing Time
                    {sorting.sortField === 'duration' && (
                      sorting.sortDirection === 'asc' ? <FiChevronUp className="w-3 h-3 ml-1" /> : <FiChevronDown className="w-3 h-3 ml-1" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Document
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sorting.sortedJobs.map((job) => {
                const duration = job.completed_at && job.created_at
                  ? Math.round((new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000)
                  : null
                
                const hasError = job.status === 'failed' && job.error_message
                const errorPreview = hasError && job.error_message
                  ? (job.error_message.length > 60 
                      ? job.error_message.substring(0, 60) + '...' 
                      : job.error_message)
                  : null
              const stepMeta = getStepDisplayMeta(job, workflowStepCounts)

                return (
                  <React.Fragment key={job.job_id}>
                    <tr 
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => {
                        // Use window.location for static export compatibility
                        if (typeof window !== 'undefined') {
                          window.location.href = `/dashboard/jobs/${job.job_id}`
                        } else {
                          router.push(`/dashboard/jobs/${job.job_id}`)
                        }
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {workflowMap[job.workflow_id] || job.workflow_id || '-'}
                        </div>
                        {stepMeta.label && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {stepMeta.label}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap" data-tour="job-status">
                        <div className="flex flex-col gap-1 text-left">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(job.status)}
                            {getStatusBadge(job.status)}
                          </div>
                          {stepMeta.isActive && stepMeta.label ? (
                            <div className="pl-6 text-xs font-medium text-amber-600">
                              {stepMeta.label}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatRelativeTime(job.created_at)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(job.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {duration !== null ? formatDuration(duration) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                        {job.output_url ? (
                          <button
                            data-tour="view-artifacts"
                            onClick={async (e) => {
                              e.stopPropagation()
                              e.preventDefault()
                              try {
                                const blobUrl = await api.getJobDocumentBlobUrl(job.job_id)
                                window.open(blobUrl, '_blank', 'noopener,noreferrer')
                                // Clean up blob URL after a delay
                                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
                              } catch (error) {
                                console.error('Failed to open document:', error)
                                alert('Failed to open document. Please try again.')
                              }
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            className="inline-flex items-center text-primary-600 hover:text-primary-900 font-medium"
                          >
                            View
                            <FiExternalLink className="w-4 h-4 ml-1" />
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                    {hasError && (
                      <tr 
                        key={`${job.job_id}-error`}
                        className="bg-red-50 hover:bg-red-100 cursor-pointer transition-colors"
                        onClick={() => {
                          // Use window.location for static export compatibility
                          if (typeof window !== 'undefined') {
                            window.location.href = `/dashboard/jobs/${job.job_id}`
                          } else {
                            router.push(`/dashboard/jobs/${job.job_id}`)
                          }
                        }}
                      >
                        <td colSpan={5} className="px-6 py-3">
                          <div className="flex items-start">
                            <FiXCircle className="w-4 h-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm text-red-800 font-medium">Generation failed</p>
                              <p className="text-xs text-red-700 mt-1">{errorPreview}</p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  // Use window.location for static export compatibility
                                  if (typeof window !== 'undefined') {
                                    window.location.href = `/dashboard/jobs/${job.job_id}`
                                  } else {
                                    router.push(`/dashboard/jobs/${job.job_id}`)
                                  }
                                }}
                                className="text-xs text-red-600 hover:text-red-800 font-medium mt-1 underline"
                              >
                                View details
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Pagination Controls */}
      {sorting.sortedJobs.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-600">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalJobs)} of {totalJobs} lead magnets
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (currentPage > 1) {
                  setCurrentPage(currentPage - 1)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }
              }}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, Math.ceil(totalJobs / pageSize)) }, (_, i) => {
                const pageNum = i + 1
                const totalPages = Math.ceil(totalJobs / pageSize)
                let displayPage = pageNum
                
                // Show pages around current page
                if (totalPages > 5) {
                  if (currentPage <= 3) {
                    displayPage = pageNum
                  } else if (currentPage >= totalPages - 2) {
                    displayPage = totalPages - 4 + pageNum
                  } else {
                    displayPage = currentPage - 2 + pageNum
                  }
                }
                
                if (displayPage > totalPages) return null
                
                return (
                  <button
                    key={displayPage}
                    onClick={() => {
                      setCurrentPage(displayPage)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                      currentPage === displayPage
                        ? 'bg-primary-600 text-white'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {displayPage}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => {
                if (hasMore || currentPage * pageSize < totalJobs) {
                  setCurrentPage(currentPage + 1)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }
              }}
              disabled={!hasMore && currentPage * pageSize >= totalJobs}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Auto-refresh indicator */}
      {hasProcessingJobs && (
        <div className="mt-4 flex items-center justify-center text-sm text-blue-600">
          <FiLoader className="w-4 h-4 mr-2 animate-spin" />
          Auto-refreshing every 5 seconds...
        </div>
      )}
      </div>
    </JobFiltersProvider>
  )
}

interface StatusQuickFilter {
  label: string
  value: string
  count: number
  description: string
}

interface SummaryCard {
  label: string
  value: string
  subtext?: string
  icon: React.ReactNode
  accentClass: string
}
