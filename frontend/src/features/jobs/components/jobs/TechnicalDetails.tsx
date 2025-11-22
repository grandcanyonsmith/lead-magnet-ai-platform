'use client'

import { useRouter } from 'next/navigation'
import { FiChevronDown, FiChevronUp, FiCopy, FiExternalLink } from 'react-icons/fi'
import { useState } from 'react'
import { copyToClipboard } from '@/shared/utils/clipboard'
import { ArtifactPreview } from './ArtifactPreview'

interface TechnicalDetailsProps {
  job: any
  form: any | null
}

export function TechnicalDetails({ job, form }: TechnicalDetailsProps) {
  const router = useRouter()
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)

  return (
    <div className="mt-4 sm:mt-6 bg-white rounded-lg shadow p-4 sm:p-6">
      <button
        onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
        className="flex items-center justify-between w-full text-left mb-4 touch-target"
      >
        <h2 className="text-lg font-semibold text-gray-900">Technical Details</h2>
        {showTechnicalDetails ? (
          <FiChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
        ) : (
          <FiChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
        )}
      </button>

      {showTechnicalDetails && (
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job ID</label>
            <div className="flex items-center space-x-2">
              <p className="text-sm font-mono text-gray-900">{job.job_id}</p>
              <button
                onClick={() => copyToClipboard(job.job_id)}
                className="text-gray-500 hover:text-gray-700 p-2 touch-target"
                title="Copy Job ID"
              >
                <FiCopy className="w-4 h-4" />
              </button>
            </div>
          </div>

          {job.submission_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Submission ID</label>
              <div className="flex items-center space-x-2">
                {form?.public_slug ? (
                  <a
                    href={`/v1/forms/${form.public_slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-mono text-primary-600 hover:text-primary-900 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {job.submission_id}
                    <FiExternalLink className="w-3 h-3 ml-1 inline" />
                  </a>
                ) : (
                  <p className="text-sm font-mono text-gray-900">{job.submission_id}</p>
                )}
                <button
                  onClick={() => copyToClipboard(job.submission_id)}
                  className="text-gray-500 hover:text-gray-700 p-2 touch-target"
                  title="Copy Submission ID"
                >
                  <FiCopy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {job.workflow_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Workflow ID</label>
              <div className="flex items-center space-x-2">
                <p className="text-sm font-mono text-gray-900">{job.workflow_id}</p>
                <button
                  onClick={() => copyToClipboard(job.workflow_id)}
                  className="text-gray-500 hover:text-gray-700 p-2 touch-target"
                  title="Copy Workflow ID"
                >
                  <FiCopy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {job.tenant_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tenant ID</label>
              <div className="flex items-center space-x-2">
                <p className="text-sm font-mono text-gray-900">{job.tenant_id}</p>
                <button
                  onClick={() => copyToClipboard(job.tenant_id)}
                  className="text-gray-500 hover:text-gray-700 p-2 touch-target"
                  title="Copy Tenant ID"
                >
                  <FiCopy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {job.started_at && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Started At</label>
              <div className="flex items-center space-x-2">
                <p className="text-sm text-gray-900">
                  {(() => {
                    try {
                      const date = new Date(job.started_at)
                      if (isNaN(date.getTime())) {
                        return job.started_at
                      }
                      // Format: M/D/YYYY, H:MM:SS AM/PM
                      return date.toLocaleString('en-US', {
                        month: 'numeric',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                      })
                    } catch {
                      return job.started_at
                    }
                  })()}
                </p>
                <button
                  onClick={() => copyToClipboard(job.started_at)}
                  className="text-gray-500 hover:text-gray-700 p-2 touch-target"
                  title="Copy Started At"
                >
                  <FiCopy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {job.updated_at && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
              <div className="flex items-center space-x-2">
                <p className="text-sm text-gray-900">
                  {(() => {
                    try {
                      const date = new Date(job.updated_at)
                      if (isNaN(date.getTime())) {
                        return job.updated_at
                      }
                      // Format: M/D/YYYY, H:MM:SS AM/PM
                      return date.toLocaleString('en-US', {
                        month: 'numeric',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                      })
                    } catch {
                      return job.updated_at
                    }
                  })()}
                </p>
                <button
                  onClick={() => copyToClipboard(job.updated_at)}
                  className="text-gray-500 hover:text-gray-700 p-2 touch-target"
                  title="Copy Last Updated"
                >
                  <FiCopy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {job.artifacts && job.artifacts.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Artifacts</label>
              <div className="space-y-6">
                {job.artifacts.map((artifactId: string) => (
                  <ArtifactPreview key={artifactId} artifactId={artifactId} />
                ))}
              </div>
            </div>
          )}

          {job.error_message && job.status === 'failed' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Raw Error Details</label>
              <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs text-gray-800 whitespace-pre-wrap break-all">
                {job.error_message}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

