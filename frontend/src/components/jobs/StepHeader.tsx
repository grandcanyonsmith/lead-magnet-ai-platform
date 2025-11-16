'use client'

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
/**
 * Step Header Component
 * Displays step header with status, name, metrics, and action buttons
 */

import { MergedStep, StepStatus } from '@/types/job'
import { formatDurationMs } from '@/utils/jobFormatting'
import { FiEdit2, FiRefreshCw, FiLoader, FiCheckCircle, FiCircle, FiXCircle, FiMoreVertical } from 'react-icons/fi'
import { Tooltip } from '@/components/ui/Tooltip'

const STEP_TYPE_COLORS: Record<string, string> = {
  form_submission: 'bg-blue-100 text-blue-800',
  ai_generation: 'bg-purple-100 text-purple-800',
  html_generation: 'bg-green-100 text-green-800',
  final_output: 'bg-gray-100 text-gray-800',
  workflow_step: 'bg-gray-100 text-gray-800',
}

const DEFAULT_STEP_TYPE_COLOR = 'bg-gray-100 text-gray-800'

const STEP_STATUS_LABELS: Record<StepStatus, string> = {
  completed: 'Completed',
  in_progress: 'In Progress',
  failed: 'Failed',
  pending: 'Pending',
}

const STEP_STATUS_COLORS: Record<StepStatus, string> = {
  completed: 'bg-green-100 text-green-800 border border-green-200',
  in_progress: 'bg-blue-100 text-blue-800 border border-blue-200',
  failed: 'bg-red-100 text-red-800 border border-red-200',
  pending: 'bg-gray-100 text-gray-700 border border-gray-200',
}

const EDITABLE_STEP_TYPES = new Set(['workflow_step', 'ai_generation', 'webhook'])
const RERUNNABLE_STEP_TYPES = new Set(['workflow_step', 'ai_generation', 'html_generation'])

interface StepHeaderProps {
  step: MergedStep
  status: StepStatus
  jobStatus?: string
  canEdit?: boolean
  rerunningStep?: number | null
  onEditStep?: (stepIndex: number) => void
  onRerunStep?: (stepIndex: number) => Promise<void>
}

// Type for tool - can be a string or an object with a type property
type Tool = string | { type: string; [key: string]: unknown }

// Helper to get tool name from tool object or string
function getToolName(tool: Tool): string {
  return typeof tool === 'string' ? tool : (tool.type || 'unknown')
}

