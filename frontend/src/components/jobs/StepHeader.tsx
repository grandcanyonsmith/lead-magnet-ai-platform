/**
 * Step Header Component
 * Displays step header with status, name, metrics, and action buttons
 */

import { MergedStep, StepStatus } from '@/types/job'
import { formatDurationMs } from '@/utils/jobFormatting'
import { FiEdit2, FiRefreshCw, FiLoader, FiCheckCircle, FiCircle, FiXCircle } from 'react-icons/fi'

const STEP_TYPE_COLORS: Record<string, string> = {
  form_submission: 'bg-blue-100 text-blue-800',
  ai_generation: 'bg-purple-100 text-purple-800',
  html_generation: 'bg-green-100 text-green-800',
  final_output: 'bg-gray-100 text-gray-800',
  workflow_step: 'bg-gray-100 text-gray-800',
}

const DEFAULT_STEP_TYPE_COLOR = 'bg-gray-100 text-gray-800'

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
        {tools.map((tool: Tool, toolIdx: number) => {
          const toolName = getToolName(tool)
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
  const isPending = status === 'pending'
  const isCompleted = status === 'completed'
  const isInProgress = status === 'in_progress'
  
  const stepTypeColor = STEP_TYPE_COLORS[step.step_type] || DEFAULT_STEP_TYPE_COLOR

  return (
    <div className="flex items-start gap-3 p-3 sm:p-4">
      {/* Status Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {renderStatusIcon(status)}
      </div>
      
      {/* Step Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-2 mb-2">
          <span className={`px-2 py-1 text-xs font-medium rounded flex-shrink-0 ${stepTypeColor}`}>
            Step {step.step_order}
          </span>
          {isInProgress && (
            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full animate-pulse">
              Processing...
            </span>
          )}
          <h3 className={`text-sm sm:text-base font-semibold break-words ${
            isPending ? 'text-gray-500' : 'text-gray-900'
          }`}>
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
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        {/* Metrics - Only show for completed steps */}
        {isCompleted && (
          <div className="flex flex-col items-end gap-1 text-xs text-gray-500">
            {step.duration_ms !== undefined && (
              <span className="font-medium text-gray-700">{formatDurationMs(step.duration_ms)}</span>
            )}
            {step.usage_info && (
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-gray-600">
                  {step.usage_info.total_tokens 
                    ? `${step.usage_info.total_tokens} tokens`
                    : step.usage_info.prompt_tokens || step.usage_info.completion_tokens
                    ? `${(step.usage_info.prompt_tokens || 0) + (step.usage_info.completion_tokens || 0)} tokens`
                    : null}
                </span>
                {step.usage_info?.cost_usd && (
                  <span className="text-gray-600 font-medium">
                    ${typeof step.usage_info.cost_usd === 'number' 
                      ? step.usage_info.cost_usd.toFixed(2) 
                      : parseFloat(step.usage_info.cost_usd || '0').toFixed(2)}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons Row */}
        <div className="flex items-center gap-2">
          {/* Edit Step Button - Only for workflow template steps */}
          {canEdit && onEditStep && step.step_type === 'workflow_step' && step.step_order > 0 && (
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
              title={
                jobStatus === 'processing'
                  ? 'Editing disabled while run is in progress'
                  : 'Edit workflow template step'
              }
              aria-label="Edit workflow template step"
              className={`p-2 rounded transition-colors ${
                jobStatus === 'processing'
                  ? 'text-yellow-600 cursor-not-allowed opacity-60'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <FiEdit2 className="w-4 h-4" />
            </button>
          )}

          {/* Rerun Step Button */}
          {onRerunStep && step.step_order > 0 && step.step_type === 'ai_generation' && (
            <button
              onClick={() => {
                const stepIndex = step.step_order - 1
                onRerunStep(stepIndex)
              }}
              disabled={rerunningStep === step.step_order - 1}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-target"
              title="Rerun this step"
            >
              {rerunningStep === step.step_order - 1 ? (
                <>
                  <FiLoader className="w-3.5 h-3.5 animate-spin" />
                  Rerunning...
                </>
              ) : (
                <>
                  <FiRefreshCw className="w-3.5 h-3.5" />
                  Rerun Step
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

