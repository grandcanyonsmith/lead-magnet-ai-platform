'use client'

import { useMemo } from 'react'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'
import { Artifact } from '@/types/artifact'
import { ExecutionStep, MergedStep, StepStatus } from '@/types/job'
import { StepInputOutput } from '../StepInputOutput'
import { StepConfigurationPanel } from './StepConfigurationPanel'
import {
  getMergedImageUrls,
  getStepModel,
  getStepToolChoice,
  getStepTools,
  stepUsesImageGeneration,
} from '../step-utils'
import { ImageGalleryData } from './ImageGallery'

interface StepDetailsPanelProps {
  step: MergedStep
  status: StepStatus
  isExpanded: boolean
  onToggle: () => void
  onCopy: (text: string) => void
  previousSteps: ExecutionStep[]
  formSubmission: Record<string, unknown> | null | undefined
  imageArtifacts: Artifact[]
  loadingImageArtifacts?: boolean
  onEditStep?: (stepIndex: number) => void
  canEdit?: boolean
}

export function StepDetailsPanel({
  step,
  status,
  isExpanded,
  onToggle,
  onCopy,
  previousSteps,
  formSubmission,
  imageArtifacts,
  loadingImageArtifacts,
  onEditStep,
  canEdit,
}: StepDetailsPanelProps) {
  const isPending = status === 'pending'

  const imageGallery = useMemo<ImageGalleryData>(() => {
    return {
      imageUrls: getMergedImageUrls(step),
      artifacts: imageArtifacts,
      model: getStepModel(step),
      tools: getStepTools(step),
      toolChoice: getStepToolChoice(step),
      loading: loadingImageArtifacts,
    }
  }, [step, imageArtifacts, loadingImageArtifacts])

  const usedImageGeneration = stepUsesImageGeneration(step, imageArtifacts)

  return (
    <div className="px-3 sm:px-3 pb-3 sm:pb-3 pt-0 border-t border-gray-200">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50/50 active:text-gray-900 active:bg-gray-50 rounded-md transition-colors touch-target py-2 md:py-1.5 min-h-[44px] md:min-h-0 px-2"
      >
        <span className="font-medium">
          {isPending ? 'Configuration' : 'Details'}
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
            <StepConfigurationPanel
              step={step}
              formSubmission={formSubmission}
              previousSteps={previousSteps}
              onEditStep={onEditStep}
              canEdit={canEdit}
            />
          ) : (
            <StepInputOutput
              step={step}
              status={status}
              onCopy={onCopy}
              previousSteps={previousSteps}
              formSubmission={formSubmission}
              imageGallery={imageGallery}
              usedImageGeneration={usedImageGeneration}
              onEditStep={onEditStep}
              canEdit={canEdit}
            />
          )}
        </div>
      )}
    </div>
  )
}

