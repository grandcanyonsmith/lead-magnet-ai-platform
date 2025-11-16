'use client'

import { useMemo } from 'react'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'
import { MergedStep } from '@/types/job'
import { useImageArtifacts } from '@/hooks/useImageArtifacts'
import { StepProgressBar } from './StepProgressBar'
import { getStepStatus, getPreviousSteps, getFormSubmission } from './utils'
import { StepCard } from './StepCard'

interface ExecutionStepsProps {
  steps: MergedStep[]
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
  jobId?: string
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
  jobId,
}: ExecutionStepsProps) {
  // Fetch image artifacts using custom hook
  const { imageArtifactsByStep, loading: loadingImageArtifacts } = useImageArtifacts({
    jobId,
    steps,
  })

  // Sort steps by step_order once (must be before early return)
  const sortedSteps = useMemo(() => {
    if (!steps || steps.length === 0) {
      return []
    }
    return [...steps].sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0))
  }, [steps])

  // Compute form submission once (must be before early return)
  const formSubmission = useMemo(
    () => getFormSubmission(sortedSteps),
    [sortedSteps]
  )

  // Helper function for step status (not memoized - simple computation)
  const getStepStatusForStep = (step: MergedStep) => {
    return getStepStatus(step, sortedSteps, jobStatus, rerunningStep)
  }

  if (!steps || steps.length === 0) {
    return null
  }

  return (
    <div className="mt-4 sm:mt-6 bg-white rounded-lg shadow p-4 sm:p-6">
      <button
        onClick={onToggleShow}
        className="flex items-center justify-between w-full text-left mb-4 touch-target min-h-[48px] sm:min-h-0"
      >
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Execution Steps</h2>
          <div className="hidden sm:block">
            <StepProgressBar 
              steps={sortedSteps} 
              jobStatus={jobStatus} 
              getStepStatus={getStepStatusForStep}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="sm:hidden">
            <StepProgressBar 
              steps={sortedSteps} 
              jobStatus={jobStatus} 
              getStepStatus={getStepStatusForStep}
            />
          </div>
          {showExecutionSteps ? (
            <FiChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
          ) : (
            <FiChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
          )}
        </div>
      </button>

      {showExecutionSteps && (
        <div className="space-y-2 pt-4 border-t border-gray-200">
          {sortedSteps.map((step) => {
            const stepOrder = step.step_order ?? 0
            const isExpanded = expandedSteps.has(stepOrder)
            const stepStatus = getStepStatusForStep(step)
            const imageArtifacts = imageArtifactsByStep.get(stepOrder) || []

            return (
              <StepCard
                key={stepOrder}
                step={step}
                status={stepStatus}
                jobStatus={jobStatus}
                rerunningStep={rerunningStep}
                isExpanded={isExpanded}
                onToggle={() => onToggleStep(stepOrder)}
                onCopy={onCopy}
                previousSteps={getPreviousSteps(step, sortedSteps)}
                formSubmission={formSubmission}
                imageArtifacts={imageArtifacts}
                loadingImageArtifacts={loadingImageArtifacts}
                onRerunStep={onRerunStep}
                onEditStep={onEditStep}
                canEdit={canEdit}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
