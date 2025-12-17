import React, { useState } from 'react'
import { getStatusIcon, getStatusBadge, getStepDisplayMeta, getJobSubmissionPreview } from '@/utils/jobs/listHelpers'
import { formatRelativeTime, formatDuration } from '@/utils/date'
import type { SortField } from '@/hooks/useJobFilters'
import { FiChevronDown, FiChevronUp, FiXCircle, FiLoader, FiExternalLink } from 'react-icons/fi'
import { openJobDocumentInNewTab } from '@/utils/jobs/openJobDocument'
import type { Job } from '@/types/job'

interface JobsTableProps {
  jobs: Job[]
  workflowMap: Record<string, string>
  workflowStepCounts: Record<string, number>
  onNavigate: (jobId: string) => void
  sortField: SortField
  sortDirection: 'asc' | 'desc'
  onSort: (field: SortField) => void
}

export function JobsDesktopTable({
  jobs,
  workflowMap,
  workflowStepCounts,
  onNavigate,
  sortField,
  sortDirection,
  onSort,
}: JobsTableProps) {
  const [openingJobId, setOpeningJobId] = useState<string | null>(null)

  const handleViewDocument = async (job: Job) => {
    if (!job.output_url || openingJobId) return
    setOpeningJobId(job.job_id)
    try {
      await openJobDocumentInNewTab(job.job_id)
    } finally {
      setOpeningJobId(null)
    }
  }

  if (!jobs.length) {
    return null
  }

  return (
    <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden" data-tour="jobs-list">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" aria-label="Lead Magnet">Lead Magnet</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" aria-label="Status">Status</th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => onSort('date')}
              aria-label="Sort by date"
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
              onClick={() => onSort('duration')}
              aria-label="Sort by processing time"
            >
              <div className="flex items-center">
                Processing Time
                {sortField === 'duration' && (
                  sortDirection === 'asc' ? <FiChevronUp className="w-3 h-3 ml-1" /> : <FiChevronDown className="w-3 h-3 ml-1" />
                )}
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" aria-label="Output">Output</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {jobs.map((job) => {
            const duration = job.completed_at && job.created_at
              ? Math.round((new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000)
              : null
            const hasError = job.status === 'failed' && job.error_message
            const errorPreview = hasError && job.error_message
              ? (job.error_message.length > 60 ? `${job.error_message.substring(0, 60)}...` : job.error_message)
              : null
            const stepMeta = getStepDisplayMeta(job, workflowStepCounts)
            const submissionPreview = getJobSubmissionPreview(job)
            const isOpening = openingJobId === job.job_id
            const disableView = openingJobId !== null

            return (
              <React.Fragment key={job.job_id}>
                <tr 
                  className="hover:bg-gray-50 cursor-pointer transition-all duration-150 hover:shadow-sm" 
                  onClick={() => onNavigate(job.job_id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onNavigate(job.job_id)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`View job ${job.job_id}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {workflowMap[job.workflow_id] || job.workflow_id || '-'}
                    </div>
                    {submissionPreview && (
                      <div className="text-xs text-gray-600 mt-1 font-medium">
                        {submissionPreview}
                      </div>
                    )}
                    {stepMeta.label && <div className="text-xs text-gray-500 mt-0.5">{stepMeta.label}</div>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap" data-tour="job-status">
                    <div className="flex flex-col gap-1 text-left">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job.status)}
                        {getStatusBadge(job.status)}
                      </div>
                      {stepMeta.isActive && stepMeta.label && (
                        <div className="pl-6 text-xs font-medium text-amber-600">{stepMeta.label}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatRelativeTime(job.created_at)}</div>
                    <div className="text-xs text-gray-500">{new Date(job.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {duration !== null ? formatDuration(duration) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" data-tour="view-artifacts">
                    {job.output_url ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewDocument(job)
                        }}
                        disabled={disableView}
                        className="inline-flex items-center text-primary-600 hover:text-primary-900 text-xs disabled:cursor-not-allowed disabled:text-gray-400"
                        aria-label="View job output document"
                      >
                        {isOpening ? (
                          <FiLoader className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <FiExternalLink className="w-3 h-3 mr-1" />
                        )}
                        {isOpening ? 'Opening…' : 'View'}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
                {hasError && (
                  <tr
                    key={`${job.job_id}-error`}
                    className="bg-red-50 hover:bg-red-100 cursor-pointer transition-all duration-150 hover:shadow-sm"
                    onClick={() => onNavigate(job.job_id)}
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
                              onNavigate(job.job_id)
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
  )
}
