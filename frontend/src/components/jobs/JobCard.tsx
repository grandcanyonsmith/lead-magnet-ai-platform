'use client'

import { FiExternalLink } from 'react-icons/fi'
import { getStatusIcon } from '@/utils/jobFormatting'
import { formatRelativeTime, formatDurationSeconds } from '@/utils/jobFormatting'
import { useJobCardData } from '@/hooks/useJobCardData'
import type { Job } from '@/types/job'

interface JobCardProps {
  job: Job
  workflowName: string
  onClick: () => void
}

/**
 * Mobile card view for job/execution runs
 * Displays job information in a compact card format
 */
export function JobCard({ job, workflowName, onClick }: JobCardProps) {
  const { duration, stepProgress, hasError, errorMessage, hasDocument } = useJobCardData(job)

  const handleDocumentClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (typeof window !== 'undefined' && job.output_url) {
      window.open(job.output_url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 cursor-pointer hover:shadow transition-shadow"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">
            {workflowName}
          </h3>
          {stepProgress && (
            <div className="text-xs text-gray-500 mt-0.5">
              Step {stepProgress.completed}/{stepProgress.total}
            </div>
          )}
        </div>
        <div className="ml-2 flex-shrink-0" data-tour="job-status">
          {getStatusIcon(job.status)}
        </div>
      </div>
      
      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between text-gray-600">
          <span>{formatRelativeTime(job.created_at)}</span>
          {duration !== null && <span>{formatDurationSeconds(duration)}</span>}
        </div>
        
        {hasDocument && (
          <div className="pt-1" onClick={(e) => e.stopPropagation()} data-tour="view-artifacts">
            <a
              href={job.output_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleDocumentClick}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className="inline-flex items-center text-primary-600 hover:text-primary-900 text-xs"
            >
              <FiExternalLink className="w-3 h-3 mr-1" />
              View
            </a>
          </div>
        )}
        
        {hasError && errorMessage && (
          <div className="pt-1">
            <p className="text-red-600 text-xs line-clamp-1">{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  )
}

