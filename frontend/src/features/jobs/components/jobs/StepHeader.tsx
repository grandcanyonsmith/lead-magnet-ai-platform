'use client'

import { type MouseEvent as ReactMouseEvent } from 'react'
/**
 * Step Header Component
 * Displays step header with status, name, metrics, and action buttons
 */

import { Menu } from '@headlessui/react'
import { MergedStep, StepStatus } from '@/features/jobs/types'
import { formatDurationMs, formatRelativeTime } from '@/features/jobs/utils/jobFormatting'
import { FiEdit2, FiRefreshCw, FiLoader, FiCheckCircle, FiCircle, FiXCircle, FiMoreVertical } from 'react-icons/fi'
import { Tooltip } from '@/shared/components/ui/Tooltip'
import { ToolBadgeList } from './ToolBadgeList'

const STEP_TYPE_COLORS: Record<string, string> = {
  form_submission: 'bg-brand-50 text-brand-800',
  ai_generation: 'bg-emerald-50 text-emerald-800',
  html_generation: 'bg-amber-50 text-amber-800',
  final_output: 'bg-surface-50 text-ink-800',
  workflow_step: 'bg-surface-50 text-ink-800',
}

const DEFAULT_STEP_TYPE_COLOR = 'bg-surface-50 text-ink-800'

const STEP_STATUS_LABELS: Record<StepStatus, string> = {
  completed: 'Completed',
  in_progress: 'In Progress',
  failed: 'Failed',
  pending: 'Pending',
}

const STEP_STATUS_COLORS: Record<StepStatus, string> = {
  completed: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  in_progress: 'bg-brand-50 text-brand-800 border border-brand-200',
  failed: 'bg-red-50 text-red-800 border border-red-200',
  pending: 'bg-surface-50 text-ink-700 border border-white/60',
}

const EDITABLE_STEP_TYPES = new Set(['workflow_step', 'ai_generation', 'webhook'])
const RERUNNABLE_STEP_TYPES = new Set(['workflow_step', 'ai_generation', 'html_generation'])

type StatusSubtextTone = 'default' | 'danger'

function getStatusSubtext(step: MergedStep, status: StepStatus): { text: string; tone: StatusSubtextTone } | null {
  if (status === 'completed' && step.completed_at) {
    return {
      text: `Completed ${formatRelativeTime(step.completed_at)}`,
      tone: 'default',
    }
  }

  if (status === 'in_progress') {
    if (step.started_at) {
      return {
        text: `Started ${formatRelativeTime(step.started_at)}`,
        tone: 'default',
      }
    }
    return {
      text: 'Currently running',
      tone: 'default',
    }
  }

  if (status === 'failed') {
    if (step.error) {
      return { text: step.error, tone: 'danger' }
    }
    return { text: 'Step failed before producing output', tone: 'danger' }
  }

  if (status === 'pending') {
    return { text: 'Waiting for the workflow to reach this step', tone: 'default' }
  }

  return null
}

interface StepHeaderProps {
  step: MergedStep
  status: StepStatus
  jobStatus?: string
  canEdit?: boolean
  rerunningStep?: number | null
  onEditStep?: (stepIndex: number) => void
  onRerunStep?: (stepIndex: number) => Promise<void>
}

// Render status icon inline
function renderStatusIcon(status: StepStatus) {
  const iconClass = "w-5 h-5 flex-shrink-0"
  switch (status) {
    case 'completed':
      return <FiCheckCircle className={`${iconClass} text-emerald-600`} />
    case 'in_progress':
      return <FiLoader className={`${iconClass} text-brand-600 animate-spin`} />
    case 'failed':
      return <FiXCircle className={`${iconClass} text-red-600`} />
    case 'pending':
    default:
      return <FiCircle className={`${iconClass} text-ink-400`} />
  }
}