// Render status icon inline
function renderStatusIcon(status: StepStatus) {
  const iconClass = "w-5 h-5 flex-shrink-0"
  switch (status) {
    case 'completed':
      return <FiCheckCircle className={`${iconClass} text-green-600`} />
    case 'in_progress':
      return <FiLoader className={`${iconClass} text-yellow-500 animate-spin`} />
    case 'failed':
      return <FiXCircle className={`${iconClass} text-red-600`} />
    case 'pending':
    default:
      return <FiCircle className={`${iconClass} text-gray-400`} />
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
}: StepHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    if (!menuOpen) return

    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [menuOpen])

  const handleEditClick = (event?: ReactMouseEvent<HTMLButtonElement>) => {
    event?.stopPropagation()
    if (!canEditStep || !onEditStep || disableEdit) return
    onEditStep(workflowStepIndex)
    setMenuOpen(false)
  }

  const handleRerunClick = (event?: ReactMouseEvent<HTMLButtonElement>) => {
    event?.stopPropagation()
    if (!onRerunStep || disableRerun || !canRerunStep) return
    onRerunStep(workflowStepIndex)
    setMenuOpen(false)
  }

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-start">
      {/* Status Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {renderStatusIcon(status)}
      </div>
      
      {/* Step Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-2 mb-2">
          <span className={`px-2 py-1 text-xs font-medium rounded flex-shrink-0 ${stepTypeColor}`}>
            Step {stepOrder}
          </span>
          <span className={`px-2 py-1 text-[11px] font-semibold uppercase tracking-wide rounded-full ${statusColorClass}`}>
            {statusLabel}
          </span>
          {(isInProgress || isRerunningStep) && (
            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full animate-pulse flex items-center gap-1">
              <FiLoader className="w-3.5 h-3.5 animate-spin" />
              {isRerunningStep ? 'Rerunning...' : 'Processing...'}
            </span>
          )}
          {isFailed && step.error && (
            <span className="text-xs font-medium text-red-600 truncate max-w-[180px]" title={step.error}>
              {step.error}
            </span>
          )}
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <h3
            className={`text-sm sm:text-base font-semibold break-words ${
              isPending ? 'text-gray-500' : 'text-gray-900'
            }`}
          >
            {step.step_name}
          </h3>
          {step.model && !isPending && (
            <span className="text-xs text-gray-500 whitespace-nowrap">({step.model})</span>
          )}
        </div>
        
        {/* Tools Section - Only show if step is completed or has tools info */}
        {!isPending && (
          <div className="flex items-center flex-wrap gap-1.5 text-xs">
            <span className="text-gray-500 font-medium">Tools:</span>
            {renderToolBadges(step.input?.tools || step.tools, step.input?.tool_choice || step.tool_choice)}
          </div>
        )}
      </div>

      {/* Right: Metrics and Actions */}
      <div className="flex items-center gap-2 flex-shrink-0 lg:self-start">
        {/* Metrics - Only show for completed steps - Compact summary with tooltip */}
        {isCompleted && (step.duration_ms !== undefined || step.usage_info) && (
          <Tooltip
            content={
              <div className="text-left space-y-1">
                {step.duration_ms !== undefined && (
                  <div>Duration: {formatDurationMs(step.duration_ms)}</div>
                )}
                {step.usage_info && (
                  <>
                    {step.usage_info.total_tokens && (
                      <div>Tokens: {step.usage_info.total_tokens.toLocaleString()}</div>
                    )}
                    {(!step.usage_info.total_tokens && (step.usage_info.prompt_tokens || step.usage_info.completion_tokens)) && (
                      <div>
                        Tokens: {((step.usage_info.prompt_tokens || 0) + (step.usage_info.completion_tokens || 0)).toLocaleString()}
                      </div>
                    )}
                    {step.usage_info?.cost_usd && (
                      <div>
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
            <div className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-50 rounded border border-gray-200 cursor-help">
              {step.duration_ms !== undefined && formatDurationMs(step.duration_ms)}
              {step.usage_info?.cost_usd && (
                <span className="ml-1.5">
                  • ${typeof step.usage_info.cost_usd === 'number' 
                    ? step.usage_info.cost_usd.toFixed(2) 
                    : parseFloat(step.usage_info.cost_usd || '0').toFixed(2)}
                </span>
              )}
            </div>
          </Tooltip>
        )}

        {/* Action Menu */}
        {hasMenuActions && (
          <div className="relative" ref={menuRef}>
            <Tooltip content="Step actions" position="top">
              <button
                onClick={(event) => {
                  event.stopPropagation()
                  setMenuOpen((prev) => !prev)
                }}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="p-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors touch-target min-h-[44px] sm:min-h-0"
              >
                <FiMoreVertical className="w-4 h-4" />
              </button>
            </Tooltip>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-gray-100 bg-white shadow-lg ring-1 ring-black ring-opacity-5"
              >
                <div className="py-1">
                  {canEditStep && (
                    <button
                      role="menuitem"
                      onClick={handleEditClick}
                      disabled={disableEdit}
                      className={`w-full px-4 py-2 text-sm flex items-center gap-2 text-left ${
                        disableEdit
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <FiEdit2 className="w-4 h-4" />
                      Edit Step
                    </button>
                  )}
                  {canRerunStep && (
                    <button
                      role="menuitem"
                      onClick={handleRerunClick}
                      disabled={disableRerun}
                      className={`w-full px-4 py-2 text-sm flex items-center gap-2 text-left ${
                        disableRerun
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-blue-700 hover:bg-blue-50'
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
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

