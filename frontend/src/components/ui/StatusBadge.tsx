/**
 * Shared status badge component
 * Provides consistent status indicators across the app
 */

import { Status } from '@/types/common'
import { StepStatus } from '@/types/job'

interface StatusBadgeProps {
  status: Status | StepStatus
  className?: string
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  pending: {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    label: 'Pending',
  },
  in_progress: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    label: 'In Progress',
  },
  processing: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    label: 'Processing',
  },
  completed: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    label: 'Completed',
  },
  success: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    label: 'Success',
  },
  failed: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    label: 'Failed',
  },
  error: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    label: 'Error',
  },
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    label: status,
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text} ${className}`}
    >
      {config.label}
    </span>
  )
}

