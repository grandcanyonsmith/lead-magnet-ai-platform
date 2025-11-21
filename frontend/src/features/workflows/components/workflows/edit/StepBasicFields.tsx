'use client'

import { WorkflowStep, AIModel } from '@/features/workflows/types'

const MODEL_OPTIONS = [
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'computer-use-preview', label: 'Computer Use Preview' },
]

interface StepBasicFieldsProps {
  step: WorkflowStep
  onChange: (field: keyof WorkflowStep, value: any) => void
}

export function StepBasicFields({ step, onChange }: StepBasicFieldsProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Step Name *
        </label>
        <input
          type="text"
          value={step.step_name}
          onChange={(e) => onChange('step_name', e.target.value)}
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
          value={step.step_description || ''}
          onChange={(e) => onChange('step_description', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Brief description of what this step does"
          rows={2}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Step Type *
        </label>
        <select
          value={step.step_type || 'ai_generation'}
          onChange={(e) => {
            const newStepType = e.target.value as 'ai_generation' | 'webhook'
            onChange('step_type', newStepType)
            if (newStepType === 'webhook') {
              // Initialize webhook step with defaults
              onChange('webhook_data_selection', {
                include_submission: true,
                exclude_step_indices: [],
                include_job_info: true
              })
              onChange('webhook_url', '')
              onChange('webhook_headers', {})
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="ai_generation">AI Generation</option>
          <option value="webhook">Webhook</option>
        </select>
      </div>

      {/* AI Generation Step Fields */}
      {(step.step_type === 'ai_generation' || !step.step_type) && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              AI Model *
            </label>
            <select
              value={step.model}
              onChange={(e) => onChange('model', e.target.value as AIModel)}
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
              value={step.instructions}
              onChange={(e) => onChange('instructions', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Detailed instructions for what this step should do..."
              rows={6}
              required
            />
            <p className="mt-1 text-sm text-gray-500">
              These instructions will be passed to the AI model along with context from previous steps.
            </p>
          </div>
        </>
      )}
    </>
  )
}

