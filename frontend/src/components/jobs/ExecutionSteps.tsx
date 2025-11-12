'use client'

import { useState } from 'react'
import { FiChevronDown, FiChevronUp, FiCopy, FiCheckCircle, FiCircle, FiLoader, FiRefreshCw, FiXCircle, FiEdit2 } from 'react-icons/fi'
import { formatStepInput, formatStepOutput, formatDurationMs } from '@/utils/jobFormatting'
import { StepContent } from './StepContent'
import { PreviousStepsContext } from './PreviousStepsContext'

type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

interface ExecutionStepsProps {
  steps: any[]
  expandedSteps: Set<number>
  showExecutionSteps: boolean
  onToggleShow: () => void
  onToggleStep: (stepOrder: number) => void
  onCopy: (text: string) => void
  jobStatus?: string
  onRerunStep?: (stepIndex: number) => Promise<void>
  rerunningStep?: number | null
  onEditStep?: (stepIndex: number) => void
  canEdit?: boolean
}

export function ExecutionSteps({
  steps,
  expandedSteps,
  showExecutionSteps,
  onToggleShow,
  onToggleStep,
  onCopy,
  jobStatus,
  onRerunStep,
  rerunningStep,
  onEditStep,
  canEdit = false,
}: ExecutionStepsProps) {
  // State for managing expanded previous steps (separate from main step expansion)
  const [expandedPrevSteps, setExpandedPrevSteps] = useState<Set<number>>(new Set())

  if (!steps || steps.length === 0) {
    return null
  }

  const togglePrevStep = (stepOrder: number) => {
    const newExpanded = new Set(expandedPrevSteps)
    if (newExpanded.has(stepOrder)) {
      newExpanded.delete(stepOrder)
    } else {
      newExpanded.add(stepOrder)
    }
    setExpandedPrevSteps(newExpanded)
  }

  // Get step status
  const getStepStatus = (step: any): StepStatus => {
    // Use explicit status if provided
    if (step._status) {
      return step._status
    }
    
    // Determine status from step data
    if (step.output !== null && step.output !== undefined && step.output !== '') {
      return 'completed'
    }
    
    // Check if job is processing and this might be the current step
    if (jobStatus === 'processing') {
      // Find all completed steps (have output)
      const completedSteps = steps.filter((s: any) => 
        s.output !== null && s.output !== undefined && s.output !== ''
      )
      const stepIndex = steps.indexOf(step)
      // If this step comes right after the last completed step, it's in progress
      if (stepIndex === completedSteps.length && stepIndex < steps.length) {
        return 'in_progress'
      }
    }
    
    // Check if job failed and step has no output
    if (jobStatus === 'failed') {
      const completedSteps = steps.filter((s: any) => 
        s.output !== null && s.output !== undefined && s.output !== ''
      )
      const stepIndex = steps.indexOf(step)
      // If step was supposed to run but didn't complete, mark as failed
      if (stepIndex <= completedSteps.length && step.output === null) {
        return 'failed'
      }
    }
    
    return 'pending'
  }

  // Get previous steps for context
  const getPreviousSteps = (currentStep: any) => {
    const currentOrder = currentStep.step_order || 0
    
    const previousSteps = steps
      .filter((step: any) => {
        const stepOrder = step.step_order || 0
        return (
          stepOrder < currentOrder &&
          stepOrder > 0 && // Exclude form submission (step 0)
          step.output !== null &&
          step.output !== undefined &&
          step.output !== ''
        )
      })
      .sort((a: any, b: any) => (a.step_order || 0) - (b.step_order || 0))
    
    return previousSteps
  }

  // Get form submission data
  const getFormSubmission = (currentStep: any) => {
    const formSubmissionStep = steps.find((s: any) => s.step_order === 0)
    if (formSubmissionStep && formSubmissionStep.output) {
      return formSubmissionStep.output
    }
    return null
  }

  // Get status icon
  const getStatusIcon = (status: StepStatus) => {
    switch (status) {
      case 'completed':
        return <FiCheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
      case 'in_progress':
        return <FiLoader className="w-5 h-5 text-yellow-500 flex-shrink-0 animate-spin" />
      case 'failed':
        return <FiXCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
      case 'pending':
      default:
        return <FiCircle className="w-5 h-5 text-gray-400 flex-shrink-0" />
    }
  }

  return (
    <div className="mt-4 sm:mt-6 bg-white rounded-lg shadow p-4 sm:p-6">
      <button
        onClick={onToggleShow}
        className="flex items-center justify-between w-full text-left mb-4 touch-target"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Execution Steps</h2>
          {(() => {
            // Calculate progress: current step / total steps
            const totalSteps = steps.length
            if (totalSteps === 0) return null
            
            // Find completed and in-progress steps
            let completedCount = 0
            let currentStepNumber = 0
            
            for (const step of steps) {
              const status = getStepStatus(step)
              if (status === 'completed') {
                completedCount++
              } else if (status === 'in_progress') {
                currentStepNumber = step.step_order || steps.indexOf(step) + 1
                break
              }
            }
            
            // If no step is in progress, determine current step based on completed count
            if (currentStepNumber === 0) {
              if (jobStatus === 'processing') {
                // Job is processing but no step marked as in_progress yet - use next step
                currentStepNumber = completedCount + 1
              } else if (jobStatus === 'completed') {
                // All steps completed
                currentStepNumber = totalSteps
              } else {
                // Job hasn't started or is pending
                currentStepNumber = completedCount > 0 ? completedCount + 1 : 1
              }
            }
            
            // Only show progress if there's meaningful progress to show
            if (jobStatus === 'processing' || completedCount > 0 || jobStatus === 'completed') {
              return (
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                  jobStatus === 'processing' 
                    ? 'bg-blue-100 text-blue-800 animate-pulse' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {currentStepNumber}/{totalSteps}
                </span>
              )
            }
            return null
          })()}
        </div>
        {showExecutionSteps ? (
          <FiChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
        ) : (
          <FiChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
        )}
      </button>

      {showExecutionSteps && (
        <div className="space-y-2 pt-4 border-t border-gray-200">
          {steps.map((step: any, index: number) => {
            const isExpanded = expandedSteps.has(step.step_order)
            const stepStatus = getStepStatus(step)
            const isCompleted = stepStatus === 'completed'
            const isPending = stepStatus === 'pending'
            const isInProgress = stepStatus === 'in_progress'
            
            const stepTypeColors: Record<string, string> = {
              form_submission: 'bg-blue-100 text-blue-800',
              ai_generation: 'bg-purple-100 text-purple-800',
              html_generation: 'bg-green-100 text-green-800',
              final_output: 'bg-gray-100 text-gray-800',
              workflow_step: 'bg-gray-100 text-gray-800',
            }
            const stepTypeColor = stepTypeColors[step.step_type] || 'bg-gray-100 text-gray-800'

            return (
              <div 
                key={step.step_order || index} 
                className={`border rounded-lg transition-colors ${
                  isPending 
                    ? 'border-gray-200 bg-gray-50' 
                    : 'border-gray-200 bg-white hover:border-gray-300'
                } ${isInProgress ? 'border-blue-300 bg-blue-50' : ''}`}
              >
                {/* Header Section - GitHub Actions style */}
                <div className="flex items-start gap-3 p-3 sm:p-4">
                  {/* Status Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {getStatusIcon(stepStatus)}
                  </div>
                  
                  {/* Step Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded flex-shrink-0 ${stepTypeColor}`}>
                        Step {step.step_order}
                      </span>
                      {isInProgress && (
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full animate-pulse">
                          Processing...
                        </span>
                      )}
                      <h3 className={`text-sm sm:text-base font-semibold break-words ${
                        isPending ? 'text-gray-500' : 'text-gray-900'
                      }`}>
                        {step.step_name}
                      </h3>
                      {step.model && !isPending && (
                        <span className="text-xs text-gray-500 whitespace-nowrap">({step.model})</span>
                      )}
                    </div>
                    
                    {/* Tools Section - Only show if step is completed or has tools info */}
                    {!isPending && (
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
                        ) : step.tools && Array.isArray(step.tools) && step.tools.length > 0 ? (
                          <>
                            <div className="flex flex-wrap gap-1">
                              {step.tools.map((tool: any, toolIdx: number) => {
                                const toolName = typeof tool === 'string' ? tool : tool.type || 'unknown'
                                return (
                                  <span key={toolIdx} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded border border-blue-200 whitespace-nowrap">
                                    {toolName}
                                  </span>
                                )
                              })}
                            </div>
                            {step.tool_choice && (
                              <span className="text-gray-500">
                                ({step.tool_choice})
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="px-2 py-0.5 text-xs bg-gray-50 text-gray-600 rounded border border-gray-200">
                            None
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: Metrics and Actions */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {/* Metrics - Only show for completed steps */}
                    {isCompleted && (
                      <div className="flex flex-col items-end gap-1 text-xs text-gray-500">
                        {step.duration_ms !== undefined && (
                          <span className="font-medium text-gray-700">{formatDurationMs(step.duration_ms)}</span>
                        )}
                        {step.usage_info && (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-gray-600">
                              {(step.usage_info.input_tokens || 0) + (step.usage_info.output_tokens || 0)} tokens
                            </span>
                            {step.usage_info?.cost_usd && (
                              <span className="text-gray-600 font-medium">
                                {/* Handle both number and string types (S3 data may have different format) */}
                                ${typeof step.usage_info.cost_usd === 'number' 
                                  ? step.usage_info.cost_usd.toFixed(2) 
                                  : parseFloat(step.usage_info.cost_usd || '0').toFixed(2)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons Row */}
                    <div className="flex items-center gap-2">
                      {/* Edit Step Button - Only for workflow template steps */}
                      {canEdit && onEditStep && step.step_type === 'workflow_step' && step.step_order > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            // Don't allow editing while job is processing
                            if (jobStatus === 'processing') {
                              return
                            }
                            // Pass the workflow steps array index (step_order - 1)
                            // because workflow.steps is 0-indexed and doesn't include form submission
                            const workflowStepIndex = step.step_order - 1
                            onEditStep(workflowStepIndex)
                          }}
                          disabled={jobStatus === 'processing'}
                          title={
                            jobStatus === 'processing'
                              ? 'Editing disabled while run is in progress'
                              : 'Edit workflow template step'
                          }
                          aria-label="Edit workflow template step"
                          className={`p-2 rounded transition-colors ${
                            jobStatus === 'processing'
                              ? 'text-yellow-600 cursor-not-allowed opacity-60'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                          }`}
                        >
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                      )}

                      {/* Rerun Step Button */}
                      {onRerunStep && step.step_order > 0 && step.step_type === 'ai_generation' && (
                        <button
                          onClick={() => {
                            const stepIndex = step.step_order - 1 // Convert to 0-indexed
                            onRerunStep(stepIndex)
                          }}
                          disabled={rerunningStep === step.step_order - 1}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-target"
                          title="Rerun this step"
                        >
                          {rerunningStep === step.step_order - 1 ? (
                            <>
                              <FiLoader className="w-3.5 h-3.5 animate-spin" />
                              Rerunning...
                            </>
                          ) : (
                            <>
                              <FiRefreshCw className="w-3.5 h-3.5" />
                              Rerun Step
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Input/Output Section - Show for all non-pending steps, and for pending steps with instructions */}
                {(isCompleted || isInProgress || (isPending && step.instructions)) && (
                  <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0 border-t border-gray-100">
                    <button
                      onClick={() => onToggleStep(step.step_order)}
                      className="flex items-center justify-between w-full text-left text-sm text-gray-700 hover:text-gray-900 touch-target py-2"
                    >
                      <span className="font-medium">
                        {isCompleted ? 'Input & Output' : isPending ? 'Step Configuration' : 'Input & Output'}
                      </span>
                      {isExpanded ? (
                        <FiChevronUp className="w-5 h-5 flex-shrink-0 ml-2" />
                      ) : (
                        <FiChevronDown className="w-5 h-5 flex-shrink-0 ml-2" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-3">
                        {isPending ? (
                          /* For pending steps, show configuration only */
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                              <span className="text-sm font-semibold text-gray-700">Configuration</span>
                            </div>
                            <div className="p-4 bg-white space-y-3">
                              {step.step_description && (
                                <div>
                                  <span className="text-xs font-semibold text-gray-600 uppercase">Description</span>
                                  <p className="text-sm text-gray-700 mt-1">{step.step_description}</p>
                                </div>
                              )}
                              {step.model && (
                                <div>
                                  <span className="text-xs font-semibold text-gray-600 uppercase">Model</span>
                                  <p className="text-sm text-gray-700 mt-1 font-mono">{step.model}</p>
                                </div>
                              )}
                              {step.instructions && (
                                <div>
                                  <span className="text-xs font-semibold text-gray-600 uppercase">Instructions</span>
                                  <pre className="text-sm text-gray-700 mt-1 whitespace-pre-wrap font-sans bg-gray-50 p-3 rounded border border-gray-200">{step.instructions}</pre>
                                </div>
                              )}
                              {step.tools && Array.isArray(step.tools) && step.tools.length > 0 && (
                                <div>
                                  <span className="text-xs font-semibold text-gray-600 uppercase">Tools</span>
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {step.tools.map((tool: any, toolIdx: number) => {
                                      const toolName = typeof tool === 'string' ? tool : tool.type || 'unknown'
                                      return (
                                        <span key={toolIdx} className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded border border-blue-200">
                                          {toolName}
                                        </span>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                              {step.tool_choice && (
                                <div>
                                  <span className="text-xs font-semibold text-gray-600 uppercase">Tool Choice</span>
                                  <p className="text-sm text-gray-700 mt-1 font-mono">{step.tool_choice}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* For completed/in-progress steps, show Input and Output side by side */
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Input Section */}
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-semibold text-gray-700">Input</span>
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
                                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center space-x-1 px-2 py-1.5 rounded hover:bg-gray-100 touch-target"
                                  >
                                    <FiCopy className="w-3.5 h-3.5" />
                                    <span>Copy</span>
                                  </button>
                                </div>
                              </div>
                              <div className="p-4 bg-white max-h-96 overflow-y-auto">
                                {/* Previous Steps Context - Collapsible */}
                                <PreviousStepsContext
                                  previousSteps={getPreviousSteps(step)}
                                  formSubmission={getFormSubmission(step)}
                                  expandedPrevSteps={expandedPrevSteps}
                                  onTogglePrevStep={togglePrevStep}
                                  currentStepOrder={step.step_order}
                                />
                                
                                {/* Current Step Input */}
                                <StepContent formatted={formatStepInput(step)} />
                              </div>
                            </div>

                            {/* Output Section */}
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-semibold text-gray-700">Output</span>
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
                                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center space-x-1 px-2 py-1.5 rounded hover:bg-gray-100 touch-target"
                                  >
                                    <FiCopy className="w-3.5 h-3.5" />
                                    <span>Copy</span>
                                  </button>
                                </div>
                              </div>
                              <div className="p-4 bg-white max-h-96 overflow-y-auto">
                                <StepContent formatted={formatStepOutput(step)} />
                                
                                {/* Display image URLs if present */}
                                {step.image_urls && Array.isArray(step.image_urls) && step.image_urls.length > 0 && (
                                  <div className="mt-4 pt-4 border-t border-gray-200">
                                    <span className="text-sm font-semibold text-gray-700 mb-3 block">Generated Images:</span>
                                    <div className="grid grid-cols-1 gap-3">
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
                            </div>
                          </div>
                        )}

                        {step.artifact_id && (
                          <div className="mt-4 text-xs text-gray-500">
                            Artifact ID: <span className="font-mono break-all">{step.artifact_id}</span>
                          </div>
                        )}
                      </div>
                    )}
                </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

