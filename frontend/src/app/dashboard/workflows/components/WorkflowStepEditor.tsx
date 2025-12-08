'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { FiTrash2, FiChevronUp, FiChevronDown, FiZap, FiChevronDown as FiChevronCollapse, FiChevronUp as FiChevronExpand } from 'react-icons/fi'
import { useWorkflowStepAI } from '@/hooks/useWorkflowStepAI'
import StepDiffPreview from '@/components/workflows/edit/StepDiffPreview'
import toast from 'react-hot-toast'
import { WorkflowStep, AIModel, ComputerUseToolConfig, ImageGenerationToolConfig } from '@/types/workflow'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

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
  { value: 'o4-mini-deep-research', label: 'O4-Mini-Deep-Research' },
]

const AVAILABLE_TOOLS = [
  { value: 'web_search', label: 'Web Search', description: 'Web search capabilities' },
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
  const [imageGenerationConfig, setImageGenerationConfig] = useState({
    size: 'auto' as '1024x1024' | '1024x1536' | '1536x1024' | 'auto',
    quality: 'auto' as 'low' | 'medium' | 'high' | 'auto',
    format: undefined as 'png' | 'jpeg' | 'webp' | undefined,
    compression: undefined as number | undefined,
    background: 'auto' as 'transparent' | 'opaque' | 'auto',
    input_fidelity: undefined as 'low' | 'high' | undefined,
  })
  const [aiPrompt, setAiPrompt] = useState('')
  const [showAIAssist, setShowAIAssist] = useState(false)
  const [webhookHeaders, setWebhookHeaders] = useState<Record<string, string>>(
    step.webhook_headers || {}
  )

  // Track if we've already converted string tools to objects to prevent infinite loops
  const hasConvertedToolsRef = useRef<boolean>(false)

  // Always call hook unconditionally to comply with Rules of Hooks
  const { isGenerating, error: aiError, proposal, generateStep, acceptProposal, rejectProposal } = useWorkflowStepAI(workflowId)

  // Create stable step reference for dependency comparison
  const stepKey = useMemo(() => {
    return JSON.stringify({
      step_id: step.step_id,
      step_name: step.step_name,
      step_type: step.step_type,
      webhook_url: step.webhook_url,
      tools: step.tools,
      model: step.model,
    })
  }, [stepKey, index, onChange])

  // Sync localStep when step prop changes
  useEffect(() => {
    // Reset conversion tracking when step prop changes (new step or step updated externally)
    hasConvertedToolsRef.current = false
    
    // Preserve webhook step type if webhook_url exists but step_type is missing
    const stepWithType = { ...step }
    if (!stepWithType.step_type && stepWithType.webhook_url) {
      stepWithType.step_type = 'webhook'
    }
    
    setLocalStep(stepWithType)
    // Extract computer_use_preview config if present
    const computerUseTool = (step.tools || []).find(
      (t) => (typeof t === 'object' && t.type === 'computer_use_preview') || t === 'computer_use_preview'
    )
    if (computerUseTool && typeof computerUseTool === 'object' && (computerUseTool as ComputerUseToolConfig).type === 'computer_use_preview') {
      const config = computerUseTool as ComputerUseToolConfig
      setComputerUseConfig({
        display_width: config.display_width || 1024,
        display_height: config.display_height || 768,
        environment: config.environment || 'browser',
      })
    }
    
    // Extract image_generation config if present
    const imageGenTool = (step.tools || []).find(
      (t) => (typeof t === 'object' && t.type === 'image_generation') || t === 'image_generation'
    )
    if (imageGenTool && typeof imageGenTool === 'object' && (imageGenTool as ImageGenerationToolConfig).type === 'image_generation') {
      const config = imageGenTool as ImageGenerationToolConfig
      setImageGenerationConfig({
        size: config.size || 'auto',
        quality: config.quality || 'auto',
        format: config.format,
        compression: config.compression,
        background: config.background || 'auto',
        input_fidelity: config.input_fidelity,
      })
    } else {
      // Check if image_generation tool is selected (as string)
      const hasImageGenTool = (step.tools || []).some(t => {
        if (typeof t === 'string') return t === 'image_generation'
        return t.type === 'image_generation'
      })
      if (hasImageGenTool) {
        // Tool is selected but no config - use defaults
        const defaultConfig = {
          size: 'auto' as const,
          quality: 'auto' as const,
          format: undefined as 'png' | 'jpeg' | 'webp' | undefined,
          compression: undefined as number | undefined,
          background: 'auto' as const,
          input_fidelity: undefined as 'low' | 'high' | undefined,
        }
        setImageGenerationConfig(defaultConfig)
        
        // Convert string tool to object immediately if needed (only if not already converted)
        const tools = step.tools || []
        const hasStringTool = tools.some(t => t === 'image_generation')
        const hasObjectTool = tools.some(t => typeof t === 'object' && t.type === 'image_generation')
        
        // Use ref to track conversion instead of comparing localStep (which hasn't updated yet due to React batching)
        if (hasStringTool && !hasObjectTool && !hasConvertedToolsRef.current) {
          // Mark as converted to prevent infinite loops
          hasConvertedToolsRef.current = true
          // Convert string to object with defaults
          const updatedTools = tools.map(t => {
            if (t === 'image_generation') {
              const config: ImageGenerationToolConfig = {
                type: 'image_generation',
                size: defaultConfig.size,
                quality: defaultConfig.quality,
                background: defaultConfig.background,
              }
              return config
            }
            return t
          }) as typeof step.tools
          // Update local step immediately
          const updatedStep = { ...step, tools: updatedTools }
          setLocalStep(updatedStep)
          // Notify parent of the conversion (this will update the step prop, but only once)
          onChange(index, updatedStep)
        } else if (!hasStringTool && hasObjectTool) {
          // Reset ref if tool is removed or already converted
          hasConvertedToolsRef.current = false
        }
      } else {
        // Tool not selected - reset to defaults
        setImageGenerationConfig({
          size: 'auto',
          quality: 'auto',
          format: undefined,
          compression: undefined,
          background: 'auto',
          input_fidelity: undefined,
        })
      }
    }
    // Sync webhook headers
    if (step.webhook_headers) {
      setWebhookHeaders(step.webhook_headers)
    } else {
      setWebhookHeaders({})
    }
  }, [step, onChange, index])

  // Ensure image generation config is initialized when tool is selected
  // Using functional setState form to avoid needing imageGenerationConfig in dependencies
  useEffect(() => {
    const hasImageGenTool = (localStep.tools || []).some(t => {
      if (typeof t === 'string') return t === 'image_generation'
      return typeof t === 'object' && t.type === 'image_generation'
    })
    
    // Only initialize if tool is selected and config hasn't been set yet
    if (hasImageGenTool) {
      setImageGenerationConfig(prev => {
        // Only update if size is not set (avoid unnecessary updates)
        if (!prev.size || prev.size === undefined) {
          return {
            size: 'auto',
            quality: 'auto',
            format: undefined,
            compression: undefined,
            background: 'auto',
            input_fidelity: undefined,
          }
        }
        return prev
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStep.tools]) // Only depend on tools to avoid loops - using functional setState prevents need for imageGenerationConfig dependency

  const handleChange = (field: keyof WorkflowStep, value: any) => {
    const updated = { ...localStep, [field]: value }
    setLocalStep(updated)
    onChange(index, updated)
  }

  const isToolSelected = (toolValue: string): boolean => {
    const currentTools = localStep.tools || []
    const isSelected = currentTools.some(t => {
      if (typeof t === 'string') return t === toolValue
      return t.type === toolValue
    })
    return isSelected
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
      } else if (toolValue === 'image_generation') {
        // Ensure config is initialized with defaults if not already set
        const currentConfig = imageGenerationConfig.size ? imageGenerationConfig : {
          size: 'auto' as const,
          quality: 'auto' as const,
          format: undefined as 'png' | 'jpeg' | 'webp' | undefined,
          compression: undefined as number | undefined,
          background: 'auto' as const,
          input_fidelity: undefined as 'low' | 'high' | undefined,
        }
        
        // Add as object with config
        const config: any = {
          type: 'image_generation',
          size: currentConfig.size,
          quality: currentConfig.quality,
          background: currentConfig.background,
        }
        if (currentConfig.format) {
          config.format = currentConfig.format
        }
        if (currentConfig.compression !== undefined) {
          config.compression = currentConfig.compression
        }
        if (currentConfig.input_fidelity) {
          config.input_fidelity = currentConfig.input_fidelity
        }
        updatedTools = [...currentTools, config]
        
        // Initialize state immediately if not already initialized
        if (!imageGenerationConfig.size) {
          setImageGenerationConfig(currentConfig)
        }
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

  const handleImageGenerationConfigChange = (field: keyof typeof imageGenerationConfig, value: any) => {
    const newConfig = { ...imageGenerationConfig, [field]: value }
    setImageGenerationConfig(newConfig)
    
    // Update the tool object in tools array
    const currentTools = localStep.tools || []
    const updatedTools = currentTools.map(t => {
      // Convert string tool to object if needed
      if (t === 'image_generation') {
        const config: any = {
          type: 'image_generation',
          size: newConfig.size,
          quality: newConfig.quality,
          background: newConfig.background,
        }
        // Add optional fields only if set, otherwise explicitly omit them (consistent with object tool update logic)
        if (newConfig.format) {
          config.format = newConfig.format
        }
        // Note: format is omitted if not set (don't add undefined)
        if (newConfig.compression !== undefined) {
          config.compression = newConfig.compression
        }
        // Note: compression is omitted if undefined (don't add undefined)
        if (newConfig.input_fidelity) {
          config.input_fidelity = newConfig.input_fidelity
        }
        // Note: input_fidelity is omitted if not set (don't add undefined)
        return config
      }
      // Update existing object tool
      if (typeof t === 'object' && t.type === 'image_generation') {
        const updated: any = {
          ...t,
          size: newConfig.size,
          quality: newConfig.quality,
          background: newConfig.background,
        }
        if (newConfig.format) {
          updated.format = newConfig.format
        } else {
          delete updated.format
        }
        if (newConfig.compression !== undefined) {
          updated.compression = newConfig.compression
        } else {
          delete updated.compression
        }
        if (newConfig.input_fidelity) {
          updated.input_fidelity = newConfig.input_fidelity
        } else {
          delete updated.input_fidelity
        }
        return updated
      }
      return t
    })
    
    // If image_generation is selected but not in tools array, add it
    if (isToolSelected('image_generation') && !updatedTools.some(t => typeof t === 'object' && t.type === 'image_generation')) {
      const config: any = {
        type: 'image_generation',
        size: newConfig.size,
        quality: newConfig.quality,
        background: newConfig.background,
      }
      if (newConfig.format) {
        config.format = newConfig.format
      }
      if (newConfig.compression !== undefined) {
        config.compression = newConfig.compression
      }
      if (newConfig.input_fidelity) {
        config.input_fidelity = newConfig.input_fidelity
      }
      updatedTools.push(config)
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
    <ErrorBoundary fallback={
      <div className="border border-red-300 rounded-lg p-6 bg-red-50">
        <p className="text-red-800 font-medium">Error loading step editor</p>
        <p className="text-red-600 text-sm mt-1">Please refresh the page or try again.</p>
      </div>
    }>
      <div className="border border-gray-300 rounded-lg p-6 bg-white shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div 
          className="flex items-center gap-3"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1 text-gray-400">
            <span className="text-xs">⋮⋮</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 select-none">
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
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`step-name-${index}`}>
            Step Name *
          </label>
          <input
            id={`step-name-${index}`}
            type="text"
            value={localStep.step_name}
            onChange={(e) => handleChange('step_name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="e.g., Deep Research"
            required
            aria-label="Step name"
            aria-required="true"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`step-description-${index}`}>
            Step Description (optional)
          </label>
          <textarea
            id={`step-description-${index}`}
            value={localStep.step_description || ''}
            onChange={(e) => handleChange('step_description', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Brief description of what this step does"
            rows={2}
            aria-label="Step description"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`step-type-${index}`}>
            Step Type *
          </label>
          <select
            id={`step-type-${index}`}
            value={localStep.step_type || (localStep.webhook_url ? 'webhook' : 'ai_generation')}
            onChange={(e) => {
              const newStepType = e.target.value as 'ai_generation' | 'webhook'
              if (newStepType === 'webhook') {
                // Initialize webhook step with defaults, preserving existing webhook fields
                const updated = {
                  ...localStep,
                  step_type: newStepType,
                  webhook_url: localStep.webhook_url || '',
                  webhook_data_selection: localStep.webhook_data_selection || {
                    include_submission: true,
                    exclude_step_indices: [],
                    include_job_info: true
                  }
                }
                setLocalStep(updated)
                onChange(index, updated)
              } else {
                // When switching to AI generation, preserve webhook fields but set step_type
                // This allows switching back without losing data
                const updated = {
                  ...localStep,
                  step_type: newStepType,
                }
                setLocalStep(updated)
                onChange(index, updated)
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Step type"
            aria-required="true"
          >
            <option value="ai_generation">AI Generation</option>
            <option value="webhook">Webhook</option>
          </select>
        </div>

        {/* AI Generation Step Fields */}
        {(localStep.step_type === 'ai_generation' || (!localStep.step_type && !localStep.webhook_url)) && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`ai-model-${index}`}>
                AI Model *
              </label>
              <select
                id={`ai-model-${index}`}
                value={localStep.model}
                onChange={(e) => handleChange('model', e.target.value as AIModel)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
                aria-label="AI model"
                aria-required="true"
              >
                {MODEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`instructions-${index}`}>
                Instructions *
              </label>
              <textarea
                id={`instructions-${index}`}
                value={localStep.instructions}
                onChange={(e) => handleChange('instructions', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Detailed instructions for what this step should do..."
                rows={6}
                required
                aria-label="Step instructions"
                aria-required="true"
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
                      <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor={`display-width-${index}`}>
                        Display Width
                      </label>
                      <input
                        id={`display-width-${index}`}
                        type="number"
                        value={computerUseConfig.display_width}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 1024
                          const clampedValue = Math.max(100, Math.min(4096, value))
                          handleComputerUseConfigChange('display_width', clampedValue)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            e.stopPropagation()
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                        min="100"
                        max="4096"
                        aria-label="Display width in pixels"
                        aria-invalid={computerUseConfig.display_width < 100 || computerUseConfig.display_width > 4096}
                      />
                      {(computerUseConfig.display_width < 100 || computerUseConfig.display_width > 4096) && (
                        <p className="mt-1 text-xs text-red-600">Width must be between 100 and 4096 pixels</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor={`display-height-${index}`}>
                        Display Height
                      </label>
                      <input
                        id={`display-height-${index}`}
                        type="number"
                        value={computerUseConfig.display_height}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 768
                          const clampedValue = Math.max(100, Math.min(4096, value))
                          handleComputerUseConfigChange('display_height', clampedValue)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            e.stopPropagation()
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                        min="100"
                        max="4096"
                        aria-label="Display height in pixels"
                        aria-invalid={computerUseConfig.display_height < 100 || computerUseConfig.display_height > 4096}
                      />
                      {(computerUseConfig.display_height < 100 || computerUseConfig.display_height > 4096) && (
                        <p className="mt-1 text-xs text-red-600">Height must be between 100 and 4096 pixels</p>
                      )}
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
              
              {/* Image Generation Configuration */}
              {isToolSelected('image_generation') && (
                <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Image Generation Configuration
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Size
                      </label>
                      <select
                        value={imageGenerationConfig.size}
                        onChange={(e) => handleImageGenerationConfigChange('size', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      >
                        <option value="auto">Auto (default)</option>
                        <option value="1024x1024">1024x1024 (Square)</option>
                        <option value="1024x1536">1024x1536 (Portrait)</option>
                        <option value="1536x1024">1536x1024 (Landscape)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Quality
                      </label>
                      <select
                        value={imageGenerationConfig.quality}
                        onChange={(e) => handleImageGenerationConfigChange('quality', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      >
                        <option value="auto">Auto (default)</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Format
                      </label>
                      <select
                        value={imageGenerationConfig.format || ''}
                        onChange={(e) => handleImageGenerationConfigChange('format', e.target.value || undefined)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      >
                        <option value="">Default (PNG)</option>
                        <option value="png">PNG</option>
                        <option value="jpeg">JPEG</option>
                        <option value="webp">WebP</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Background
                      </label>
                      <select
                        value={imageGenerationConfig.background}
                        onChange={(e) => handleImageGenerationConfigChange('background', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      >
                        <option value="auto">Auto (default)</option>
                        <option value="transparent">Transparent</option>
                        <option value="opaque">Opaque</option>
                      </select>
                    </div>
                    {(imageGenerationConfig.format === 'jpeg' || imageGenerationConfig.format === 'webp') && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Compression ({imageGenerationConfig.compression ?? 85}%)
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={imageGenerationConfig.compression ?? 85}
                          onChange={(e) => handleImageGenerationConfigChange('compression', parseInt(e.target.value))}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>0%</span>
                          <span>100%</span>
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Input Fidelity
                      </label>
                      <select
                        value={imageGenerationConfig.input_fidelity || ''}
                        onChange={(e) => handleImageGenerationConfigChange('input_fidelity', e.target.value || undefined)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      >
                        <option value="">Default</option>
                        <option value="low">Low</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
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
          </>
        )}

        {/* Webhook Step Fields */}
        {localStep.step_type === 'webhook' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Webhook URL *
              </label>
              <input
                type="url"
                value={localStep.webhook_url || ''}
                onChange={(e) => handleChange('webhook_url', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="https://example.com/webhook"
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                The URL where the POST request will be sent with selected data.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Webhook Headers (optional)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Add custom headers to include in the webhook request (e.g., Authorization).
              </p>
              <div className="space-y-2">
                {Object.entries(webhookHeaders).map(([key, value], idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={key}
                      onChange={(e) => {
                        const newHeaders = { ...webhookHeaders }
                        delete newHeaders[key]
                        newHeaders[e.target.value] = value
                        setWebhookHeaders(newHeaders)
                        handleChange('webhook_headers', newHeaders)
                      }}
                      placeholder="Header name"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => {
                        const newHeaders = { ...webhookHeaders, [key]: e.target.value }
                        setWebhookHeaders(newHeaders)
                        handleChange('webhook_headers', newHeaders)
                      }}
                      placeholder="Header value"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newHeaders = { ...webhookHeaders }
                        delete newHeaders[key]
                        setWebhookHeaders(newHeaders)
                        handleChange('webhook_headers', newHeaders)
                      }}
                      className="px-3 py-2 text-red-600 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const newHeaders = { ...webhookHeaders, '': '' }
                    setWebhookHeaders(newHeaders)
                  }}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  + Add Header
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Selection
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Choose which data to include in the webhook payload. All step outputs are included by default.
              </p>
              
              <div className="space-y-3">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localStep.webhook_data_selection?.include_submission !== false}
                    onChange={(e) => {
                      const dataSelection = localStep.webhook_data_selection || {
                        include_submission: true,
                        exclude_step_indices: [],
                        include_job_info: true
                      }
                      handleChange('webhook_data_selection', {
                        ...dataSelection,
                        include_submission: e.target.checked
                      })
                    }}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-900">Include submission data</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localStep.webhook_data_selection?.include_job_info !== false}
                    onChange={(e) => {
                      const dataSelection = localStep.webhook_data_selection || {
                        include_submission: true,
                        exclude_step_indices: [],
                        include_job_info: true
                      }
                      handleChange('webhook_data_selection', {
                        ...dataSelection,
                        include_job_info: e.target.checked
                      })
                    }}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-900">Include job information</span>
                </label>

                {allSteps.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Exclude Step Outputs (optional)
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      All step outputs are included by default. Check steps to exclude from the payload.
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                      {allSteps.map((otherStep, otherIndex) => {
                        if (otherIndex >= index) return null // Can't exclude future steps
                        const isExcluded = (localStep.webhook_data_selection?.exclude_step_indices || []).includes(otherIndex)
                        return (
                          <label key={otherIndex} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isExcluded}
                              onChange={(e) => {
                                const dataSelection = localStep.webhook_data_selection || {
                                  include_submission: true,
                                  exclude_step_indices: [],
                                  include_job_info: true
                                }
                                const currentExcluded = dataSelection.exclude_step_indices || []
                                const newExcluded = e.target.checked
                                  ? [...currentExcluded, otherIndex]
                                  : currentExcluded.filter((idx: number) => idx !== otherIndex)
                                handleChange('webhook_data_selection', {
                                  ...dataSelection,
                                  exclude_step_indices: newExcluded
                                })
                              }}
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-900">
                              Exclude: {otherStep.step_name || `Step ${otherIndex + 1}`}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
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
    </ErrorBoundary>
  )
}


