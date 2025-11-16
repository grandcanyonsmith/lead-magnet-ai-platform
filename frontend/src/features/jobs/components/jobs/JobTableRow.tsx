'use client'

import React from 'react'
import { FiExternalLink, FiXCircle } from 'react-icons/fi'
import { getStatusIcon } from '@/features/jobs/utils/jobFormatting'
import { formatRelativeTime, formatDurationSeconds } from '@/features/jobs/utils/jobFormatting'
import { StatusBadge } from '@/shared/components/ui/StatusBadge'
import { useJobCardData } from '@/features/jobs/hooks/useJobCardData'
import { api } from '@/shared/lib/api'
import type { Job } from '@/features/jobs/types'

interface JobTableRowProps {
  job: Job
  workflowName: string
  onClick: () => void
}

/**
 * Desktop table row view for job/execution runs
 * Displays job information in a table row format with error row expansion
 */
export function JobTableRow({ job, workflowName, onClick }: JobTableRowProps) {
  const { duration, stepProgress, hasError, errorMessage } = useJobCardData(job)

  const errorPreview = hasError && errorMessage
    ? (errorMessage.length > 60 ? errorMessage.substring(0, 60) + '...' : errorMessage)
    : null

  const handleDocumentClick = async (e: React.MouseEvent) => {
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
  }

  return (
    <React.Fragment>
      <tr
        className="hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={onClick}
      >
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm font-medium text-gray-900">
            {workflowName}
          </div>
          {stepProgress && (
            <div className="text-xs text-gray-500 mt-0.5">
              Step {stepProgress.completed}/{stepProgress.total}
            </div>
          )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap" data-tour="job-status">
          <div className="flex items-center gap-2">
            {getStatusIcon(job.status)}
            <StatusBadge status={job.status} />
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
          {duration !== null ? formatDurationSeconds(duration) : '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
          {job.output_url ? (
            <button
              data-tour="view-artifacts"
              onClick={handleDocumentClick}
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
      {hasError && errorPreview && (
        <tr
          key={`${job.job_id}-error`}
          className="bg-red-50 hover:bg-red-100 cursor-pointer transition-colors"
          onClick={onClick}
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
                    onClick()
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
}

