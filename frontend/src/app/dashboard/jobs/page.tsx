'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { FiLoader, FiRefreshCw, FiChevronDown, FiChevronUp } from 'react-icons/fi'
import { useJobFilters, useJobSorting } from '@/hooks/useJobFilters'
import { JobFiltersProvider } from '@/contexts/JobFiltersContext'
import { JobCard } from '@/components/jobs/JobCard'
import { JobTableRow } from '@/components/jobs/JobTableRow'

export default function JobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<any[]>([])
  const [workflows, setWorkflows] = useState<any[]>([])
  const [workflowMap, setWorkflowMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [totalJobs, setTotalJobs] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  
  // Use extracted hooks for filtering and sorting
  const filters = useJobFilters(jobs, workflowMap)
  const sorting = useJobSorting(filters.filteredJobs)

  // Load workflows for filter dropdown
  useEffect(() => {
    const loadWorkflows = async () => {
      try {
        const data = await api.getWorkflows()
        setWorkflows(data.workflows || [])
        const map: Record<string, string> = {}
        data.workflows?.forEach((wf: any) => {
          map[wf.workflow_id] = wf.workflow_name || wf.workflow_id
        })
        setWorkflowMap(map)
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
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-0">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Generated Lead Magnets</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">Your generated lead magnets and documents</p>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
              <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                {jobs.length} {jobs.length === 1 ? 'lead magnet' : 'lead magnets'}
              </span>
              <button
                onClick={() => loadJobs(true)}
                disabled={refreshing}
                className="flex items-center px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm sm:text-base"
              >
                <FiRefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
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
              const workflowName = workflowMap[job.workflow_id] || job.workflow_id || '-'
              
              const handleClick = () => {
                // Use window.location for static export compatibility on mobile
                if (typeof window !== 'undefined') {
                  window.location.href = `/dashboard/jobs/${job.job_id}`
                } else {
                  router.push(`/dashboard/jobs/${job.job_id}`)
                }
              }
              
              return (
                <JobCard
                  key={job.job_id}
                  job={job}
                  workflowName={workflowName}
                  onClick={handleClick}
                />
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
                const workflowName = workflowMap[job.workflow_id] || job.workflow_id || '-'
                
                const handleClick = () => {
                  // Use window.location for static export compatibility
                  if (typeof window !== 'undefined') {
                    window.location.href = `/dashboard/jobs/${job.job_id}`
                  } else {
                    router.push(`/dashboard/jobs/${job.job_id}`)
                  }
                }
                
                return (
                  <JobTableRow
                    key={job.job_id}
                    job={job}
                    workflowName={workflowName}
                    onClick={handleClick}
                  />
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
