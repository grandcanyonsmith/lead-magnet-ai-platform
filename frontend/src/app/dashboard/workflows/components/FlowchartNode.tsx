'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { WorkflowStep } from './WorkflowStepEditor'
import { FiZap, FiSearch, FiImage, FiCode, FiFile, FiMonitor } from 'react-icons/fi'

interface FlowchartNodeData {
  step: WorkflowStep
  index: number
  onClick: () => void
}

const MODEL_COLORS: Record<string, string> = {
  'o3-deep-research': 'bg-purple-100 text-purple-800 border-purple-300',
  'gpt-5': 'bg-blue-100 text-blue-800 border-blue-300',
  'gpt-4.1': 'bg-indigo-100 text-indigo-800 border-indigo-300',
  'gpt-4o': 'bg-green-100 text-green-800 border-green-300',
  'gpt-4-turbo': 'bg-teal-100 text-teal-800 border-teal-300',
  'gpt-3.5-turbo': 'bg-gray-100 text-gray-800 border-gray-300',
}

const TOOL_ICONS: Record<string, any> = {
  web_search: FiSearch,
  web_search_preview: FiSearch,
  image_generation: FiImage,
  computer_use_preview: FiMonitor,
  file_search: FiFile,
  code_interpreter: FiCode,
}

function FlowchartNode({ data, selected }: NodeProps<FlowchartNodeData>) {
  const { step, index, onClick } = data
  const modelColor = MODEL_COLORS[step.model] || MODEL_COLORS['gpt-5']
  
  const getToolIcon = (tool: string | { type: string }) => {
    const toolType = typeof tool === 'string' ? tool : tool.type
    return TOOL_ICONS[toolType] || FiZap
  }

  const tools = step.tools || []
  const hasTools = tools.length > 0

  return (
    <div
      className={`bg-white rounded-lg shadow-lg border-2 min-w-[200px] max-w-[250px] transition-all cursor-pointer ${
        selected
          ? 'border-primary-500 shadow-xl scale-105'
          : 'border-gray-200 hover:border-primary-300 hover:shadow-xl'
      }`}
      onClick={onClick}
    >
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-primary-500" />
      
      <div className="p-4">
        {/* Step Number Badge */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded">
            Step {index + 1}
          </span>
          {hasTools && (
            <div className="flex gap-1">
              {tools.slice(0, 3).map((tool, idx) => {
                const Icon = getToolIcon(tool)
                return (
                  <div
                    key={idx}
                    className="w-5 h-5 rounded bg-primary-100 text-primary-600 flex items-center justify-center"
                    title={typeof tool === 'string' ? tool : tool.type}
                  >
                    <Icon className="w-3 h-3" />
                  </div>
                )
              })}
              {tools.length > 3 && (
                <div className="w-5 h-5 rounded bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-semibold">
                  +{tools.length - 3}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step Name */}
        <h3 className="font-semibold text-gray-900 mb-2 text-sm line-clamp-2">
          {step.step_name || `Step ${index + 1}`}
        </h3>

        {/* Step Description */}
        {step.step_description && (
          <p className="text-xs text-gray-600 mb-3 line-clamp-2">
            {step.step_description}
          </p>
        )}

        {/* Model Badge */}
        <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${modelColor}`}>
          {step.model === 'o3-deep-research' ? 'O3' : step.model.replace('gpt-', 'GPT-').replace('turbo', 'Turbo')}
        </div>

        {/* Tool Choice Indicator */}
        {step.tool_choice && step.tool_choice !== 'none' && (
          <div className="mt-2 text-xs text-gray-500">
            Tools: {step.tool_choice === 'required' ? 'Required' : 'Auto'}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-primary-500" />
    </div>
  )
}

export default memo(FlowchartNode)

