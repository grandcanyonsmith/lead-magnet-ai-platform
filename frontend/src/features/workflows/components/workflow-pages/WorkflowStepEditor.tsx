'use client'

import { FiTrash2, FiChevronUp, FiChevronDown } from 'react-icons/fi'
import { WorkflowStep } from '@/features/workflows/types'
import { StepBasicFields } from '../workflows/edit/StepBasicFields'
import { StepToolSelector } from '../workflows/edit/StepToolSelector'
import { WebhookConfig } from '../workflows/edit/WebhookConfig'
import { AIStepAssistant } from '../workflows/edit/AIStepAssistant'
import { useStepEditor } from '../../hooks/workflows-extra/useStepEditor'
import { useToolManagement } from '../../hooks/workflows-extra/useToolManagement'

interface WorkflowStepEditorProps {
  step: WorkflowStep
  index: number
  totalSteps: number
  allSteps?: WorkflowStep[] // All steps for dependency selection
  onChange: (index: number, step: WorkflowStep) => void
  onDelete: (index: number) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  workflowId?: string // Required for AI features
}

export default function WorkflowStepEditor({
  step,
  index,
  totalSteps,
  allSteps = [],
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  workflowId,
}: WorkflowStepEditorProps) {
  const { localStep, webhookHeaders, handleChange, handleWebhookHeadersChange } = useStepEditor({
    step,
    index,
    onChange,
  })

  const {
    computerUseConfig,
    isToolSelected,
    handleToolToggle,
    handleComputerUseConfigChange,
  } = useToolManagement({
    step: localStep,
    onChange: handleChange,
  })

  const handleAIAccept = (proposed: WorkflowStep) => {
    onChange(index, proposed)
  }

  return (
    <div className="border border-gray-300 rounded-lg p-6 bg-white shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-gray-400">
            <span className="text-xs">⋮⋮</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            Step {index + 1}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onMoveUp(index)}
            disabled={index === 0}
            className="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed touch-target"
            aria-label="Move step up"
          >
            <FiChevronUp className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => onMoveDown(index)}
            disabled={index === totalSteps - 1}
            className="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed touch-target"
            aria-label="Move step down"
          >
            <FiChevronDown className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(index)}
            className="p-2 text-red-600 hover:text-red-700 touch-target"
            aria-label="Delete step"
          >
            <FiTrash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* AI Assist Section */}
      <AIStepAssistant
        workflowId={workflowId}
        step={localStep}
        stepIndex={index}
        onAccept={handleAIAccept}
      />

      <div className="space-y-4">
        <StepBasicFields step={localStep} onChange={handleChange} />

        {/* AI Generation Step Fields */}
        {(localStep.step_type === 'ai_generation' || !localStep.step_type) && (
          <StepToolSelector
            step={localStep}
            isToolSelected={isToolSelected}
            onToolToggle={handleToolToggle}
            onToolChoiceChange={(value) => handleChange('tool_choice', value)}
            onComputerUseConfigChange={handleComputerUseConfigChange}
            computerUseConfig={computerUseConfig}
          />
        )}

        {/* Webhook Step Fields */}
        {localStep.step_type === 'webhook' && (
          <WebhookConfig
            step={localStep}
            webhookHeaders={webhookHeaders}
            allSteps={allSteps}
            currentStepIndex={index}
            onChange={handleChange}
            onWebhookHeadersChange={handleWebhookHeadersChange}
          />
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dependencies (optional)
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Select which steps must complete before this step runs. Leave empty to auto-detect from step order.
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
            {allSteps.length > 0 ? (
              allSteps.map((otherStep, otherIndex) => {
                if (otherIndex === index) return null // Can't depend on itself
                const isSelected = (localStep.depends_on || []).includes(otherIndex)
                return (
                  <label key={otherIndex} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        const currentDeps = localStep.depends_on || []
                        const newDeps = e.target.checked
                          ? [...currentDeps, otherIndex]
                          : currentDeps.filter((dep: number) => dep !== otherIndex)
                        handleChange('depends_on', newDeps)
                      }}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-900">
                      Step {otherIndex + 1}: {otherStep.step_name}
                    </span>
                  </label>
                )
              })
            ) : (
              <p className="text-sm text-gray-500">No other steps available</p>
            )}
          </div>
          {localStep.depends_on && localStep.depends_on.length > 0 && (
            <p className="mt-2 text-xs text-gray-600">
              Depends on: {localStep.depends_on.map((dep: number) => `Step ${dep + 1}`).join(', ')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}


