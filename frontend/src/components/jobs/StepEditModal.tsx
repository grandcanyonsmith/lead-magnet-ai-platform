'use client'

import { useState, useEffect } from 'react'
import { FiX, FiSave, FiAlertCircle } from 'react-icons/fi'
import { WorkflowStep, AIModel, ToolType, ToolChoice } from '@/types'

interface StepEditModalProps {
  step: WorkflowStep | null
  isOpen: boolean
  onClose: () => void
  onSave: (updatedStep: WorkflowStep) => Promise<void>
  jobStatus?: string
}

const AI_MODELS: AIModel[] = [
  'gpt-4o',
  'gpt-4.1',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
  'computer-use-preview',
]

const TOOL_TYPES: ToolType[] = [
  'web_search',
  'web_search_preview',
  'image_generation',
  'computer_use_preview',
  'file_search',
  'code_interpreter',
]

const TOOL_CHOICES: ToolChoice[] = ['auto', 'required', 'none']

export function StepEditModal({
  step,
  isOpen,
  onClose,
  onSave,
  jobStatus,
}: StepEditModalProps) {
  const [formData, setFormData] = useState<WorkflowStep>({
    step_name: '',
    instructions: '',
    model: 'gpt-4o',
    tools: [],
    tool_choice: 'auto',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when step changes or modal opens
  useEffect(() => {
    if (step && isOpen) {
      setFormData({
        step_name: step.step_name,
        step_description: step.step_description,
        instructions: step.instructions,
        model: step.model,
        step_order: step.step_order,
        tools: step.tools || [],
        tool_choice: step.tool_choice || 'auto',
      })
      setError(null)
    }
  }, [step, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.step_name.trim()) {
      setError('Step name is required')
      return
    }
    
    if (!formData.instructions.trim()) {
      setError('Instructions are required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await onSave(formData)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save step changes')
    } finally {
      setSaving(false)
    }
  }

  const handleToolToggle = (tool: ToolType) => {
    const currentTools = formData.tools || []
    const toolStrings = currentTools.map(t => typeof t === 'string' ? t : t.type)
    
    if (toolStrings.includes(tool)) {
      // Remove the tool
      setFormData({
        ...formData,
        tools: currentTools.filter(t => (typeof t === 'string' ? t : t.type) !== tool),
      })
    } else {
      // Add the tool as a simple string
      // (structured configs like ComputerUseToolConfig should be configured separately if needed)
      setFormData({
        ...formData,
        tools: [...currentTools, tool],
      })
    }
  }

  const isToolSelected = (tool: ToolType) => {
    const currentTools = formData.tools || []
    const toolStrings = currentTools.map(t => typeof t === 'string' ? t : t.type)
    return toolStrings.includes(tool)
  }

  if (!isOpen || !step) {
    return null
  }

  const isProcessing = jobStatus === 'processing'

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative z-50 w-full max-w-2xl bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900">Edit Step</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Warning for processing jobs */}
          {isProcessing && (
            <div className="mx-6 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
              <FiAlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Job is currently processing</p>
                <p className="mt-1">Changes will affect future jobs using this workflow template, not the current execution.</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Step Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Step Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.step_name}
                onChange={(e) => setFormData({ ...formData, step_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="e.g., Deep Research"
                required
              />
            </div>

            {/* Step Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Step Description
              </label>
              <input
                type="text"
                value={formData.step_description || ''}
                onChange={(e) => setFormData({ ...formData, step_description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Brief description of this step"
              />
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Instructions <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Detailed instructions for this step..."
                required
              />
            </div>

            {/* AI Model */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                AI Model <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value as AIModel })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {AI_MODELS.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>

            {/* Tools */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tools
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TOOL_TYPES.map((tool) => (
                  <label
                    key={tool}
                    className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isToolSelected(tool)}
                      onChange={() => handleToolToggle(tool)}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{tool}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Tool Choice */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tool Choice
              </label>
              <select
                value={formData.tool_choice || 'auto'}
                onChange={(e) => setFormData({ ...formData, tool_choice: e.target.value as ToolChoice })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {TOOL_CHOICES.map((choice) => (
                  <option key={choice} value={choice}>
                    {choice}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Controls how the AI uses the selected tools
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                <FiSave className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
