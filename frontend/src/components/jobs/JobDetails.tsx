'use client'

import { useRouter } from 'next/navigation'
import { FiExternalLink } from 'react-icons/fi'
import { formatRelativeTime, formatDurationSeconds } from '@/utils/jobFormatting'
import { api } from '@/lib/api'

interface JobDetailsProps {
  job: any
  workflow: any | null
}

export function JobDetails({ job, workflow }: JobDetailsProps) {
  const router = useRouter()
  
  const duration = job.completed_at && job.created_at
    ? Math.round((new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000)
    : null

  // Calculate total cost from all execution steps
  const totalCost = job.execution_steps && Array.isArray(job.execution_steps)
    ? job.execution_steps.reduce((sum: number, step: any) => {
        const cost = step.usage_info?.cost_usd
        return sum + (typeof cost === 'number' ? cost : 0)
      }, 0)
    : null

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Details</h2>
      
      {workflow && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Workflow</label>
          <button
            onClick={() => router.push(`/dashboard/workflows/${job.workflow_id}`)}
            className="text-primary-600 hover:text-primary-900 font-medium hover:underline"
          >
            {workflow.workflow_name || job.workflow_id}
          </button>
        </div>
      )}

      {!workflow && job.workflow_id && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Workflow</label>
          <p className="text-sm text-gray-900">{job.workflow_id}</p>
        </div>
      )}

      {job.output_url && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Document</label>
          <button
            onClick={async () => {
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
            className="inline-flex items-center text-primary-600 hover:text-primary-900 font-medium"
          >
            View Document
            <FiExternalLink className="w-4 h-4 ml-1" />
          </button>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Created</label>
        <p className="text-sm text-gray-900">
          {formatRelativeTime(job.created_at)}
          <span className="text-gray-500 ml-2">({new Date(job.created_at).toLocaleString()})</span>
        </p>
      </div>

      {duration !== null && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Processing Time</label>
          <p className="text-sm text-gray-900">{formatDurationSeconds(duration)}</p>
        </div>
      )}

      {totalCost !== null && totalCost > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Total Cost</label>
          <p className="text-sm text-gray-900">${totalCost.toFixed(2)}</p>
        </div>
      )}

      {job.completed_at && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Completed</label>
          <p className="text-sm text-gray-900">
            {formatRelativeTime(job.completed_at)}
            <span className="text-gray-500 ml-2">({new Date(job.completed_at).toLocaleString()})</span>
          </p>
        </div>
      )}

      {job.status === 'failed' && job.error_message && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Error</label>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              {job.error_message.includes('Error') || job.error_message.includes('error')
                ? job.error_message
                : `Generation failed: ${job.error_message}`}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

