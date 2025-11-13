'use client'

import { useMemo } from 'react'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'
import { MergedStep } from '@/types/job'
import { useImageArtifacts } from '@/hooks/useImageArtifacts'
import { StepHeader } from './StepHeader'
import { StepInputOutput } from './StepInputOutput'
import { StepProgressBar } from './StepProgressBar'
import { ArtifactPreview } from './ArtifactPreview'
import { getStepStatus, getPreviousSteps, getFormSubmission } from './utils'

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

  if (!steps || steps.length === 0) {
    return null
  }

  // Sort steps by step_order once
  const sortedSteps = useMemo(() => {
    return [...steps].sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0))
  }, [steps])

  // Compute form submission once
  const formSubmission = useMemo(
    () => getFormSubmission(sortedSteps),
    [sortedSteps]
  )

  // Helper function for step status (not memoized - simple computation)
  const getStepStatusForStep = (step: MergedStep) => getStepStatus(step, sortedSteps, jobStatus)

  return (
    <div className="mt-4 sm:mt-6 bg-white rounded-lg shadow p-4 sm:p-6">
      <button
        onClick={onToggleShow}
        className="flex items-center justify-between w-full text-left mb-4 touch-target"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Execution Steps</h2>
          <StepProgressBar 
            steps={sortedSteps} 
            jobStatus={jobStatus} 
            getStepStatus={getStepStatusForStep}
          />
        </div>
        {showExecutionSteps ? (
          <FiChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
        ) : (
          <FiChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
        )}
      </button>

      {showExecutionSteps && (
        <div className="space-y-2 pt-4 border-t border-gray-200">
          {sortedSteps.map((step) => {
            const stepOrder = step.step_order ?? 0
            const isExpanded = expandedSteps.has(stepOrder)
            const stepStatus = getStepStatusForStep(step)
            const isPending = stepStatus === 'pending'
            const isInProgress = stepStatus === 'in_progress'

            // Simple className based on status
            const stepClassName = isPending
              ? 'border-gray-200 bg-gray-50'
              : isInProgress
              ? 'border-blue-300 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-gray-300'

            return (
              <div 
                key={stepOrder} 
                className={`border rounded-lg transition-colors ${stepClassName}`}
              >
                <StepHeader
                  step={step}
                  status={stepStatus}
                  jobStatus={jobStatus}
                  canEdit={canEdit}
                  rerunningStep={rerunningStep}
                  onEditStep={onEditStep}
                  onRerunStep={onRerunStep}
                />

                <StepInputOutput
                  step={step}
                  status={stepStatus}
                  isExpanded={isExpanded}
                  onToggle={() => onToggleStep(stepOrder)}
                  onCopy={onCopy}
                  previousSteps={getPreviousSteps(step, sortedSteps)}
                  formSubmission={formSubmission}
                  imageArtifacts={imageArtifactsByStep.get(stepOrder) || []}
                  loadingImageArtifacts={loadingImageArtifacts}
                />

                {step.artifact_id && (
                  <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                    <ArtifactPreview artifactId={step.artifact_id} />
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
