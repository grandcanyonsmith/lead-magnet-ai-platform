'use client'

import { useState, useEffect } from 'react'
import { FiTrash2, FiChevronUp, FiChevronDown, FiZap, FiChevronDown as FiChevronCollapse, FiChevronUp as FiChevronExpand } from 'react-icons/fi'
import { useWorkflowStepAI } from '@/hooks/useWorkflowStepAI'
import StepDiffPreview from '@/components/workflows/edit/StepDiffPreview'
import toast from 'react-hot-toast'

export interface WorkflowStep {
  step_name: string
  step_description?: string
  model: string
  instructions: string
  step_order?: number
  depends_on?: number[] // Array of step indices this step depends on
  tools?: (string | { type: string; [key: string]: any })[]
  tool_choice?: 'auto' | 'required' | 'none'
}

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

const MODEL_OPTIONS = [
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'computer-use-preview', label: 'Computer Use Preview' },
]

const AVAILABLE_TOOLS = [
  { value: 'web_search', label: 'Web Search', description: 'Web search capabilities (newer version)' },
  { value: 'web_search_preview', label: 'Web Search Preview', description: 'Web search preview capabilities' },
  { value: 'image_generation', label: 'Image Generation', description: 'Generate images from text descriptions' },
  { value: 'computer_use_preview', label: 'Computer Use Preview', description: 'Control computer interfaces (requires configuration)' },
  { value: 'file_search', label: 'File Search', description: 'Search uploaded files for context' },
  { value: 'code_interpreter', label: 'Code Interpreter', description: 'Execute Python code in a secure sandbox' },
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
  allSteps = [],
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  workflowId,
}: WorkflowStepEditorProps) {
  const [localStep, setLocalStep] = useState<WorkflowStep>(step)
  const [computerUseConfig, setComputerUseConfig] = useState({
    display_width: 1024,
    display_height: 768,
    environment: 'browser' as 'browser' | 'mac' | 'windows' | 'ubuntu',
  })
  const [aiPrompt, setAiPrompt] = useState('')
  const [showAIAssist, setShowAIAssist] = useState(false)

  // Always call hook unconditionally to comply with Rules of Hooks
  const { isGenerating, error: aiError, proposal, generateStep, acceptProposal, rejectProposal } = useWorkflowStepAI(workflowId)

  // Sync localStep when step prop changes
  useEffect(() => {
    setLocalStep(step)
    // Extract computer_use_preview config if present
    const computerUseTool = (step.tools || []).find(
      (t) => (typeof t === 'object' && t.type === 'computer_use_preview') || t === 'computer_use_preview'
    )
    if (computerUseTool && typeof computerUseTool === 'object') {
      setComputerUseConfig({
        display_width: computerUseTool.display_width || 1024,
        display_height: computerUseTool.display_height || 768,
        environment: computerUseTool.environment || 'browser',
      })
    }
  }, [step])

  const handleChange = (field: keyof WorkflowStep, value: string | string[] | number[] | (string | { type: string; [key: string]: any })[]) => {
    const updated = { ...localStep, [field]: value }
    setLocalStep(updated)
    onChange(index, updated)
  }

  const isToolSelected = (toolValue: string): boolean => {
    const currentTools = localStep.tools || []
    return currentTools.some(t => {
      if (typeof t === 'string') return t === toolValue
      return t.type === toolValue
    })
  }

  const handleToolToggle = (toolValue: string) => {
    const currentTools = localStep.tools || []
    const isSelected = isToolSelected(toolValue)
    
    let updatedTools: (string | { type: string; [key: string]: any })[]
    
    if (isSelected) {
      // Remove tool
      updatedTools = currentTools.filter(t => {
        if (typeof t === 'string') return t !== toolValue
        return t.type !== toolValue
      })
    } else {
      // Add tool
      if (toolValue === 'computer_use_preview') {
        // Add as object with config
        updatedTools = [...currentTools, {
          type: 'computer_use_preview',
          display_width: computerUseConfig.display_width,
          display_height: computerUseConfig.display_height,
          environment: computerUseConfig.environment,
        }]
      } else {
        // Add as string
        updatedTools = [...currentTools, toolValue]
      }
    }
    
    handleChange('tools', updatedTools)
  }

  const handleComputerUseConfigChange = (field: 'display_width' | 'display_height' | 'environment', value: number | string) => {
    const newConfig = { ...computerUseConfig, [field]: value }
    setComputerUseConfig(newConfig)
    
    // Update the tool object in tools array
    const currentTools = localStep.tools || []
    const updatedTools = currentTools.map(t => {
      if (typeof t === 'object' && t.type === 'computer_use_preview') {
        return {
          ...t,
          display_width: newConfig.display_width,
          display_height: newConfig.display_height,
          environment: newConfig.environment,
        }
      }
      return t
    })
    
    // If computer_use_preview is selected but not in tools array, add it
    if (isToolSelected('computer_use_preview') && !updatedTools.some(t => typeof t === 'object' && t.type === 'computer_use_preview')) {
      updatedTools.push({
        type: 'computer_use_preview',
        display_width: newConfig.display_width,
        display_height: newConfig.display_height,
        environment: newConfig.environment,
      })
    }
    
    handleChange('tools', updatedTools)
  }

  const handleAIGenerate = async () => {
    if (!generateStep || !aiPrompt.trim()) {
      toast.error('Please enter a prompt')
      return
    }

    try {
      await generateStep(aiPrompt, localStep, index, 'update')
    } catch (err: any) {
      toast.error(aiError || 'Failed to generate step configuration')
    }
  }

  const handleAcceptProposal = () => {
    if (!proposal || !acceptProposal) return

    const acceptedProposal = acceptProposal()
    if (acceptedProposal) {
      const { proposed } = acceptedProposal
      setLocalStep(proposed)
      onChange(index, proposed)
      setAiPrompt('')
      toast.success('AI changes applied successfully')
    }
  }

  const handleRejectProposal = () => {
    if (!rejectProposal) return
    rejectProposal()
    setAiPrompt('')
    toast('AI proposal rejected')
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
      {workflowId && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowAIAssist(!showAIAssist)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg hover:from-purple-100 hover:to-blue-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FiZap className="w-5 h-5 text-purple-600" />
              <span className="font-semibold text-purple-900">AI Assist</span>
              <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                Beta
              </span>
            </div>
            {showAIAssist ? (
              <FiChevronExpand className="w-5 h-5 text-purple-600" />
            ) : (
              <FiChevronCollapse className="w-5 h-5 text-purple-600" />
            )}
          </button>

          {showAIAssist && (
            <div className="mt-3 p-4 border border-purple-200 rounded-lg bg-white">
              <p className="text-sm text-gray-600 mb-3">
                Describe how you want to change this step, and AI will generate an updated configuration for you to review.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    What would you like to change?
                  </label>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g., 'Change the model to GPT-4o and add web search tool' or 'Update instructions to focus on competitive analysis'"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    rows={3}
                    disabled={isGenerating}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAIGenerate}
                  disabled={!aiPrompt.trim() || isGenerating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-colors"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FiZap className="w-4 h-4" />
                      Generate with AI
                    </>
                  )}
                </button>

                {aiError && (
                  <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded border border-red-200">
                    {aiError}
                  </div>
                )}

                {proposal && (
                  <div className="mt-4">
                    <StepDiffPreview
                      original={proposal.original}
                      proposed={proposal.proposed}
                      action={proposal.action}
                      onAccept={handleAcceptProposal}
                      onReject={handleRejectProposal}
                      isLoading={false}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

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
                  checked={isToolSelected(tool.value)}
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
          
          {/* Computer Use Preview Configuration */}
          {isToolSelected('computer_use_preview') && (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Computer Use Preview Configuration
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Display Width
                  </label>
                  <input
                    type="number"
                    value={computerUseConfig.display_width}
                    onChange={(e) => handleComputerUseConfigChange('display_width', parseInt(e.target.value) || 1024)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    min="100"
                    max="4096"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Display Height
                  </label>
                  <input
                    type="number"
                    value={computerUseConfig.display_height}
                    onChange={(e) => handleComputerUseConfigChange('display_height', parseInt(e.target.value) || 768)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    min="100"
                    max="4096"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Environment
                </label>
                <select
                  value={computerUseConfig.environment}
                  onChange={(e) => handleComputerUseConfigChange('environment', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  <option value="browser">Browser</option>
                  <option value="mac">macOS</option>
                  <option value="windows">Windows</option>
                  <option value="ubuntu">Ubuntu</option>
                </select>
              </div>
            </div>
          )}
          
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

