import type { JobStepSummary, MergedStep } from '@/types/job'

export function summarizeStepProgress(steps?: MergedStep[] | null): JobStepSummary {
  if (!steps || steps.length === 0) {
    return { total: 0, completed: 0, failed: 0, running: 0, pending: 0 }
  }

  return steps.reduce<JobStepSummary>(
    (acc, step) => {
      acc.total += 1
      switch (step._status) {
        case 'completed':
          acc.completed += 1
          break
        case 'failed':
          acc.failed += 1
          break
        case 'in_progress':
          acc.running += 1
          break
        default:
          acc.pending += 1
          break
      }
      return acc
    },
    { total: 0, completed: 0, failed: 0, running: 0, pending: 0 }
  )
}

export function formatStepLabel(stepOrder?: number, stepType?: string, stepName?: string) {
  const typeLabel = stepType ? formatStepType(stepType) : ''
  if (stepName) {
    const orderLabel = stepOrder !== undefined ? `${stepOrder}. ` : ''
    return `${orderLabel}${stepName}`
  }
  if (typeLabel) {
    return stepOrder !== undefined ? `${stepOrder}. ${typeLabel}` : typeLabel
  }
  return stepOrder !== undefined ? `Step ${stepOrder}` : 'Workflow Step'
}

export function formatStepType(stepType?: string) {
  if (!stepType) {
    return ''
  }
  return stepType.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}
