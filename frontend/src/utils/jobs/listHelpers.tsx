import type { ReactNode } from 'react'
import { FiCheckCircle, FiLoader, FiXCircle } from 'react-icons/fi'

export const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: 'Queued',
    processing: 'Generating',
    completed: 'Ready',
    failed: 'Error',
  }
  return labels[status] || status
}

export const getStatusIcon = (status: string): ReactNode => {
  switch (status) {
    case 'completed':
      return <FiCheckCircle className="w-5 h-5 text-green-600" />
    case 'failed':
      return <FiXCircle className="w-5 h-5 text-red-600" />
    case 'processing':
      return <FiLoader className="w-5 h-5 text-yellow-600 animate-spin" />
    case 'pending':
      return <FiCheckCircle className="w-5 h-5 text-yellow-600" />
    default:
      return <FiCheckCircle className="w-5 h-5 text-yellow-600" />
  }
}

export const getStatusBadge = (status: string): ReactNode => {
  const colors: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    processing: 'bg-yellow-100 text-yellow-800',
    pending: 'bg-yellow-100 text-yellow-800',
  }
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {getStatusLabel(status)}
    </span>
  )
}

export const getStepProgress = (job: any) => {
  const steps = job.execution_steps || []
  if (steps.length === 0) return null

  let completedSteps = 0

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const hasOutput = step.output !== null && step.output !== undefined && step.output !== ''

    if (step._status === 'failed' || (job.status === 'failed' && !hasOutput)) {
      break
    }

    if (hasOutput) {
      completedSteps++
    }
  }

  return { completed: completedSteps, total: steps.length }
}

export const getStepDisplayMeta = (
  job: any,
  workflowStepCounts: Record<string, number>
): { label: string | null; isActive: boolean } => {
  const progress = getStepProgress(job)
  const workflowTotal = workflowStepCounts[job.workflow_id]
  const progressTotal = progress?.total && progress.total > 0 ? progress.total : 0
  const totalSteps = workflowTotal || progressTotal || 0
  const isActive = job.status === 'processing' || job.status === 'pending'

  if (totalSteps > 0) {
    if (isActive) {
      const completed = progress?.completed ?? 0
      const current = Math.min(Math.max(completed + 1, 1), totalSteps)
      return { label: `Step ${current}/${totalSteps}`, isActive }
    }
    if (progress) {
      const safeCompleted = Math.min(progress.completed, totalSteps)
      return { label: `Step ${safeCompleted}/${totalSteps}`, isActive }
    }
    return { label: `Step ${totalSteps}/${totalSteps}`, isActive }
  }

  if (progress && progress.total > 0) {
    return { label: `Step ${progress.completed}/${progress.total}`, isActive }
  }

  return { label: null, isActive }
}
