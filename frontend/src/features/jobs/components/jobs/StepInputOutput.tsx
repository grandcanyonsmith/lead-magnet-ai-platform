'use client'

import { FiCopy, FiEdit } from 'react-icons/fi'
import { formatStepInput, formatStepOutput } from '@/features/jobs/utils/jobFormatting'
import { StepContent } from './StepContent'
import { ArtifactPreview } from './ArtifactPreview'
import { ContextSection } from './step-details/ContextSection'
import { ImageGallery, type ImageGalleryData } from './step-details/ImageGallery'
import { useScrollGlow } from './step-details/useScrollGlow'
import { ExecutionStep, MergedStep, StepStatus } from '@/features/jobs/types'

interface StepInputOutputProps {
  step: MergedStep
  status: StepStatus
  onCopy: (text: string) => void
  previousSteps: ExecutionStep[]
  formSubmission: Record<string, unknown> | null | undefined
  imageGallery?: ImageGalleryData
  usedImageGeneration?: boolean
  onEditStep?: (stepIndex: number) => void
  canEdit?: boolean
}

function getCopyText(formatted: ReturnType<typeof formatStepInput>): string {
  if (formatted.type === 'json') {
    return JSON.stringify(formatted.content, null, 2)
  }
  if (typeof formatted.content === 'string') {
    return formatted.content
  }
  if (
    typeof formatted.content === 'object' &&
    formatted.content !== null &&
    'input' in formatted.content
  ) {
    const contentObj = formatted.content as { input?: unknown }
    return contentObj.input ? String(contentObj.input) : JSON.stringify(formatted.content, null, 2)
  }
  return JSON.stringify(formatted.content, null, 2)
}

interface CopyButtonProps {
  onClick: () => void
}

function CopyButton({ onClick }: CopyButtonProps) {
  return (
    <button
      onClick={onClick}
      className="text-xs text-gray-500 hover:text-gray-700 active:text-gray-900 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 active:bg-gray-200 touch-target min-h-[44px] sm:min-h-0"
    >
      <FiCopy className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
      <span className="hidden sm:inline">Copy</span>
    </button>
  )
}

function buildFallbackGallery(step: MergedStep): ImageGalleryData {
  const stepImageUrls = Array.isArray(step.image_urls) ? step.image_urls : []
  const modelValue = step.model || step.input?.model
  const modelString: string | undefined = typeof modelValue === 'string' ? modelValue : undefined

  return {
    imageUrls: stepImageUrls,
    artifacts: [],
    model: modelString,
    tools: step.input?.tools || step.tools || [],
    toolChoice: step.input?.tool_choice || step.tool_choice,
    loading: false,
  }
}

export function StepInputOutput({
  step,
  status,
  onCopy,
  previousSteps,
  formSubmission,
  imageGallery,
  usedImageGeneration,
  onEditStep,
  canEdit = false,
}: StepInputOutputProps) {
  const inputScrollRef = useScrollGlow<HTMLDivElement>()
  const outputScrollRef = useScrollGlow<HTMLDivElement>()

  const workflowStepIndex =
    step.step_order && step.step_order > 0 ? step.step_order - 1 : 0

  const canEditStep =
    canEdit &&
    Boolean(onEditStep) &&
    ['workflow_step', 'ai_generation', 'webhook'].includes(step.step_type) &&
    step.step_order !== undefined &&
    step.step_order > 0

  const gallery = imageGallery ?? buildFallbackGallery(step)
  const showGallery =
    gallery.imageUrls.length > 0 ||
    gallery.artifacts.length > 0 ||
    Boolean(gallery.loading)

  const showContext = previousSteps.length > 0 || Boolean(formSubmission)
  const effectiveUsedImageGeneration =
    usedImageGeneration ?? (gallery.imageUrls.length > 0 || gallery.artifacts.length > 0)
  const hideOutputContent = effectiveUsedImageGeneration && showGallery
  const isInProgress = status === 'in_progress'
  const hasOutputContent = Boolean(step.output)

  const handleCopyInput = () => {
    const formatted = formatStepInput(step)
    onCopy(getCopyText(formatted))
  }

  const handleCopyOutput = () => {
    const formatted = formatStepOutput(step)
    const text =
      formatted.type === 'json'
        ? JSON.stringify(formatted.content, null, 2)
        : typeof formatted.content === 'string'
          ? formatted.content
          : JSON.stringify(formatted.content, null, 2)
    onCopy(text)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-3">
      <div className="border border-blue-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <div className="bg-blue-50/60 px-3 py-2 md:px-3 md:py-1.5 border-b border-blue-200">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm md:text-xs font-semibold text-gray-700">Input</span>
            <div className="flex items-center gap-1.5">
              {canEditStep && onEditStep && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onEditStep(workflowStepIndex)
                  }}
                  className="flex items-center gap-1 px-1.5 py-1 text-xs font-medium text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded transition-colors"
                  title="Edit workflow step"
                >
                  <FiEdit className="w-3 h-3" />
                  <span className="hidden sm:inline">Edit</span>
                </button>
              )}
              <CopyButton onClick={handleCopyInput} />
            </div>
          </div>
        </div>
        <div
          ref={inputScrollRef}
          className="p-3 md:p-2.5 bg-blue-50/20 max-h-[350px] md:max-h-72 overflow-y-auto scrollbar-hide-until-hover"
        >
          {showContext && (
            <ContextSection
              previousSteps={previousSteps}
              formSubmission={formSubmission}
              currentStepOrder={step.step_order ?? 0}
            />
          )}

          <StepContent formatted={formatStepInput(step)} />

          {showGallery && (
            <ImageGallery
              {...gallery}
              className="border-none pt-4"
            />
          )}
        </div>
      </div>

      <div className="border border-green-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <div className="bg-green-50/60 px-3 py-2 md:px-3 md:py-1.5 border-b border-green-200">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm md:text-xs font-semibold text-gray-700">Output</span>
            <CopyButton onClick={handleCopyOutput} />
          </div>
        </div>
        <div
          ref={outputScrollRef}
          className="p-3 md:p-2.5 bg-green-50/20 max-h-[350px] md:max-h-72 overflow-y-auto scrollbar-hide-until-hover"
        >
          {hideOutputContent ? (
            <ImageGallery {...gallery} />
          ) : (
            <>
              <StepContent
                formatted={formatStepOutput(step)}
                imageUrls={gallery.imageUrls}
              />
              {showGallery && (
                <ImageGallery
                  {...gallery}
                  className="border-none"
                />
              )}
            </>
          )}

          {isInProgress && (
            <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
              <span>Step is currently running and will update once output is available.</span>
            </div>
          )}

          {!isInProgress && !hasOutputContent && (
            <div className="mt-3 text-xs text-gray-500">
              This step hasn’t produced output yet.
            </div>
          )}

          {step.artifact_id && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <ArtifactPreview artifactId={step.artifact_id} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