export function StepHeader({
  step,
  status,
  jobStatus,
  canEdit = false,
  rerunningStep,
  onEditStep,
  onRerunStep,
}: StepHeaderProps) {
  const isPending = status === 'pending'
  const isCompleted = status === 'completed'
  const isInProgress = status === 'in_progress'
  const isFailed = status === 'failed'
  const stepOrder = step.step_order ?? 0
  const stepTypeColor = STEP_TYPE_COLORS[step.step_type] || DEFAULT_STEP_TYPE_COLOR
  const statusLabel = STEP_STATUS_LABELS[status]
  const statusColorClass = STEP_STATUS_COLORS[status]
  const workflowStepIndex = stepOrder > 0 ? stepOrder - 1 : 0
  const isRerunningStep = rerunningStep === workflowStepIndex
  const isAnotherStepRerunning = rerunningStep !== null && !isRerunningStep
  const jobIsActivelyProcessing = jobStatus === 'processing' && rerunningStep === null
  const canEditStep =
    !!canEdit &&
    !!onEditStep &&
    EDITABLE_STEP_TYPES.has(step.step_type) &&
    stepOrder > 0
  const canRerunStep =
    !!onRerunStep &&
    RERUNNABLE_STEP_TYPES.has(step.step_type) &&
    stepOrder > 0
  const hasMenuActions = canEditStep || canRerunStep
  const disableEdit = jobStatus === 'processing'
  const disableRerun = jobIsActivelyProcessing || isRerunningStep || isAnotherStepRerunning
  const statusSubtext = getStatusSubtext(step, status)

  const handleEditClick = (event?: ReactMouseEvent<HTMLButtonElement>) => {
    event?.stopPropagation()
    if (!canEditStep || !onEditStep || disableEdit) return
    onEditStep(workflowStepIndex)
  }

  const handleRerunClick = (event?: ReactMouseEvent<HTMLButtonElement>) => {
    event?.stopPropagation()
    if (!onRerunStep || disableRerun || !canRerunStep) return
    onRerunStep(workflowStepIndex)
  }

  return (
    <div className="relative border-b border-white/60 bg-white">
      <div className="relative flex flex-col gap-4 p-5 sm:pr-6 lg:flex-row lg:items-start lg:gap-5">
        {/* Status Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <div className={`p-3 rounded-2xl bg-white border shadow-soft ring-1 transition-all duration-200 ${
            isCompleted ? 'border-emerald-200/70 ring-emerald-100/60' :
            isInProgress ? 'border-brand-200/70 ring-brand-100/60' :
            isFailed ? 'border-red-200/70 ring-red-100/60' :
            'border-white/60 ring-white/50'
          }`}>
            {renderStatusIcon(status)}
          </div>
        </div>
        
        {/* Step Content */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Badges Row */}
          <div className="flex items-center flex-wrap gap-2.5">
            <span className={`px-3 py-1.5 text-xs font-bold rounded-2xl flex-shrink-0 shadow-sm ring-1 ring-black/5 transition-all duration-200 ${stepTypeColor}`}>
              Step {stepOrder}
            </span>
            <span className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-2xl shadow-sm ring-1 ring-black/5 transition-all duration-200 ${statusColorClass}`}>
              {statusLabel}
            </span>
            {(isInProgress || isRerunningStep) && (
              <span className="px-3.5 py-1.5 text-xs font-semibold bg-brand-50 text-brand-800 rounded-2xl animate-pulse flex items-center gap-1.5 shadow-sm ring-1 ring-blue-200/50">
                <FiLoader className="w-3.5 h-3.5 animate-spin" />
                {isRerunningStep ? 'Rerunning...' : 'Processing...'}
              </span>
            )}
          </div>

          {/* Title Row */}
          <div className="space-y-2">
            <div className="flex items-start flex-wrap gap-3">
              <h3
                className={`text-lg sm:text-xl font-bold break-words leading-tight tracking-tight ${
                  isPending ? 'text-ink-500' : 'text-ink-900'
                }`}
              >
                {step.step_name}
              </h3>
              {step.model && !isPending && (
                <span className="text-xs text-ink-700 whitespace-nowrap px-3 py-1.5 bg-surface-50 rounded-2xl font-semibold border border-white/60 shadow-sm ring-1 ring-white/50">
                  {step.model}
                </span>
              )}
            </div>
            
            {/* Status Subtext */}
            {statusSubtext && (
              <div
                className={`text-sm font-medium ${
                  statusSubtext.tone === 'danger' ? 'text-red-600' : 'text-ink-600'
                }`}
              >
                {statusSubtext.text}
              </div>
            )}
          </div>
          
          {/* Tools Section - Only show if step is completed or has tools info */}
          {!isPending && (
            <div className="flex items-center flex-wrap gap-2.5 text-sm pt-1">
              <span className="text-ink-600 font-semibold">Tools:</span>
              <ToolBadgeList tools={step.input?.tools || step.tools} toolChoice={step.input?.tool_choice || step.tool_choice} />
            </div>
          )}
        </div>

        {/* Right: Metrics + Actions */}
        <div className="flex items-start gap-3 flex-shrink-0 lg:self-start mt-2 lg:mt-0 ml-auto">
          {isCompleted && (step.duration_ms !== undefined || step.usage_info) && (
            <Tooltip
              content={
                <div className="text-left space-y-1.5 text-sm">
                  {step.duration_ms !== undefined && (
                    <div className="font-medium">Duration: {formatDurationMs(step.duration_ms)}</div>
                  )}
                  {step.usage_info && (
                    <>
                      {step.usage_info.total_tokens && (
                        <div className="font-medium">Tokens: {step.usage_info.total_tokens.toLocaleString()}</div>
                      )}
                      {(!step.usage_info.total_tokens && (step.usage_info.prompt_tokens || step.usage_info.completion_tokens)) && (
                        <div className="font-medium">
                          Tokens: {((step.usage_info.prompt_tokens || 0) + (step.usage_info.completion_tokens || 0)).toLocaleString()}
                        </div>
                      )}
                      {step.usage_info?.cost_usd && (
                        <div className="font-medium">
                          Cost: ${typeof step.usage_info.cost_usd === 'number' 
                            ? step.usage_info.cost_usd.toFixed(2) 
                            : parseFloat(step.usage_info.cost_usd || '0').toFixed(2)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              }
              position="top"
            >
              <div className="px-4 py-2 text-sm font-semibold text-ink-700 bg-surface-50 rounded-2xl border border-white/60 shadow-soft ring-1 ring-white/50 cursor-help hover:shadow-md hover:border-white/80 transition-all duration-200">
                {step.duration_ms !== undefined && formatDurationMs(step.duration_ms)}
                {step.usage_info?.cost_usd && (
                  <span className="ml-2.5 text-ink-600">
                    • ${typeof step.usage_info.cost_usd === 'number' 
                      ? step.usage_info.cost_usd.toFixed(2) 
                      : parseFloat(step.usage_info.cost_usd || '0').toFixed(2)}
                  </span>
                )}
              </div>
            </Tooltip>
          )}

          {hasMenuActions && (
            <Menu as="div" className="relative">
              {({ open }) => (
                <>
                  <Tooltip content="Step actions" position="top">
                    <Menu.Button
                      onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
                        event.stopPropagation()
                      }}
                      className={`p-2 rounded-2xl transition-all touch-target min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white ${
                        open 
                          ? 'bg-surface-50 text-ink-900 shadow-soft' 
                          : 'text-ink-500 hover:text-ink-900 hover:bg-surface-50'
                      }`}
                    >
                      <FiMoreVertical className="w-4 h-4" />
                    </Menu.Button>
                  </Tooltip>
                  <Menu.Items className="absolute right-0 z-20 mt-2 w-52 rounded-2xl border border-white/60 bg-white shadow-soft ring-1 ring-black/5 focus:outline-none focus-visible:outline-none overflow-hidden">
                    <div className="py-1">
                      {canEditStep && (
                        <Menu.Item disabled={disableEdit}>
                          {({ active, disabled }) => (
                            <button
                              onClick={handleEditClick}
                              disabled={disabled}
                              className={`w-full px-4 py-3 text-sm flex items-center gap-2 text-left ${
                                disabled
                                  ? 'text-ink-400 cursor-not-allowed'
                                  : active
                                    ? 'bg-surface-50 text-ink-900'
                                    : 'text-ink-700'
                              }`}
                            >
                              <FiEdit2 className="w-4 h-4" />
                              Edit Step
                            </button>
                          )}
                        </Menu.Item>
                      )}
                      {canRerunStep && (
                        <Menu.Item disabled={disableRerun}>
                          {({ active, disabled }) => (
                            <button
                              onClick={handleRerunClick}
                              disabled={disabled}
                              className={`w-full px-4 py-3 text-sm flex items-center gap-2 text-left ${
                                disabled
                                  ? 'text-ink-400 cursor-not-allowed'
                                  : active
                                    ? 'bg-brand-50 text-brand-800'
                                    : 'text-brand-700'
                              }`}
                            >
                              {isRerunningStep ? (
                                <FiLoader className="w-4 h-4 animate-spin" />
                              ) : (
                                <FiRefreshCw className="w-4 h-4" />
                              )}
                              Rerun Step
                            </button>
                          )}
                        </Menu.Item>
                      )}
                    </div>
                  </Menu.Items>
                </>
              )}
            </Menu>
          )}
        </div>
      </div>
    </div>
  )
}
