'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { FiClock, FiLoader, FiAlertTriangle, FiTrendingUp } from 'react-icons/fi'
import { useJobFilters, useJobSorting } from '@/hooks/useJobFilters'
import { JobFiltersProvider } from '@/contexts/JobFiltersContext'
import { formatRelativeTime, formatDuration } from '@/utils/date'
import { SummarySection, SummaryCard, StatusQuickFilter } from '@/components/jobs/list/SummarySection'
import { JobsMobileList } from '@/components/jobs/list/MobileList'
import { JobsDesktopTable } from '@/components/jobs/list/DesktopTable'
import type { Job } from '@/types/job'
import type { Workflow } from '@/types/workflow'
import toast from 'react-hot-toast'

export default function JobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [workflowMap, setWorkflowMap] = useState<Record<string, string>>({})
  const [workflowStepCounts, setWorkflowStepCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [totalJobs, setTotalJobs] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null)

  const filters = useJobFilters(jobs, workflowMap)
  const {
    statusFilter,
    workflowFilter,
    searchQuery,
    setStatusFilter,
    setWorkflowFilter,
    setSearchQuery,
    filteredJobs,
  } = filters
  const sorting = useJobSorting(filteredJobs)

  const handleNavigate = useCallback(
    (jobId: string) => {
      if (typeof window !== 'undefined') {
        window.location.href = `/dashboard/jobs/${jobId}`
      } else {
        router.push(`/dashboard/jobs/${jobId}`)
      }
    },
    [router]
  )

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
      setStatusFilter(value)
      setCurrentPage(1)
    },
    [setStatusFilter]
  )

  const handleClearFilters = useCallback(() => {
    setStatusFilter('all')
    setWorkflowFilter('all')
    setSearchQuery('')
    setCurrentPage(1)
  }, [setStatusFilter, setWorkflowFilter, setSearchQuery])

  useEffect(() => {
    const loadWorkflows = async () => {
      try {
        const data = await api.getWorkflows()
        setWorkflows(data.workflows || [])
        const map: Record<string, string> = {}
        const counts: Record<string, number> = {}
        data.workflows?.forEach((wf: Workflow) => {
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
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to load workflows:', error)
        }
        toast.error('Failed to load workflows. Please try again.')
      }
    }
    loadWorkflows()
  }, [])

  const loadJobs = useCallback(
    async (showRefreshing = false, page = currentPage) => {
      try {
        if (showRefreshing) setRefreshing(true)

        const params: any = {
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }
        if (statusFilter !== 'all') {
          params.status = statusFilter
        }
        if (workflowFilter !== 'all') {
          params.workflow_id = workflowFilter
        }

        const data = await api.getJobs(params)
        setJobs(data.jobs || [])
        setTotalJobs(data.total || 0)
        setHasMore(data.has_more || false)
        setLastLoadedAt(new Date())
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to load jobs:', error)
        }
        toast.error('Failed to load jobs. Please try again.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [statusFilter, workflowFilter, pageSize]
  )

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, workflowFilter, searchQuery])

  // Load jobs when page or filters change
  useEffect(() => {
    loadJobs(false, currentPage)
  }, [loadJobs, currentPage])

  // Poll for updates when there are processing jobs
  useEffect(() => {
    const hasProcessingJobs = jobs.some((job) => job.status === 'processing' || job.status === 'pending')
    if (!hasProcessingJobs) return

    const interval = setInterval(() => {
      loadJobs(true, currentPage)
    }, 5000)

    return () => clearInterval(interval)
  }, [jobs, loadJobs, currentPage])

  const hasProcessingJobs = jobs.some((job) => job.status === 'processing' || job.status === 'pending')

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Table skeleton matching actual table structure */}
          <div className="divide-y divide-gray-200">
            <div className="px-6 py-4">
              <div className="h-4 bg-gray-200 rounded w-32 mb-2 animate-pulse"></div>
              <div className="h-3 bg-gray-100 rounded w-24 animate-pulse"></div>
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-48 mb-2 animate-pulse"></div>
                    <div className="h-3 bg-gray-100 rounded w-32 animate-pulse"></div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded w-20 animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <JobFiltersProvider
      statusFilter={statusFilter}
      workflowFilter={workflowFilter}
      setStatusFilter={setStatusFilter}
      setWorkflowFilter={setWorkflowFilter}
      workflows={workflows}
    >
      <div>
        <SummarySection
          jobCount={sorting.sortedJobs.length}
          lastRefreshedLabel={lastRefreshedLabel}
          hasProcessingJobs={hasProcessingJobs}
          refreshing={refreshing}
          onRefresh={() => loadJobs(true)}
          summaryCards={summaryCards}
          quickFilters={statusQuickFilters}
          activeFilter={statusFilter}
          onQuickFilterChange={handleQuickFilter}
          onClearFilters={handleClearFilters}
        />

        <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-0">
          {jobs.length > 0 && (
            <div className="sm:mb-4">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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

          <div className="hidden sm:block bg-white rounded-lg shadow p-3 sm:p-4" data-tour="job-filters">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
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
                  value={workflowFilter}
                  onChange={(e) => setWorkflowFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">All Lead Magnets</option>
                  {workflows.map((wf: Workflow) => (
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
            <JobsMobileList
              jobs={sorting.sortedJobs}
              workflowMap={workflowMap}
              workflowStepCounts={workflowStepCounts}
              onNavigate={handleNavigate}
            />
            <JobsDesktopTable
              jobs={sorting.sortedJobs}
              workflowMap={workflowMap}
              workflowStepCounts={workflowStepCounts}
              onNavigate={handleNavigate}
              sortField={sorting.sortField}
              sortDirection={sorting.sortDirection}
              onSort={sorting.handleSort}
            />
          </>
        )}

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-600">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalJobs)} of {totalJobs} lead magnets
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
                const totalPages = Math.ceil(totalJobs / pageSize) || 1
                let displayPage = i + 1

                if (totalPages > 5) {
                  if (currentPage <= 3) {
                    displayPage = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    displayPage = totalPages - 4 + i
                  } else {
                    displayPage = currentPage - 2 + i
                  }
                }

                if (displayPage < 1 || displayPage > totalPages) {
                  return null
                }

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
