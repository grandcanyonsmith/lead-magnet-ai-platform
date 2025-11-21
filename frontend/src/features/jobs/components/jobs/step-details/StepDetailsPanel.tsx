'use client'

import { useMemo } from 'react'
import { Disclosure, Transition } from '@headlessui/react'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'
import { Artifact } from '@/features/artifacts/types'
import { ExecutionStep, MergedStep, StepStatus } from '@/features/jobs/types'
import { StepInputOutput } from '../StepInputOutput'
import { StepConfigurationPanel } from './StepConfigurationPanel'
import {
  getMergedImageUrls,
  getStepModel,
  getStepToolChoice,
  getStepTools,
  isImageArtifact,
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

  const filteredArtifacts = useMemo(
    () => imageArtifacts.filter(isImageArtifact),
    [imageArtifacts]
  )

  const imageGallery = useMemo<ImageGalleryData>(() => {
    return {
      imageUrls: getMergedImageUrls(step),
      artifacts: filteredArtifacts,
      model: getStepModel(step),
      tools: getStepTools(step),
      toolChoice: getStepToolChoice(step),
      loading: loadingImageArtifacts,
    }
  }, [step, filteredArtifacts, loadingImageArtifacts])

  const usedImageGeneration = stepUsesImageGeneration(step, filteredArtifacts)

  return (
    <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 border-t border-gray-200/40">
      <Disclosure>
        <Disclosure.Button
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className="flex items-center justify-between w-full text-left text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-50/60 active:text-gray-900 active:bg-gray-100/60 rounded-xl transition-all duration-200 touch-target py-3 md:py-2.5 min-h-[44px] md:min-h-0 px-3 -mx-1"
        >
          <span className="font-semibold">
            {isPending ? 'Configuration' : 'Details'}
          </span>
          {isExpanded ? (
            <FiChevronUp className="w-5 h-5 flex-shrink-0 ml-2 text-gray-500 transition-transform duration-200" />
          ) : (
            <FiChevronDown className="w-5 h-5 flex-shrink-0 ml-2 text-gray-500 transition-transform duration-200" />
          )}
        </Disclosure.Button>
        <Transition
          show={isExpanded}
          enter="transition duration-200 ease-out"
          enterFrom="opacity-0 transform -translate-y-2"
          enterTo="opacity-100 transform translate-y-0"
          leave="transition duration-150 ease-in"
          leaveFrom="opacity-100 transform translate-y-0"
          leaveTo="opacity-0 transform -translate-y-2"
        >
          <Disclosure.Panel static className="mt-4 md:mt-3 bg-gradient-to-br from-gray-50/30 via-white to-gray-50/20 rounded-xl p-4 md:p-5 border border-gray-200/40 shadow-sm">
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
          </Disclosure.Panel>
        </Transition>
      </Disclosure>
    </div>
  )
}
