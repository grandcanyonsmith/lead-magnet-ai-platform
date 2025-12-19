/**
 * Step Header Component
 * Displays step header with status, name, metrics, and action buttons
 */

import { MergedStep, StepStatus } from '@/types/job'
import { formatDurationMs } from '@/utils/jobFormatting'
import {
  PencilSquareIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid'
import { Tooltip } from '@/components/ui/Tooltip'

const STEP_TYPE_COLORS: Record<string, string> = {
  form_submission: 'bg-blue-50 text-blue-700',
  ai_generation: 'bg-purple-50 text-purple-700',
  html_generation: 'bg-green-50 text-green-700',
  final_output: 'bg-gray-50 text-gray-700',
  workflow_step: 'bg-gray-50 text-gray-700',
}

const STEP_STATUS_BADGE: Record<StepStatus, { label: string; className: string }> = {
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800 border border-green-200' },
  in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-800 border border-blue-200' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800 border border-red-200' },
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-700 border border-gray-200' },
}

const STEP_NUMBER_BG: Record<StepStatus, string> = {
  completed: 'bg-green-600',
  in_progress: 'bg-blue-600',
  failed: 'bg-red-600',
  pending: 'bg-gray-400',
}

interface StepHeaderProps {
  step: MergedStep
  status: StepStatus
  jobStatus?: string
  canEdit?: boolean
  rerunningStep?: number | null
  onEditStep?: (stepIndex: number) => void
  onRerunStep?: (stepIndex: number) => Promise<void>
  onRerunStepClick?: (stepIndex: number) => void
}

// Type for tool - can be a string or an object with a type property
type Tool = string | { type: string; [key: string]: unknown }

// Helper to get tool name from tool object or string
function getToolName(tool: Tool): string {
  return typeof tool === 'string' ? tool : (tool.type || 'unknown')
}

// Render status icon inline
function renderStatusIcon(status: StepStatus) {
  const iconClass = 'w-5 h-5 flex-shrink-0'
  switch (status) {
    case 'completed':
      return <CheckCircleIconSolid className={`${iconClass} text-green-600`} />
    case 'in_progress':
      return <ArrowPathIcon className={`${iconClass} text-blue-600 animate-spin`} />
    case 'failed':
      return <XCircleIcon className={`${iconClass} text-red-600`} />
    case 'pending':
    default:
      return <div className={`${iconClass} rounded-full border-2 border-gray-300`} />
  }
}

// Render tool badges inline
function renderToolBadges(tools?: string[] | unknown[], toolChoice?: string) {
  if (!tools || !Array.isArray(tools) || tools.length === 0) {
    return (
      <span className="px-2 py-0.5 text-xs bg-gray-50 text-gray-600 rounded border border-gray-200">
        None
      </span>
    )
  }

  return (
    <>
      <div className="flex flex-wrap gap-1">
        {tools.map((tool, toolIdx) => {
          const toolName = getToolName(tool as Tool)
          return (
            <span
              key={toolIdx}
              className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded border border-blue-200 whitespace-nowrap"
            >
              {toolName}
            </span>
          )
        })}
      </div>
      {toolChoice && (
        <span className="text-gray-500">({toolChoice})</span>
      )}
    </>
  )
}

