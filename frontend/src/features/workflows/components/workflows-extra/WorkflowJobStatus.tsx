'use client'

import { FiCheckCircle, FiXCircle, FiLoader, FiClock } from 'react-icons/fi'
import { formatRelativeTime } from '@/features/workflows/utils/workflowUtils'

interface WorkflowJobStatusProps {
  jobs: any[]
  loading?: boolean
}

export function WorkflowJobStatus({ jobs, loading }: WorkflowJobStatusProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-1 text-gray-500 text-xs">
        <FiLoader className="w-3 h-3 animate-spin" />
        <span>Loading...</span>
      </div>
    )
  }

  if (!jobs || jobs.length === 0) {
    return null
  }

  const getJobStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <FiCheckCircle className="w-3 h-3 text-green-600" />
      case 'failed':
        return <FiXCircle className="w-3 h-3 text-red-600" />
      case 'processing':
        return <FiLoader className="w-3 h-3 text-blue-600 animate-spin" />
      default:
        return <FiClock className="w-3 h-3 text-yellow-600" />
    }
  }

  const latestJob = jobs[0]

  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-600">
      {getJobStatusIcon(latestJob.status)}
      <span className="capitalize">{latestJob.status}</span>
      {latestJob.created_at && (
        <span className="text-gray-400">• {formatRelativeTime(latestJob.created_at)}</span>
      )}
    </div>
  )
}

