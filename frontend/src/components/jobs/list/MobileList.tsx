import { useState } from 'react'
import { getStatusIcon, getStatusBadge, getStepDisplayMeta, getJobSubmissionPreview } from '@/utils/jobs/listHelpers'
import { formatRelativeTime, formatDuration } from '@/utils/date'
import { FiExternalLink } from 'react-icons/fi'
import { openJobDocumentInNewTab } from '@/utils/jobs/openJobDocument'
import type { Job } from '@/types/job'

interface JobsMobileListProps {
  jobs: Job[]
  workflowMap: Record<string, string>
  workflowStepCounts: Record<string, number>
  onNavigate: (jobId: string) => void
}

export function JobsMobileList({ jobs, workflowMap, workflowStepCounts, onNavigate }: JobsMobileListProps) {
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
    <div className="block md:hidden space-y-3" data-tour="jobs-list">
      {jobs.map((job) => {
        const duration = job.completed_at && job.created_at
          ? Math.round((new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000)
          : null
        const hasError = job.status === 'failed' && job.error_message
        const stepMeta = getStepDisplayMeta(job, workflowStepCounts)
        const submissionPreview = getJobSubmissionPreview(job)

        return (
          <div
            key={job.job_id}
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
            className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 cursor-pointer hover:shadow transition-shadow"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 truncate">
                  {workflowMap[job.workflow_id] || job.workflow_id || '-'}
                </h3>
                {submissionPreview && (
                  <div className="text-xs text-gray-600 mt-1 font-medium truncate">
                    {submissionPreview}
                  </div>
                )}
                {stepMeta.label && <div className="text-xs text-gray-500 mt-0.5">{stepMeta.label}</div>}
              </div>
              <div className="ml-2 flex-shrink-0 text-right" data-tour="job-status">
                <div className="inline-flex justify-end">{getStatusIcon(job.status)}</div>
                {stepMeta.isActive && stepMeta.label && (
                  <div className="text-[11px] font-medium text-amber-600 mt-1">{stepMeta.label}</div>
                )}
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between text-gray-600">
                <span>{formatRelativeTime(job.created_at)}</span>
                {duration !== null && <span>{formatDuration(duration)}</span>}
              </div>

              {job.output_url && (
                <div className="pt-1" data-tour="view-artifacts" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => handleViewDocument(job)}
                    disabled={openingJobId === job.job_id}
                    className="inline-flex items-center text-primary-600 hover:text-primary-900 text-xs disabled:cursor-not-allowed disabled:text-gray-400"
                  >
                    <FiExternalLink className="w-3 h-3 mr-1" />
                    {openingJobId === job.job_id ? 'Opening…' : 'View'}
                  </button>
                </div>
              )}

              {hasError && (
                <div className="pt-1">
                  <p className="text-red-600 text-xs line-clamp-1">{job.error_message}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onNavigate(job.job_id)
                    }}
                    className="text-xs text-red-600 hover:text-red-800 font-medium mt-1 underline"
                    aria-label="View job details"
                  >
                    View details
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