export function StepHeader({
  step,
  status,
  jobStatus,
  canEdit = false,
  rerunningStep,
  onEditStep,
  onRerunStep,
  onRerunStepClick,
}: StepHeaderProps) {
  const isPending = status === 'pending'
  const isCompleted = status === 'completed'
  const isInProgress = status === 'in_progress'
  const statusBadge = STEP_STATUS_BADGE[status]
  const stepTypeColor = STEP_TYPE_COLORS[step.step_type] || STEP_TYPE_COLORS.workflow_step
  const stepNumberBg = STEP_NUMBER_BG[status] || STEP_NUMBER_BG.pending
  const typeLabel =
    step.step_type === 'final_output'
      ? 'Published deliverable'
      : step.step_type
        ? step.step_type.replace(/_/g, ' ')
        : 'Workflow Step'
  const typeHelp =
    step.step_type === 'final_output'
      ? 'This is the published deliverable URL sent to the customer.'
      : undefined

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {statusBadge && (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadge.className}`}>
                  {renderStatusIcon(status)}
                  {statusBadge.label}
                </span>
              )}
              {typeHelp ? (
                <Tooltip content={typeHelp} position="top">
                  <span className={`px-2 py-0.5 rounded-full border ${stepTypeColor}`}>
                    {typeLabel}
                  </span>
                </Tooltip>
              ) : (
                <span className={`px-2 py-0.5 rounded-full border ${stepTypeColor}`}>
                  {typeLabel}
                </span>
              )}
            </div>
            <h3 className={`text-base sm:text-lg font-semibold break-words ${isPending ? 'text-gray-500' : 'text-gray-900'}`}>
              {step.step_name || 'Untitled step'}
            </h3>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500">
              {step.model && <span>Model: <span className="font-medium text-gray-700">{step.model}</span></span>}
              {step.duration_ms !== undefined && (
                <span>Duration: <span className="font-medium text-gray-700">{formatDurationMs(step.duration_ms)}</span></span>
              )}
              {step.usage_info?.cost_usd !== undefined && (
                <span>
                  Cost: <span className="font-medium text-gray-700">$
                  {typeof step.usage_info.cost_usd === 'number'
                    ? step.usage_info.cost_usd.toFixed(4)
                    : parseFloat(String(step.usage_info.cost_usd) || '0').toFixed(4)}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end lg:self-auto">
          {isCompleted && (step.duration_ms !== undefined || step.usage_info) && (
            <Tooltip
              content={
                <div className="text-left space-y-1">
                  {step.duration_ms !== undefined && (
                    <div>Duration: {formatDurationMs(step.duration_ms)}</div>
                  )}
                  {step.usage_info && (
                    <>
                      {step.usage_info.total_tokens ? (
                        <div>Tokens: {step.usage_info.total_tokens.toLocaleString()}</div>
                      ) : (step.usage_info.input_tokens || step.usage_info.output_tokens ||
                           step.usage_info.prompt_tokens || step.usage_info.completion_tokens) ? (
                        <div>
                          Tokens:{' '}
                          {(
                            (step.usage_info.input_tokens || step.usage_info.prompt_tokens || 0) +
                            (step.usage_info.output_tokens || step.usage_info.completion_tokens || 0)
                          ).toLocaleString()}
                        </div>
                      ) : null}
                      {step.usage_info?.cost_usd !== undefined && (
                        <div>
                          Cost: $
                          {typeof step.usage_info.cost_usd === 'number'
                            ? step.usage_info.cost_usd.toFixed(4)
                            : parseFloat(String(step.usage_info.cost_usd) || '0').toFixed(4)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              }
              position="top"
            >
              <div className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-50 rounded-full border border-gray-200 cursor-help">
                {step.duration_ms !== undefined && formatDurationMs(step.duration_ms)}
                {step.usage_info?.cost_usd !== undefined && (
                  <span className="ml-1.5">
                    • $
                    {typeof step.usage_info.cost_usd === 'number'
                      ? step.usage_info.cost_usd.toFixed(4)
                      : parseFloat(String(step.usage_info.cost_usd) || '0').toFixed(4)}
                  </span>
                )}
              </div>
            </Tooltip>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {/* Edit Step Button - Only for workflow template steps */}
            {canEdit && onEditStep && step.step_type === 'workflow_step' && step.step_order > 0 && (
              <Tooltip
                content={
                  jobStatus === 'processing'
                    ? 'Editing disabled while run is in progress'
                    : 'Edit workflow template step'
                }
                position="top"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (jobStatus === 'processing') {
                      return
                    }
                    const workflowStepIndex = step.step_order - 1
                    onEditStep(workflowStepIndex)
                  }}
                  disabled={jobStatus === 'processing'}
                  aria-label="Edit workflow template step"
                  className={`p-1.5 rounded transition-colors touch-target min-h-[44px] sm:min-h-0 ${
                    jobStatus === 'processing'
                      ? 'text-yellow-600 cursor-not-allowed opacity-60'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <PencilSquareIcon className="w-5 h-5" />
                </button>
              </Tooltip>
            )}

            {/* Rerun Step Button - Available for all executable steps except form_submission (step 0) */}
            {(onRerunStep || onRerunStepClick) &&
              step.step_order > 0 &&
              step.step_type !== 'form_submission' &&
              step.step_type !== 'final_output' && (
                <Tooltip
                  content={
                    rerunningStep === step.step_order - 1
                      ? 'Rerunning step...'
                      : status === 'pending'
                        ? 'Step has not run yet'
                        : status === 'in_progress'
                          ? 'Step is currently running'
                          : 'Rerun this step'
                  }
                  position="top"
                >
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (status === 'pending' || status === 'in_progress') {
                        if (process.env.NODE_ENV === 'development') {
                          console.warn(`[StepHeader] Cannot rerun step: status is ${status}`)
                        }
                        return
                      }
                      const stepIndex = step.step_order - 1
                      if (process.env.NODE_ENV === 'development') {
                        console.log(
                          `[StepHeader] Rerun button clicked for step ${step.step_order} (index ${stepIndex})`
                        )
                      }
                      // Use dialog callback if provided, otherwise fall back to direct rerun
                      if (onRerunStepClick) {
                        onRerunStepClick(stepIndex)
                      } else if (onRerunStep) {
                        // Fallback to direct rerun for backward compatibility
                        onRerunStep(stepIndex).catch((error) => {
                          if (process.env.NODE_ENV === 'development') {
                            console.error('[StepHeader] Error in rerun handler:', error)
                          }
                        })
                      }
                    }}
                    disabled={
                      rerunningStep === step.step_order - 1 ||
                      status === 'pending' ||
                      status === 'in_progress' ||
                      (!onRerunStep && !onRerunStepClick)
                    }
                    className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-target min-h-[44px] sm:min-h-0"
                    aria-label="Rerun this step"
                  >
                    {rerunningStep === step.step_order - 1 ? (
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    ) : (
                      <ArrowPathIcon className="w-5 h-5" />
                    )}
                  </button>
                </Tooltip>
              )}
          </div>
        </div>
      </div>
    </div>
  )
}

