'use client'

import { WorkflowStep } from '@/features/workflows/types'

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

interface StepToolSelectorProps {
  step: WorkflowStep
  isToolSelected: (toolValue: string) => boolean
  onToolToggle: (toolValue: string) => void
  onToolChoiceChange: (value: 'auto' | 'required' | 'none') => void
  onComputerUseConfigChange?: (field: 'display_width' | 'display_height' | 'environment', value: number | string) => void
  computerUseConfig?: {
    display_width: number
    display_height: number
    environment: 'browser' | 'mac' | 'windows' | 'ubuntu'
  }
}

export function StepToolSelector({
  step,
  isToolSelected,
  onToolToggle,
  onToolChoiceChange,
  onComputerUseConfigChange,
  computerUseConfig
}: StepToolSelectorProps) {
  return (
    <>
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
                onChange={() => onToolToggle(tool.value)}
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
        {isToolSelected('computer_use_preview') && onComputerUseConfigChange && computerUseConfig && (
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
                  onChange={(e) => onComputerUseConfigChange('display_width', parseInt(e.target.value) || 1024)}
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
                  onChange={(e) => onComputerUseConfigChange('display_height', parseInt(e.target.value) || 768)}
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
                onChange={(e) => onComputerUseConfigChange('environment', e.target.value)}
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
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tool Choice
        </label>
        <select
          value={step.tool_choice || 'auto'}
          onChange={(e) => onToolChoiceChange(e.target.value as 'auto' | 'required' | 'none')}
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
  )
}

