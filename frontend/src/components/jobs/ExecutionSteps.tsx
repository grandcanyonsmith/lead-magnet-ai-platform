'use client'

import { FiChevronDown, FiChevronUp, FiCopy } from 'react-icons/fi'
import { formatStepInput, formatStepOutput, formatDurationMs } from '@/utils/jobFormatting'
import { StepContent } from './StepContent'

interface ExecutionStepsProps {
  steps: any[]
  expandedSteps: Set<number>
  showExecutionSteps: boolean
  onToggleShow: () => void
  onToggleStep: (stepOrder: number) => void
  onCopy: (text: string) => void
}

export function ExecutionSteps({
  steps,
  expandedSteps,
  showExecutionSteps,
  onToggleShow,
  onToggleStep,
  onCopy,
}: ExecutionStepsProps) {
  if (!steps || steps.length === 0) {
    return null
  }

  return (
    <div className="mt-4 sm:mt-6 bg-white rounded-lg shadow p-4 sm:p-6">
      <button
        onClick={onToggleShow}
        className="flex items-center justify-between w-full text-left mb-4 touch-target"
      >
        <h2 className="text-lg font-semibold text-gray-900">Execution Steps</h2>
        {showExecutionSteps ? (
          <FiChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
        ) : (
          <FiChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
        )}
      </button>

      {showExecutionSteps && (
        <div className="space-y-3 sm:space-y-4 pt-4 border-t border-gray-200">
          {steps.map((step: any, index: number) => {
            const isExpanded = expandedSteps.has(step.step_order)
            const stepTypeColors: Record<string, string> = {
              form_submission: 'bg-blue-100 text-blue-800',
              ai_generation: 'bg-purple-100 text-purple-800',
              html_generation: 'bg-green-100 text-green-800',
              final_output: 'bg-gray-100 text-gray-800',
            }
            const stepTypeColor = stepTypeColors[step.step_type] || 'bg-gray-100 text-gray-800'

            return (
              <div key={index} className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:border-gray-300 transition-colors">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                  {/* Left: Step info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded flex-shrink-0 ${stepTypeColor}`}>
                        Step {step.step_order}
                      </span>
                      <h3 className="text-sm sm:text-base font-semibold text-gray-900 break-words">{step.step_name}</h3>
                      {step.model && (
                        <span className="text-xs text-gray-500 whitespace-nowrap">({step.model})</span>
                      )}
                    </div>
                    
                    {/* Tools Section - Always show for consistency */}
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
                      ) : (
                        <span className="px-2 py-0.5 text-xs bg-gray-50 text-gray-600 rounded border border-gray-200">
                          None
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Metrics - Stack vertically on mobile */}
                  <div className="flex flex-col items-start sm:items-end gap-1 text-xs text-gray-500 flex-shrink-0">
                    {step.duration_ms !== undefined && (
                      <span className="font-medium text-gray-700">{formatDurationMs(step.duration_ms)}</span>
                    )}
                    {step.usage_info && (
                      <div className="flex flex-col sm:items-end gap-0.5">
                        <span className="text-gray-600">
                          {step.usage_info.input_tokens + step.usage_info.output_tokens} tokens
                        </span>
                        {step.usage_info.cost_usd && (
                          <span className="text-gray-600 font-medium">
                            ${step.usage_info.cost_usd.toFixed(2)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Input/Output Section */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => onToggleStep(step.step_order)}
                    className="flex items-center justify-between w-full text-left text-sm text-gray-700 hover:text-gray-900 touch-target py-1"
                  >
                    <span className="font-medium">Input</span>
                    {isExpanded ? (
                      <FiChevronUp className="w-5 h-5 flex-shrink-0 ml-2" />
                    ) : (
                      <FiChevronDown className="w-5 h-5 flex-shrink-0 ml-2" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="mt-3 space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-700">Input</span>
                          <button
                            onClick={() => {
                              const formatted = formatStepInput(step)
                              const text = formatted.type === 'json' 
                                ? JSON.stringify(formatted.content, null, 2)
                                : typeof formatted.content === 'string' 
                                  ? formatted.content 
                                  : formatted.content.input || JSON.stringify(formatted.content, null, 2)
                              onCopy(text)
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 flex items-center space-x-1 px-2 py-1.5 rounded hover:bg-gray-50 touch-target"
                          >
                            <FiCopy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </button>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-800 overflow-x-auto max-h-96 overflow-y-auto">
                          <StepContent formatted={formatStepInput(step)} />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-700">Output</span>
                          <button
                            onClick={() => {
                              const formatted = formatStepOutput(step)
                              const text = formatted.type === 'json' 
                                ? JSON.stringify(formatted.content, null, 2)
                                : typeof formatted.content === 'string' 
                                  ? formatted.content 
                                  : JSON.stringify(formatted.content, null, 2)
                              onCopy(text)
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 flex items-center space-x-1 px-2 py-1.5 rounded hover:bg-gray-50 touch-target"
                          >
                            <FiCopy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </button>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-800 overflow-x-auto max-h-96 overflow-y-auto">
                          <StepContent formatted={formatStepOutput(step)} />
                        </div>
                        {/* Display image URLs if present */}
                        {step.image_urls && Array.isArray(step.image_urls) && step.image_urls.length > 0 && (
                          <div className="mt-3">
                            <span className="text-xs font-medium text-gray-700 mb-2 block">Generated Images:</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {step.image_urls.map((imageUrl: string, imgIdx: number) => (
                                <div key={imgIdx} className="border border-gray-200 rounded-lg overflow-hidden">
                                  <img 
                                    src={imageUrl} 
                                    alt={`Generated image ${imgIdx + 1}`}
                                    className="w-full h-auto"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none'
                                    }}
                                  />
                                  <div className="p-2 bg-gray-100">
                                    <a 
                                      href={imageUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:text-blue-800 break-all"
                                    >
                                      {imageUrl}
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {step.artifact_id && (
                        <div className="text-xs text-gray-500">
                          Artifact ID: <span className="font-mono break-all">{step.artifact_id}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

