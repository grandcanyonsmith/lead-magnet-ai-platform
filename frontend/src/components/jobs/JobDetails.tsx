'use client'

import { useRouter } from 'next/navigation'
import { ReactNode, useState } from 'react'
import {
  FiClock,
  FiDollarSign,
  FiExternalLink,
  FiFileText,
  FiLayers,
  FiLoader,
} from 'react-icons/fi'
import { toast } from 'react-hot-toast'
import { formatDurationSeconds, formatRelativeTime } from '@/utils/jobFormatting'
import { api } from '@/lib/api'
import { SectionCard } from '@/components/ui/SectionCard'
import { StatPill } from '@/components/ui/StatPill'
import { KeyValueItem, KeyValueList } from '@/components/ui/KeyValueList'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { Job } from '@/types/job'
import type { Workflow } from '@/types/workflow'

interface JobDetailsProps {
  job: Job
  workflow: Workflow | null
  hideContainer?: boolean
}

export function JobDetails({ job, workflow, hideContainer = false }: JobDetailsProps) {
  const router = useRouter()
  const [loadingDocument, setLoadingDocument] = useState(false)

  const createdAt = new Date(job.created_at)
  const completedAt = job.completed_at ? new Date(job.completed_at) : null
  const durationSeconds =
    job.completed_at && job.created_at
      ? Math.round((completedAt!.getTime() - createdAt.getTime()) / 1000)
      : null

  const totalCost = (() => {
    if (!job.execution_steps || !Array.isArray(job.execution_steps)) {
      return null
    }
    
    // Filter to only AI generation steps (which have cost)
    const aiSteps = job.execution_steps.filter(
      step => step.step_type === 'ai_generation' || step.step_type === 'workflow_step'
    )
    
    if (aiSteps.length === 0) {
      return null
    }
    
    const sum = aiSteps.reduce((sum: number, step) => {
      const cost = step.usage_info?.cost_usd
      if (cost === undefined || cost === null) {
        return sum
      }
      if (typeof cost === 'number') {
        return sum + cost
      }
      if (typeof cost === 'string') {
        const parsed = parseFloat(cost)
        return sum + (isNaN(parsed) ? 0 : parsed)
      }
      return sum
    }, 0)
    
    // Only show cost if at least one step has usage_info with cost_usd > 0
    const hasCostData = aiSteps.some(step => {
      const cost = step.usage_info?.cost_usd
      return cost !== undefined && cost !== null && (typeof cost === 'number' ? cost > 0 : parseFloat(String(cost)) > 0)
    })
    
    // If no steps have cost data, return null to hide the display
    if (!hasCostData) {
      return null
    }
    
    return sum
  })()

  const stepsCount =
    workflow?.steps?.length ?? job.execution_steps?.length ?? null

  const hasDocument = Boolean(job.output_url)

  const handleCopyValue = async (value: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(value)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = value
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Unable to copy automatically. Please copy manually.')
    }
  }

  const handleViewDocument = async () => {
    if (!hasDocument || loadingDocument) return

    setLoadingDocument(true)
    let blobUrl: string | null = null

    try {
      blobUrl = await api.getJobDocumentBlobUrl(job.job_id)

      if (!blobUrl) {
        throw new Error('Failed to create blob URL')
      }

      const newWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer')

      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        toast.error('Popup blocked. Please allow popups for this site and try again.')
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl)
        }
        return
      }

      setTimeout(() => {
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl)
        }
      }, 5000)

      toast.success('Document opened in new tab')
    } catch (error: unknown) {
      console.error('Failed to open document:', error)

      const errorMessage =
        typeof error === 'object' && error && 'message' in error
          ? String((error as Error).message)
          : ''

      if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        toast.error('Document not found. It may not have been generated yet.')
      } else if (errorMessage.includes('403') || errorMessage.includes('permission')) {
        toast.error('You do not have permission to view this document.')
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        toast.error('Network error. Please check your connection and try again.')
      } else if (errorMessage) {
        toast.error(`Failed to open document: ${errorMessage}`)
      } else {
        toast.error('Failed to open document. Please try again.')
      }
    } finally {
      setLoadingDocument(false)
    }
  }

  const stats = [
    {
      label: 'Processing Time',
      value: durationSeconds !== null ? formatDurationSeconds(durationSeconds) : 'In progress',
      tone: durationSeconds !== null ? 'neutral' : 'warning',
      icon: <FiClock className="h-4 w-4" />,
      helperText:
        durationSeconds !== null
          ? `Completed ${formatRelativeTime(job.completed_at!)}`
          : 'We will calculate duration once this job finishes.',
    },
    totalCost !== null && totalCost >= 0
      ? {
          label: 'Total Cost',
          value: `$${totalCost.toFixed(2)}`,
          tone: totalCost > 5 ? 'warning' : 'neutral',
          icon: <FiDollarSign className="h-4 w-4" />,
          helperText: 'Aggregated from every execution step.',
        }
      : null,
    stepsCount !== null
      ? {
          label: 'Execution Steps',
          value: `${stepsCount} ${stepsCount === 1 ? 'step' : 'steps'}`,
          tone: 'neutral' as const,
          icon: <FiLayers className="h-4 w-4" />,
          helperText: workflow?.steps
            ? 'Loaded from the workflow definition.'
            : 'Pulled from the job execution log.',
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string
    value: string
    tone: 'neutral' | 'positive' | 'warning' | 'danger'
    icon: ReactNode
    helperText?: string
  }>

  const infoItems: KeyValueItem[] = [
    {
      label: 'Job ID',
      value: <code className="text-sm font-semibold text-gray-900">{job.job_id}</code>,
      helperText: 'Reference this when reaching out to support.',
      copyValue: job.job_id,
    },
    job.workflow_id
      ? {
          label: 'Workflow',
          value: workflow ? (
            <button
              type="button"
              onClick={() => router.push(`/dashboard/workflows/${job.workflow_id}`)}
              className="inline-flex items-center gap-1.5 font-medium text-primary-600 transition hover:text-primary-800"
            >
              {workflow.workflow_name || job.workflow_id}
              <FiExternalLink className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <span className="font-medium text-gray-900">{job.workflow_id}</span>
          ),
          helperText: workflow ? 'Opens the workflow in a new view.' : undefined,
        }
      : null,
    {
      label: 'Created',
      value: formatRelativeTime(job.created_at),
      helperText: createdAt.toLocaleString(),
    },
    completedAt
      ? {
          label: 'Completed',
          value: formatRelativeTime(job.completed_at!),
          helperText: completedAt.toLocaleString(),
        }
      : null,
    job.submission_id
      ? {
          label: 'Submission ID',
          value: <span className="font-mono text-sm">{job.submission_id}</span>,
          helperText: 'Form submission tied to this job.',
          copyValue: job.submission_id,
        }
      : null,
    job.execution_steps_s3_key
      ? {
          label: 'Execution Log Key',
          value: <span className="font-mono text-xs break-all">{job.execution_steps_s3_key}</span>,
          helperText: 'Raw execution data location.',
          copyValue: job.execution_steps_s3_key,
        }
      : null,
  ].filter(Boolean) as KeyValueItem[]

  const documentDescription = hasDocument
    ? 'Open the generated asset in a new browser tab.'
    : job.status === 'failed'
      ? 'This job failed before a document could be generated.'
      : 'We will attach a document as soon as the workflow finishes.'

  const documentAction = (
    <div className="rounded-2xl border border-dashed border-primary-200 bg-primary-50/60 px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">Lead magnet document</p>
          <p className="text-xs text-gray-600">{documentDescription}</p>
        </div>
        <button
          type="button"
          onClick={handleViewDocument}
          disabled={!hasDocument || loadingDocument}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-primary-600 px-4 py-2 text-sm font-semibold text-primary-700 transition hover:bg-primary-600 hover:text-white disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-white disabled:text-gray-400"
        >
          {loadingDocument ? (
            <>
              <FiLoader className="h-4 w-4 animate-spin" aria-hidden="true" />
              Preparing...
            </>
          ) : (
            <>
              <FiFileText className="h-4 w-4" aria-hidden="true" />
              {hasDocument ? 'View document' : job.status === 'failed' ? 'Unavailable' : 'Preparing'}
            </>
          )}
        </button>
      </div>
    </div>
  )

  const content = (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-gray-50/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Job status</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={job.status} />
            {job.failed_at && (
              <span className="text-xs font-medium text-red-700">Failed {formatRelativeTime(job.failed_at)}</span>
            )}
            {job.completed_at && (
              <span className="text-xs font-medium text-gray-500">
                Finished {formatRelativeTime(job.completed_at)}
              </span>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-500">
          Started {formatRelativeTime(job.created_at)}
          <span className="ml-1 text-gray-400">({createdAt.toLocaleString()})</span>
        </div>
      </div>

      {documentAction}

      {stats.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <StatPill
              key={stat.label}
              label={stat.label}
              value={stat.value}
              tone={stat.tone}
              helperText={stat.helperText}
              icon={stat.icon}
            />
          ))}
        </div>
      )}

      {infoItems.length > 0 && (
        <KeyValueList items={infoItems} columns={2} onCopy={handleCopyValue} />
      )}

      {job.status === 'failed' && job.error_message && (
        <div
          className="rounded-2xl border border-red-100 bg-red-50/70 p-4 text-sm text-red-900"
          role="alert"
          aria-live="polite"
        >
          <p className="font-semibold">Error details</p>
          <p className="mt-1">
            {job.error_message.includes('Error') || job.error_message.includes('error')
              ? job.error_message
              : `Generation failed: ${job.error_message}`}
          </p>
        </div>
      )}
    </div>
  )

  if (hideContainer) {
    return content
  }

  return (
    <SectionCard
      title="Job details"
      description="Track document generation progress, metadata, and troubleshooting info."
    >
      {content}
    </SectionCard>
  )
}
