/**
 * Step Header Component
 * Displays step header with status, name, metrics, and action buttons
 */

import { MergedStep, StepStatus } from '@/types/job'
import { formatDurationMs } from '@/utils/jobFormatting'
import { StepStatusIndicator } from './StepStatusIndicator'
import { FiEdit2, FiZap, FiRefreshCw, FiLoader } from 'react-icons/fi'

interface StepHeaderProps {
  step: MergedStep
  status: StepStatus
  jobStatus?: string
  canEdit?: boolean
  rerunningStep?: number | null
  onEditStep?: (stepIndex: number) => void
  onQuickEdit?: (stepOrder: number, stepName: string) => void
  onRerunStep?: (stepIndex: number) => Promise<void>
}

export function StepHeader({
  step,
  status,
  jobStatus,
  canEdit = false,
  rerunningStep,
  onEditStep,
  onQuickEdit,
  onRerunStep,
}: StepHeaderProps) {
  const isPending = status === 'pending'
  const isCompleted = status === 'completed'
  const isInProgress = status === 'in_progress'
  
  const stepTypeColors: Record<string, string> = {
    form_submission: 'bg-blue-100 text-blue-800',
    ai_generation: 'bg-purple-100 text-purple-800',
    html_generation: 'bg-green-100 text-green-800',
    final_output: 'bg-gray-100 text-gray-800',
    workflow_step: 'bg-gray-100 text-gray-800',
  }
  const stepTypeColor = stepTypeColors[step.step_type] || 'bg-gray-100 text-gray-800'

  return (
    <div className="flex items-start gap-3 p-3 sm:p-4">
      {/* Status Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <StepStatusIndicator status={status} />
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
            {step.input?.tools && Array.isArray(step.input.tools) && step.input.tools.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-1">
                  {step.input.tools.map((tool: any, toolIdx: number) => {
                    const toolName = typeof tool === 'string' ? tool : tool.type || 'unknown'
                    return (
                      <span key={toolIdx} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded border border-blue-200 whitespace-nowrap">
                        {toolName}
                      </span>
                    )
                  })}
                </div>
                {step.input.tool_choice && (
                  <span className="text-gray-500">
                    ({step.input.tool_choice})
                  </span>
                )}
              </>
            ) : step.tools && Array.isArray(step.tools) && step.tools.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-1">
                  {step.tools.map((tool: any, toolIdx: number) => {
                    const toolName = typeof tool === 'string' ? tool : tool.type || 'unknown'
                    return (
                      <span key={toolIdx} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded border border-blue-200 whitespace-nowrap">
                        {toolName}
                      </span>
                    )
                  })}
                </div>
                {step.tool_choice && (
                  <span className="text-gray-500">
                    ({step.tool_choice})
                  </span>
                )}
              </>
            ) : (
              <span className="px-2 py-0.5 text-xs bg-gray-50 text-gray-600 rounded border border-gray-200">
                None
              </span>
            )}
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
                  {(step.usage_info.input_tokens || 0) + (step.usage_info.output_tokens || 0)} tokens
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

          {/* Quick Edit Button - Available for all steps with output */}
          {onQuickEdit && step.step_order > 0 && step.output !== null && step.output !== undefined && step.output !== '' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onQuickEdit(step.step_order, step.step_name || `Step ${step.step_order}`)
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors touch-target"
              title="Quick edit this step with AI"
            >
              <FiZap className="w-3.5 h-3.5" />
              Quick Edit
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

