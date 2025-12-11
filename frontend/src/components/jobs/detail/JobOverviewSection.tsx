import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiActivity,
  FiClock,
  FiExternalLink,
  FiImage,
  FiLayers,
  FiRefreshCw,
  FiCopy,
} from 'react-icons/fi'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatRelativeTime, formatDuration } from '@/utils/date'
import type { Job, JobStepSummary } from '@/types/job'
import type { Workflow } from '@/types/workflow'

type RefreshHandler = () => void | Promise<void>
	export interface JobDurationInfo {
  seconds: number
  label: string
  isLive: boolean
}

interface JobOverviewSectionProps {
  job: Job
  workflow?: Workflow | null
  stepsSummary: JobStepSummary
  artifactCount: number
  jobDuration?: JobDurationInfo | null
  lastUpdatedLabel?: string | null
  lastRefreshedLabel?: string | null
  onRefresh?: RefreshHandler
  refreshing?: boolean
  onSelectArtifacts?: () => void
}

export function JobOverviewSection({
  job,
  workflow,
  stepsSummary,
  artifactCount,
  jobDuration,
  lastUpdatedLabel,
  lastRefreshedLabel,
  onRefresh,
  refreshing,
  onSelectArtifacts,
}: JobOverviewSectionProps) {
  const progressPercent = stepsSummary.total ? Math.round((stepsSummary.completed / stepsSummary.total) * 100) : 0
  const stepStatusCopy = (() => {
    if (stepsSummary.failed > 0) return `${stepsSummary.failed} failed`
    if (stepsSummary.running > 0) return `${stepsSummary.running} running`
    if (stepsSummary.pending > 0) return `${stepsSummary.pending} queued`
    if (stepsSummary.total === 0) return 'No workflow steps'
    return 'All steps completed'
  })()

  const updatedDisplay = lastUpdatedLabel ?? (job.created_at ? formatRelativeTime(job.created_at) : null)
  // Fall back to created_at when started_at is not set for processing, completed, or failed jobs
  const shouldFallbackToCreatedAt = job.status === 'processing' || job.status === 'completed' || job.status === 'failed'
  const effectiveStartTime = job.started_at || (shouldFallbackToCreatedAt ? job.created_at : null)
  const startLabel = effectiveStartTime ? formatRelativeTime(effectiveStartTime) : null
  const completedLabel = job.completed_at ? formatRelativeTime(job.completed_at) : null
  const isAutoUpdating = job.status === 'processing'

  const handleCopyJobId = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(job.job_id)
        toast.success('Job ID copied')
      } else {
        throw new Error('Clipboard API not available')
      }
    } catch {
      toast.error('Unable to copy job ID')
    }
  }

  const handleRefresh = () => {
    onRefresh?.()
  }

  const handleViewArtifacts = () => {
    if (artifactCount === 0) {
      return
    }
    onSelectArtifacts?.()
    if (typeof window !== 'undefined') {
      // Wait for tab to switch and DOM to update before scrolling
      setTimeout(() => {
        const artifactsElement = document.getElementById('job-tab-panel-artifacts')
        if (artifactsElement) {
          artifactsElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    }
  }

  return (
    <section className="mb-4 sm:mb-6">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap text-xs font-medium uppercase tracking-wide text-gray-600">
              <StatusBadge status={job.status} />
              {isAutoUpdating && (
                <span className="rounded-full bg-primary-50 px-2 py-0.5 text-primary-700">Live updating</span>
              )}
            </div>
            <div className="text-sm text-gray-500">
              {updatedDisplay ? <span>Updated {updatedDisplay}</span> : <span>Waiting for first update</span>}
              {lastRefreshedLabel && (
                <>
                  <span className="mx-2 text-gray-300">•</span>
                  <span>Viewed {lastRefreshedLabel}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-primary-600' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh data'}
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step Progress</p>
                <p className="text-lg font-semibold text-gray-900">
                  {stepsSummary.completed}/{stepsSummary.total || '--'}
                </p>
                <p className="text-sm text-gray-600">{stepStatusCopy}</p>
              </div>
              <span className="inline-flex rounded-full bg-blue-100 p-3 text-blue-700">
                <FiActivity className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-white">
              <span
                className="block h-full rounded-full bg-primary-500 transition-all"
                style={{ width: `${progressPercent}%` }}
                aria-label={`Step progress ${progressPercent}%`}
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Runtime</p>
                <p className="text-lg font-semibold text-gray-900">
                  {jobDuration?.label || (effectiveStartTime ? 'Initializing...' : (isAutoUpdating ? 'Starting...' : 'Not started'))}
                </p>
                <p className="text-sm text-gray-600">
                  {completedLabel
                    ? `Completed ${completedLabel}`
                    : startLabel
                      ? `Started ${startLabel}`
                      : (isAutoUpdating ? 'Processing started' : 'Waiting for worker')}
                </p>
              </div>
              <span className="inline-flex rounded-full bg-orange-100 p-3 text-orange-700">
                <FiClock className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            {jobDuration?.isLive && (
              <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Artifacts</p>
                <p className="text-lg font-semibold text-gray-900">{artifactCount}</p>
                <p className="text-sm text-gray-600">
                  {artifactCount ? 'Artifacts ready to review' : 'Generated assets will appear here'}
                </p>
              </div>
              <span className="inline-flex rounded-full bg-purple-100 p-3 text-purple-700">
                <FiImage className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <button
              type="button"
              onClick={handleViewArtifacts}
              disabled={artifactCount === 0}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiExternalLink className="h-4 w-4" aria-hidden="true" />
              Open gallery
            </button>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Workflow</p>
                <p className="text-lg font-semibold text-gray-900">
                  {workflow?.workflow_name || 'Workflow template'}
                </p>
                <p className="text-sm text-gray-600">
                  {workflow?.steps?.length ? `${workflow.steps.length} configured steps` : 'Workflow metadata unavailable'}
                </p>
              </div>
              <span className="inline-flex rounded-full bg-indigo-100 p-3 text-indigo-700">
                <FiLayers className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            {workflow?.workflow_id ? (
              <Link
                href={`/dashboard/workflows/${workflow.workflow_id}`}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                <FiExternalLink className="h-4 w-4" aria-hidden="true" />
                View template
              </Link>
            ) : (
              <p className="mt-3 text-sm text-gray-500">Workflow details not available for this job</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
