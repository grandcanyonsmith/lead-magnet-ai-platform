/**
 * Step Input/Output Component
 * Displays step input and output sections with copy functionality
 */

import React, { useEffect, useRef } from 'react'
import { FiCopy, FiChevronDown, FiChevronUp, FiLoader, FiEdit, FiCpu } from 'react-icons/fi'
import { formatStepInput, formatStepOutput } from '@/utils/jobFormatting'
import { StepContent } from './StepContent'
import { MergedStep, StepStatus, ExecutionStep } from '@/types/job'
import { PreviewRenderer } from '@/components/artifacts/PreviewRenderer'
import { Artifact } from '@/types/artifact'
import { extractImageUrls } from '@/utils/imageUtils'
import { InlineImage } from './InlineImage'
import { ArtifactPreview } from './ArtifactPreview'

interface StepInputOutputProps {
  step: MergedStep
  status: StepStatus
  isExpanded: boolean
  onToggle: () => void
  onCopy: (text: string) => void
  previousSteps: ExecutionStep[]
  formSubmission: Record<string, unknown> | null | undefined
  imageArtifacts?: Artifact[]
  loadingImageArtifacts?: boolean
  onEditStep?: (stepIndex: number) => void
  canEdit?: boolean
}

// Type for tool - can be a string or an object with a type property
type Tool = string | { type: string; [key: string]: unknown }

// Helper to get tool name from tool object or string
function getToolName(tool: Tool): string {
  return typeof tool === 'string' ? tool : (tool.type || 'unknown')
}

// Helper to truncate long URLs for display
function truncateUrl(url: string, maxLength: number = 50): string {
  if (url.length <= maxLength) {
    return url
  }
  return url.substring(0, maxLength) + '...'
}

