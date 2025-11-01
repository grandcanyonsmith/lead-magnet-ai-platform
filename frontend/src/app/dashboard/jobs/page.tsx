'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { FiCheckCircle, FiXCircle, FiClock, FiLoader, FiRefreshCw, FiExternalLink, FiChevronDown, FiChevronUp } from 'react-icons/fi'

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
      return <FiLoader className="w-5 h-5 text-blue-600 animate-spin" />
    default:
      return <FiClock className="w-5 h-5 text-yellow-600" />
  }
}

const getStatusBadge = (status: string) => {
  const colors: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    processing: 'bg-blue-100 text-blue-800',
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

type SortField = 'date' | 'status' | 'duration'
type SortDirection = 'asc' | 'desc'

export default function JobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<any[]>([])
  const [workflows, setWorkflows] = useState<any[]>([])
  const [workflowMap, setWorkflowMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [workflowFilter, setWorkflowFilter] = useState<string>('all')
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

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

  const loadJobs = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true)
      
      const params: any = {}
      if (statusFilter !== 'all') {
        params.status = statusFilter
      }
      if (workflowFilter !== 'all') {
        params.workflow_id = workflowFilter
      }
      
      const data = await api.getJobs(params)
      setJobs(data.jobs || [])
    } catch (error) {
      console.error('Failed to load jobs:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [statusFilter, workflowFilter])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  // Auto-refresh for processing/pending jobs
  useEffect(() => {
    const hasProcessingJobs = jobs.some(job => job.status === 'processing' || job.status === 'pending')
    
    if (!hasProcessingJobs) return

    const interval = setInterval(() => {
      loadJobs(true)
    }, 5000)

    return () => clearInterval(interval)
  }, [jobs, loadJobs])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const sortedJobs = [...jobs].sort((a, b) => {
    let comparison = 0
    
    switch (sortField) {
      case 'date':
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        break
      case 'status':
        comparison = a.status.localeCompare(b.status)
        break
      case 'duration':
        const durationA = a.completed_at && a.created_at
          ? Math.round((new Date(a.completed_at).getTime() - new Date(a.created_at).getTime()) / 1000)
          : 0
        const durationB = b.completed_at && b.created_at
          ? Math.round((new Date(b.completed_at).getTime() - new Date(b.created_at).getTime()) / 1000)
          : 0
        comparison = durationA - durationB
        break
    }
    
    return sortDirection === 'asc' ? comparison : -comparison
  })

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
    <div>
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lead Magnets</h1>
            <p className="text-gray-600 mt-1">Your generated lead magnets and documents</p>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {jobs.length} {jobs.length === 1 ? 'lead magnet' : 'lead magnets'}
            </span>
            <button
              onClick={() => loadJobs(true)}
              disabled={refreshing}
              className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <FiRefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Workflow</label>
            <select
              value={workflowFilter}
              onChange={(e) => setWorkflowFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Workflows</option>
              {workflows.map((wf) => (
                <option key={wf.workflow_id} value={wf.workflow_id}>
                  {wf.workflow_name || wf.workflow_id}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {sortedJobs.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600">No lead magnets yet</p>
          <p className="text-sm text-gray-500 mt-2">Lead magnets will appear here once forms are submitted</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Workflow
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status
                    {sortField === 'status' && (
                      sortDirection === 'asc' ? <FiChevronUp className="w-3 h-3 ml-1" /> : <FiChevronDown className="w-3 h-3 ml-1" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center">
                    Date
                    {sortField === 'date' && (
                      sortDirection === 'asc' ? <FiChevronUp className="w-3 h-3 ml-1" /> : <FiChevronDown className="w-3 h-3 ml-1" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('duration')}
                >
                  <div className="flex items-center">
                    Processing Time
                    {sortField === 'duration' && (
                      sortDirection === 'asc' ? <FiChevronUp className="w-3 h-3 ml-1" /> : <FiChevronDown className="w-3 h-3 ml-1" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Document
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedJobs.map((job) => {
                const duration = job.completed_at && job.created_at
                  ? Math.round((new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000)
                  : null
                
                const hasError = job.status === 'failed' && job.error_message
                const errorPreview = hasError 
                  ? (job.error_message.length > 60 
                      ? job.error_message.substring(0, 60) + '...' 
                      : job.error_message)
                  : null

                return (
                  <>
                    <tr 
                      key={job.job_id} 
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/dashboard/jobs/${job.job_id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {workflowMap[job.workflow_id] || job.workflow_id || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(job.status)}
                          {getStatusBadge(job.status)}
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {job.output_url ? (
                          <a
                            href={job.output_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center text-primary-600 hover:text-primary-900 font-medium"
                          >
                            View
                            <FiExternalLink className="w-4 h-4 ml-1" />
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                    {hasError && (
                      <tr 
                        key={`${job.job_id}-error`}
                        className="bg-red-50 hover:bg-red-100 cursor-pointer transition-colors"
                        onClick={() => router.push(`/dashboard/jobs/${job.job_id}`)}
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
                                  router.push(`/dashboard/jobs/${job.job_id}`)
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
                  </>
                )
              })}
            </tbody>
          </table>
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
  )
}
