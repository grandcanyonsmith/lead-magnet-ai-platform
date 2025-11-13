/**
 * Step Input/Output Component
 * Displays step input and output sections with copy functionality
 */

import { FiCopy, FiChevronDown, FiChevronUp, FiLoader } from 'react-icons/fi'
import { formatStepInput, formatStepOutput } from '@/utils/jobFormatting'
import { StepContent } from './StepContent'
import { MergedStep, StepStatus } from '@/types/job'
import { PreviewRenderer } from '@/components/artifacts/PreviewRenderer'
import { Artifact } from '@/types/artifact'

interface StepInputOutputProps {
  step: MergedStep
  status: StepStatus
  isExpanded: boolean
  onToggle: () => void
  onCopy: (text: string) => void
  previousSteps: any[]
  formSubmission: any
  imageArtifacts?: Artifact[]
  loadingImageArtifacts?: boolean
}

// Helper to get tool name from tool object or string
function getToolName(tool: any): string {
  return typeof tool === 'string' ? tool : tool.type || 'unknown'
}

// Render tool badges inline
function renderToolBadges(tools?: string[] | unknown[], toolChoice?: string, showLabel: boolean = true) {
  if (!tools || !Array.isArray(tools) || tools.length === 0) {
    return showLabel ? (
      <span className="px-2 py-0.5 text-xs bg-gray-50 text-gray-600 rounded border border-gray-200">
        None
      </span>
    ) : null
  }

  return (
    <>
      <div className="flex flex-wrap gap-1">
        {tools.map((tool: any, toolIdx: number) => {
          const toolName = getToolName(tool)
          return (
            <span
              key={toolIdx}
              className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded border border-blue-200 whitespace-nowrap"
            >
              {toolName}
            </span>
          )
        })}
      </div>
      {toolChoice && (
        <span className="text-gray-500">({toolChoice})</span>
      )}
    </>
  )
}

// Render previous steps context inline
function renderPreviousStepsContext(previousSteps: any[], formSubmission: any, currentStepOrder: number) {
  if (!previousSteps.length && !formSubmission) {
    return null
  }

  return (
    <div className="mb-4 pb-4 border-b border-gray-200">
      <div className="text-xs font-medium text-gray-700 mb-2">
        Context from Previous Steps:
      </div>

      {/* Form Submission - Show inline */}
      {formSubmission && (
        <div className="mb-2">
          <div className="text-xs font-medium text-gray-600 mb-1">
            Form Submission <span className="text-gray-500">(Step 0)</span>
          </div>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono overflow-x-auto bg-gray-50 p-2 rounded border border-gray-200 max-h-32 overflow-y-auto">
            {typeof formSubmission === 'object'
              ? Object.entries(formSubmission)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join('\n')
              : formSubmission}
          </pre>
        </div>
      )}

      {/* Previous Workflow Steps - Show inline */}
      {previousSteps.map((step, index) => {
        const stepOutput =
          typeof step.output === 'string'
            ? step.output
            : JSON.stringify(step.output, null, 2)

        return (
          <div key={`${currentStepOrder}-prev-${step.step_order}-${index}`} className="mb-2 last:mb-0">
            <div className="text-xs font-medium text-gray-600 mb-1">
              {step.step_name || `Step ${step.step_order}`} <span className="text-gray-500">(Step {step.step_order})</span>
            </div>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono overflow-x-auto bg-gray-50 p-2 rounded border border-gray-200 max-h-32 overflow-y-auto">
              {stepOutput}
            </pre>
            {step.image_urls && step.image_urls.length > 0 && (
              <div className="mt-2">
                <div className="text-xs font-medium text-gray-600 mb-1">
                  Generated Images:
                </div>
                <div className="space-y-1">
                  {step.image_urls.map((url: string, idx: number) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-blue-600 hover:text-blue-800 hover:underline truncate"
                    >
                      {url}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function StepInputOutput({
  step,
  status,
  isExpanded,
  onToggle,
  onCopy,
  previousSteps,
  formSubmission,
  imageArtifacts = [],
  loadingImageArtifacts = false,
}: StepInputOutputProps) {
  const isPending = status === 'pending'
  const isCompleted = status === 'completed'
  const isInProgress = status === 'in_progress'

  // Show section if step is completed, in progress, or pending with instructions
  const shouldShow = isCompleted || isInProgress || (isPending && step.instructions)
  if (!shouldShow) {
    return null
  }

  const renderImageSection = () => {
    const stepOrder = step.step_order ?? 0
    const hasImageUrls = step.image_urls && Array.isArray(step.image_urls) && step.image_urls.length > 0
    const hasImageArtifacts = imageArtifacts.length > 0
    
    if (!hasImageUrls && !hasImageArtifacts) {
      return null
    }
    
    return (
      <div className="mt-4 pt-4 border-t border-gray-200">
        <span className="text-sm font-semibold text-gray-700 mb-3 block">Generated Images:</span>
        
        {/* Loading state */}
        {loadingImageArtifacts && !hasImageUrls && (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
            <FiLoader className="w-4 h-4 animate-spin" />
            <span>Loading images...</span>
          </div>
        )}
        
        {/* Render from image_urls if available */}
        {hasImageUrls && step.image_urls ? (
          <div className="grid grid-cols-1 gap-3">
            {step.image_urls.map((imageUrl: string, imgIdx: number) => (
              <div key={`url-${imgIdx}`} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="aspect-video bg-gray-100">
                  <PreviewRenderer
                    contentType="image/png"
                    objectUrl={imageUrl}
                    fileName={`Generated image ${imgIdx + 1}`}
                    className="w-full h-full"
                  />
                </div>
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
        ) : (
          /* Fallback: Render from artifacts */
          hasImageArtifacts && (
            <div className="grid grid-cols-1 gap-3">
              {imageArtifacts.map((artifact: Artifact, imgIdx: number) => {
                const artifactUrl = artifact.object_url || artifact.public_url
                if (!artifactUrl) return null
                
                return (
                  <div key={`artifact-${artifact.artifact_id || imgIdx}`} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="aspect-video bg-gray-100">
                      <PreviewRenderer
                        contentType={artifact.content_type || 'image/png'}
                        objectUrl={artifactUrl}
                        fileName={artifact.file_name || artifact.artifact_name || `Image ${imgIdx + 1}`}
                        className="w-full h-full"
                        artifactId={artifact.artifact_id}
                      />
                    </div>
                    <div className="p-2 bg-gray-100">
                      <div className="flex items-center justify-between">
                        <a 
                          href={artifactUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 break-all flex-1"
                        >
                          {artifact.file_name || artifact.artifact_name || artifactUrl}
                        </a>
                        {artifact.artifact_id && (
                          <span className="text-xs text-gray-500 font-mono ml-2">
                            {artifact.artifact_id.substring(0, 12)}...
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    )
  }

  return (
    <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0 border-t border-gray-100">
      <button
        onClick={onToggle}
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
                      {renderToolBadges(step.tools, step.tool_choice, false)}
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
                  {/* Previous Steps Context */}
                  {renderPreviousStepsContext(previousSteps, formSubmission, step.step_order ?? 0)}
                  
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
                  
                  {/* Display images */}
                  {renderImageSection()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

