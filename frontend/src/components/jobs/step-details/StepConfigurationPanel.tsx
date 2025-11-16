'use client'

import { FiEdit } from 'react-icons/fi'
import { MergedStep, ExecutionStep } from '@/types/job'
import { ContextSection } from './ContextSection'

interface StepConfigurationPanelProps {
  step: MergedStep
  formSubmission: Record<string, unknown> | null | undefined
  previousSteps: ExecutionStep[]
  onEditStep?: (stepIndex: number) => void
  canEdit?: boolean
}

export function StepConfigurationPanel({
  step,
  formSubmission,
  previousSteps,
  onEditStep,
  canEdit = false,
}: StepConfigurationPanelProps) {
  const workflowStepIndex =
    step.step_order && step.step_order > 0 ? step.step_order - 1 : 0

  const canEditStep =
    canEdit &&
    Boolean(onEditStep) &&
    ['workflow_step', 'ai_generation', 'webhook'].includes(step.step_type) &&
    step.step_order !== undefined &&
    step.step_order > 0

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm">
      <div className="bg-slate-50 px-3 py-2 md:py-1.5 border-b border-gray-300 flex items-center justify-between">
        <span className="text-sm md:text-xs font-semibold text-gray-700">Configuration</span>
        {canEditStep && onEditStep && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEditStep(workflowStepIndex)
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-colors"
            title="Edit workflow step"
          >
            <FiEdit className="w-4 h-4" />
            <span>Edit Step</span>
          </button>
        )}
      </div>
      <div className="p-4 md:p-3 bg-white space-y-3 md:space-y-2">
        {step.instructions ? (
          <div>
            <span className="text-xs font-semibold text-gray-600 uppercase">Instructions</span>
            <pre className="text-sm text-gray-700 mt-1 whitespace-pre-wrap font-sans bg-gray-50 p-2.5 rounded border border-gray-200">
              {step.instructions}
            </pre>
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            This step is configured but does not have custom instructions yet. It will run with the default workflow settings once triggered.
          </div>
        )}
        {step.tool_choice && step.tool_choice !== 'auto' && (
          <div>
            <span className="text-xs font-semibold text-gray-600 uppercase">Tool Choice</span>
            <p className="text-sm text-gray-700 mt-1 font-mono">{step.tool_choice}</p>
          </div>
        )}
        {(previousSteps.length > 0 || formSubmission) && (
          <div className="pt-3 md:pt-2.5 border-t border-dashed border-gray-200">
            <ContextSection
              previousSteps={previousSteps}
              formSubmission={formSubmission}
              currentStepOrder={step.step_order ?? 0}
            />
          </div>
        )}
      </div>
    </div>
  )
}