// Helper to detect if image generation was used in this step
function hasImageGeneration(
  step: MergedStep,
  imageArtifacts: Artifact[]
): boolean {
  // Check if step has image URLs
  const hasImageUrls = step.image_urls && Array.isArray(step.image_urls) && step.image_urls.length > 0
  
  // Check if step has image artifacts
  const hasImageArtifacts = imageArtifacts.length > 0
  
  // Check if step tools include image generation
  const tools = step.input?.tools || step.tools || []
  const hasImageGenerationTool = Array.isArray(tools) && tools.some((tool) => {
    const toolName = getToolName(tool as Tool)
    return toolName === 'image_generation'
  })
  
  return hasImageUrls || hasImageArtifacts || hasImageGenerationTool
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
        {tools.map((tool, toolIdx) => {
          const toolName = getToolName(tool as Tool)
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

// Render text with inline images
function renderTextWithImages(text: string): React.ReactNode {
  const imageUrls = extractImageUrls(text)
  
  if (imageUrls.length === 0) {
    return <>{text}</>
  }

  // Split text by image URLs and render images inline
  let remainingText = text
  const parts: React.ReactNode[] = []
  let partIndex = 0

  imageUrls.forEach((url, idx) => {
    const urlIndex = remainingText.indexOf(url)
    if (urlIndex === -1) return

    // Add text before the URL
    if (urlIndex > 0) {
      parts.push(
        <span key={`text-${partIndex++}`}>
          {remainingText.substring(0, urlIndex)}
        </span>
      )
    }

    // Add the image
    parts.push(
      <div key={`image-${idx}`} className="block my-2">
        <InlineImage url={url} alt={`Image ${idx + 1}`} />
      </div>
    )

    // Update remaining text
    remainingText = remainingText.substring(urlIndex + url.length)
  })

  // Add any remaining text
  if (remainingText.length > 0) {
    parts.push(
      <span key={`text-${partIndex}`}>
        {remainingText}
      </span>
    )
  }

  return <>{parts}</>
}

// Render previous steps context inline
function renderPreviousStepsContext(previousSteps: ExecutionStep[], formSubmission: Record<string, unknown> | null | undefined, currentStepOrder: number) {
  if ((!previousSteps || previousSteps.length === 0) && !formSubmission) {
    return null
  }

  return (
            <div className="mb-5 md:mb-4 pb-5 md:pb-4 border-b border-gray-200">
      <div className="text-sm md:text-xs font-medium text-gray-700 mb-3 md:mb-2">
        Context from Previous Steps:
      </div>

      {/* Form Submission - Show inline */}
      {formSubmission && (() => {
        const formText = typeof formSubmission === 'object'
          ? Object.entries(formSubmission)
              .map(([key, value]) => `${key}: ${value}`)
              .join('\n')
          : String(formSubmission)
        const formImageUrls = extractImageUrls(formText)
        
        return (
          <div className="mb-2">
            <div className="text-sm md:text-xs font-medium text-gray-600 mb-2 md:mb-1">
              Form Submission <span className="text-gray-500">(Step 0)</span>
            </div>
            <div className="text-sm md:text-xs text-gray-700 whitespace-pre-wrap font-mono overflow-x-auto bg-gray-50 p-3 md:p-2.5 rounded-lg border border-gray-200 max-h-32 overflow-y-auto scrollbar-hide-until-hover leading-relaxed">
              {renderTextWithImages(formText)}
            </div>
            {/* Render images found in form submission */}
            {formImageUrls.length > 0 && (
              <div className="mt-4 space-y-4 md:space-y-2">
                {formImageUrls.map((url, idx) => (
                  <InlineImage key={`form-image-${idx}`} url={url} alt={`Form submission image ${idx + 1}`} />
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Previous Workflow Steps - Show inline */}
      {previousSteps.map((step, index) => {
        const stepOutput =
          typeof step.output === 'string'
            ? step.output
            : step.output !== null && step.output !== undefined
              ? JSON.stringify(step.output, null, 2)
              : ''
        const stepImageUrls = extractImageUrls(stepOutput)

        return (
          <div key={`${currentStepOrder}-prev-${step.step_order}-${index}`} className="mb-2 last:mb-0">
            <div className="text-sm md:text-xs font-medium text-gray-600 mb-2 md:mb-1">
              {step.step_name || `Step ${step.step_order}`} <span className="text-gray-500">(Step {step.step_order})</span>
            </div>
            <div className="text-sm md:text-xs text-gray-700 whitespace-pre-wrap font-mono overflow-x-auto bg-gray-50 p-3 md:p-2.5 rounded-lg border border-gray-200 max-h-32 overflow-y-auto scrollbar-hide-until-hover leading-relaxed">
              {renderTextWithImages(stepOutput)}
            </div>
            {/* Render images found in step output */}
            {stepImageUrls.length > 0 && (
              <div className="mt-4 md:mt-2 space-y-4 md:space-y-2">
                {stepImageUrls.map((url, idx) => (
                  <InlineImage key={`step-output-image-${idx}`} url={url} alt={`Step ${step.step_order} output image ${idx + 1}`} />
                ))}
              </div>
            )}
            {/* Also show image_urls if they exist (for backwards compatibility) */}
            {step.image_urls && step.image_urls.length > 0 && (
              <div className="mt-4 md:mt-2">
                <div className="text-sm md:text-xs font-medium text-gray-600 mb-3 md:mb-1">
                  Generated Images:
                </div>
                <div className="space-y-4 md:space-y-2">
                  {step.image_urls.map((url: string, idx: number) => (
                    <InlineImage key={`step-image-url-${idx}`} url={url} alt={`Generated image ${idx + 1}`} />
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
  onEditStep,
  canEdit = false,
}: StepInputOutputProps) {
  const inputScrollRef = useRef<HTMLDivElement>(null)
  const outputScrollRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Add scroll detection to show scrollbars when scrolling
  useEffect(() => {
    const inputEl = inputScrollRef.current
    const outputEl = outputScrollRef.current

    const handleInputScroll = () => {
      if (inputEl) {
        inputEl.classList.add('scrolling')
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }
        scrollTimeoutRef.current = setTimeout(() => {
          if (inputEl) {
            inputEl.classList.remove('scrolling')
          }
        }, 300)
      }
    }

    const handleOutputScroll = () => {
      if (outputEl) {
        outputEl.classList.add('scrolling')
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }
        scrollTimeoutRef.current = setTimeout(() => {
          if (outputEl) {
            outputEl.classList.remove('scrolling')
          }
        }, 300)
      }
    }

    if (inputEl) {
      inputEl.addEventListener('scroll', handleInputScroll, { passive: true })
    }
    if (outputEl) {
      outputEl.addEventListener('scroll', handleOutputScroll, { passive: true })
    }

    return () => {
      if (inputEl) {
        inputEl.removeEventListener('scroll', handleInputScroll)
      }
      if (outputEl) {
        outputEl.removeEventListener('scroll', handleOutputScroll)
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

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

    // Get model and tools for display
    const model = step.model || step.input?.model
    const tools = step.input?.tools || step.tools || []
    const toolChoice = step.input?.tool_choice || step.tool_choice
    const hasTools = tools && Array.isArray(tools) && tools.length > 0
    
    return (
      <div className="mt-3 md:mt-2.5 pt-3 md:pt-2.5 border-t border-gray-200">
        {/* Show model and tools when image generation is used */}
        {(model || hasTools) && (
          <div className="flex items-center gap-2 mb-3 md:mb-2 flex-wrap">
            {model && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                <FiCpu className="w-3 h-3" />
                {model}
              </span>
            )}
            {hasTools && (
              <>
                {tools.map((tool, toolIdx) => {
                  const toolName = getToolName(tool as Tool)
                  return (
                    <span
                      key={toolIdx}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 border border-blue-200 whitespace-nowrap"
                    >
                      {toolName}
                    </span>
                  )
                })}
                {toolChoice && toolChoice !== 'auto' && (
                  <span className="text-xs text-gray-500">({toolChoice})</span>
                )}
              </>
            )}
          </div>
        )}
        
        <span className="text-sm md:text-xs font-semibold text-gray-700 mb-2.5 md:mb-2 block">Generated Images:</span>
        
        {/* Loading state */}
        {loadingImageArtifacts && !hasImageUrls && (
          <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
            <FiLoader className="w-3.5 h-3.5 animate-spin" />
            <span>Loading images...</span>
          </div>
        )}
        
        {/* Render from image_urls if available */}
        {hasImageUrls && step.image_urls ? (
          <div className="grid grid-cols-1 gap-2.5 md:gap-2">
            {step.image_urls.map((imageUrl: string, imgIdx: number) => (
              <div key={`url-${imgIdx}`} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="aspect-video bg-gray-100">
                  <PreviewRenderer
                    contentType="image/png"
                    objectUrl={imageUrl}
                    fileName={`Generated image ${imgIdx + 1}`}
                    className="w-full h-full"
                  />
                </div>
                <div className="p-3 md:p-2 bg-gray-100">
                  <a 
                    href={imageUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm md:text-xs text-blue-600 hover:text-blue-800 active:text-blue-900 break-all block touch-target py-2 md:py-1 min-h-[44px] md:min-h-0"
                    title={imageUrl}
                  >
                    {truncateUrl(imageUrl)}
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Fallback: Render from artifacts */
          hasImageArtifacts && (
            <div className="grid grid-cols-1 gap-2.5 md:gap-2">
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
                    <div className="p-3 md:p-2 bg-gray-100">
                      <div className="flex items-center justify-between gap-2">
                        <a 
                          href={artifactUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs md:text-xs text-blue-600 hover:text-blue-800 active:text-blue-900 truncate flex-1 min-w-0"
                          title={artifact.file_name || artifact.artifact_name || artifactUrl}
                        >
                          {artifact.file_name || artifact.artifact_name || truncateUrl(artifactUrl)}
                        </a>
                        {artifact.artifact_id && (
                          <span className="text-xs text-gray-500 font-mono flex-shrink-0">
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

  // Check if image generation was used
  const usedImageGeneration = hasImageGeneration(step, imageArtifacts)

  return (
    <div className="px-3 sm:px-3 pb-3 sm:pb-3 pt-0 border-t border-gray-200">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50/50 active:text-gray-900 active:bg-gray-50 rounded-md transition-colors touch-target py-2 md:py-1.5 min-h-[44px] md:min-h-0 px-2"
      >
        <span className="font-medium">
          {isCompleted ? 'Details' : isPending ? 'Configuration' : 'Details'}
        </span>
        {isExpanded ? (
          <FiChevronUp className="w-5 h-5 flex-shrink-0 ml-2" />
        ) : (
          <FiChevronDown className="w-5 h-5 flex-shrink-0 ml-2" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 md:mt-2">
          {isPending ? (
            /* For pending steps, show configuration only */
            <div className="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm">
              <div className="bg-slate-50 px-3 py-2 md:py-1.5 border-b border-gray-300 flex items-center justify-between">
                <span className="text-sm md:text-xs font-semibold text-gray-700">Configuration</span>
                {canEdit && onEditStep && (step.step_type === 'workflow_step' || step.step_type === 'ai_generation' || step.step_type === 'webhook') && step.step_order !== undefined && step.step_order > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      const workflowStepIndex = step.step_order - 1
                      onEditStep(workflowStepIndex)
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-colors"
                    title="Edit workflow step"
                  >
                    <FiEdit className="w-4 h-4" />
                    <span>Edit Step</span>
                  </button>
                )}
              </div>
              <div className="p-4 md:p-3 bg-white space-y-3 md:space-y-2">
                {step.instructions && (
                  <div>
                    <span className="text-xs font-semibold text-gray-600 uppercase">Instructions</span>
                    <pre className="text-sm text-gray-700 mt-1 whitespace-pre-wrap font-sans bg-gray-50 p-2.5 rounded border border-gray-200">{step.instructions}</pre>
                  </div>
                )}
                {step.tool_choice && step.tool_choice !== 'auto' && (
                  <div>
                    <span className="text-xs font-semibold text-gray-600 uppercase">Tool Choice</span>
                    <p className="text-sm text-gray-700 mt-1 font-mono">{step.tool_choice}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* For completed/in-progress steps, show Input and Output side by side on desktop, stacked on mobile */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-3">
              {/* Input Section */}
              <div className="border border-blue-200 rounded-lg overflow-hidden bg-white shadow-sm">
                <div className="bg-blue-50/60 px-3 py-2 md:px-3 md:py-1.5 border-b border-blue-200">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm md:text-xs font-semibold text-gray-700">Input</span>
                    <div className="flex items-center gap-1.5">
                      {canEdit && onEditStep && (step.step_type === 'workflow_step' || step.step_type === 'ai_generation' || step.step_type === 'webhook') && step.step_order !== undefined && step.step_order > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const workflowStepIndex = step.step_order - 1
                            onEditStep(workflowStepIndex)
                          }}
                          className="flex items-center gap-1 px-1.5 py-1 text-xs font-medium text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded transition-colors"
                          title="Edit workflow step"
                        >
                          <FiEdit className="w-3 h-3" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const formatted = formatStepInput(step)
                          let text: string
                          if (formatted.type === 'json') {
                            text = JSON.stringify(formatted.content, null, 2)
                          } else if (typeof formatted.content === 'string') {
                            text = formatted.content
                          } else if (typeof formatted.content === 'object' && formatted.content !== null && 'input' in formatted.content) {
                            const contentObj = formatted.content as { input?: unknown }
                            text = contentObj.input ? String(contentObj.input) : JSON.stringify(formatted.content, null, 2)
                          } else {
                            text = JSON.stringify(formatted.content, null, 2)
                          }
                          onCopy(text)
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700 active:text-gray-900 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 active:bg-gray-200 touch-target min-h-[44px] sm:min-h-0"
                      >
                        <FiCopy className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                        <span className="hidden sm:inline">Copy</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div ref={inputScrollRef} className="p-3 md:p-2.5 bg-blue-50/20 max-h-[350px] md:max-h-72 overflow-y-auto scrollbar-hide-until-hover">
                  {/* Previous Steps Context */}
                  {renderPreviousStepsContext(previousSteps, formSubmission, step.step_order ?? 0)}
                  
                  {/* Current Step Input */}
                  <StepContent formatted={formatStepInput(step)} />
                  
                  {/* Display images in Input section if image generation was used */}
                  {usedImageGeneration && renderImageSection()}
                </div>
              </div>

              {/* Output Section */}
              <div className="border border-green-200 rounded-lg overflow-hidden bg-white shadow-sm">
                <div className="bg-green-50/60 px-3 py-2 md:px-3 md:py-1.5 border-b border-green-200">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm md:text-xs font-semibold text-gray-700">Output</span>
                    <div className="flex items-center gap-1.5">
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
                        className="text-xs text-gray-500 hover:text-gray-700 active:text-gray-900 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 active:bg-gray-200 touch-target min-h-[44px] sm:min-h-0"
                      >
                        <FiCopy className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                        <span className="hidden sm:inline">Copy</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div ref={outputScrollRef} className="p-3 md:p-2.5 bg-green-50/20 max-h-[350px] md:max-h-72 overflow-y-auto scrollbar-hide-until-hover">
                  {usedImageGeneration ? (
                    /* For image generation steps, only show the image URL, not markdown preview */
                    renderImageSection()
                  ) : (
                    /* For non-image generation steps, show the normal output content */
                    <>
                      {(() => {
                        const stepImageUrls = step.image_urls && Array.isArray(step.image_urls) && step.image_urls.length > 0 ? step.image_urls : []
                        return (
                          <StepContent 
                            formatted={formatStepOutput(step)} 
                            imageUrls={stepImageUrls}
                          />
                        )
                      })()}
                      {renderImageSection()}
                    </>
                  )}
                  
                  {/* Show main artifact (step output) */}
                  {step.artifact_id && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <ArtifactPreview artifactId={step.artifact_id} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

