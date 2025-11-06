'use client'

import { useState, useEffect } from 'react'
import { FiTrash2, FiChevronUp, FiChevronDown } from 'react-icons/fi'

export interface WorkflowStep {
  step_name: string
  step_description?: string
  model: string
  instructions: string
  step_order?: number
  tools?: string[]
  tool_choice?: 'auto' | 'required' | 'none'
}

interface WorkflowStepEditorProps {
  step: WorkflowStep
  index: number
  totalSteps: number
  onChange: (index: number, step: WorkflowStep) => void
  onDelete: (index: number) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
}

const MODEL_OPTIONS = [
  { value: 'o3-deep-research', label: 'O3 Deep Research' },
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
]

const AVAILABLE_TOOLS = [
  { value: 'web_search_preview', label: 'Web Search Preview', description: 'Enables web search capabilities' },
]

const TOOL_CHOICE_OPTIONS = [
  { value: 'auto', label: 'Auto', description: 'Model decides when to use tools' },
  { value: 'required', label: 'Required', description: 'Model must use at least one tool' },
  { value: 'none', label: 'None', description: 'Disable tools entirely' },
]

export default function WorkflowStepEditor({
  step,
  index,
  totalSteps,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: WorkflowStepEditorProps) {
  const [localStep, setLocalStep] = useState<WorkflowStep>(step)

  // Sync localStep when step prop changes
  useEffect(() => {
    setLocalStep(step)
  }, [step])

  const handleChange = (field: keyof WorkflowStep, value: string | string[]) => {
    const updated = { ...localStep, [field]: value }
    setLocalStep(updated)
    onChange(index, updated)
  }

  const handleToolToggle = (toolValue: string) => {
    const currentTools = localStep.tools || []
    const updatedTools = currentTools.includes(toolValue)
      ? currentTools.filter(t => t !== toolValue)
      : [...currentTools, toolValue]
    handleChange('tools', updatedTools)
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
            className="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
            aria-label="Move step up"
          >
            <FiChevronUp className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => onMoveDown(index)}
            disabled={index === totalSteps - 1}
            className="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
            aria-label="Move step down"
          >
            <FiChevronDown className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(index)}
            className="p-2 text-red-600 hover:text-red-700"
            aria-label="Delete step"
          >
            <FiTrash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Step Name *
          </label>
          <input
            type="text"
            value={localStep.step_name}
            onChange={(e) => handleChange('step_name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="e.g., Deep Research"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Step Description (optional)
          </label>
          <textarea
            value={localStep.step_description || ''}
            onChange={(e) => handleChange('step_description', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Brief description of what this step does"
            rows={2}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            AI Model *
          </label>
          <select
            value={localStep.model}
            onChange={(e) => handleChange('model', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            required
          >
            {MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Instructions *
          </label>
          <textarea
            value={localStep.instructions}
            onChange={(e) => handleChange('instructions', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Detailed instructions for what this step should do..."
            rows={6}
            required
          />
          <p className="mt-1 text-sm text-gray-500">
            These instructions will be passed to the AI model along with context from previous steps.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            OpenAI Tools
          </label>
          <div className="space-y-2 mb-3">
            {AVAILABLE_TOOLS.map((tool) => (
              <label key={tool.value} className="flex items-start space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(localStep.tools || ['web_search_preview']).includes(tool.value)}
                  onChange={() => handleToolToggle(tool.value)}
                  className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">{tool.label}</span>
                  <p className="text-xs text-gray-500">{tool.description}</p>
                </div>
              </label>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tool Choice
            </label>
            <select
              value={localStep.tool_choice || 'auto'}
              onChange={(e) => handleChange('tool_choice', e.target.value as 'auto' | 'required' | 'none')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {TOOL_CHOICE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.description}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

