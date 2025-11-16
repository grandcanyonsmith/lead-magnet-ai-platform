'use client'

import { Artifact } from '@/features/artifacts/types'
import { ExecutionStep, MergedStep, StepStatus } from '@/features/jobs/types'
import { StepHeader } from './StepHeader'
import { StepDetailsPanel } from './step-details/StepDetailsPanel'
import { ImagePreview } from './ImagePreview'
import { getStepFilePreviews } from './step-utils'

interface StepCardProps {
  step: MergedStep
  status: StepStatus
  jobStatus?: string
  rerunningStep?: number | null
  isExpanded: boolean
  onToggle: () => void
  onCopy: (text: string) => void
  previousSteps: ExecutionStep[]
  formSubmission: Record<string, unknown> | null | undefined
  imageArtifacts: Artifact[]
  loadingImageArtifacts?: boolean
  onRerunStep?: (stepIndex: number) => Promise<void>
  onEditStep?: (stepIndex: number) => void
  canEdit?: boolean
}

export function StepCard({
  step,
  status,
  jobStatus,
  rerunningStep,
  isExpanded,
  onToggle,
  onCopy,
  previousSteps,
  formSubmission,
  imageArtifacts,
  loadingImageArtifacts,
  onRerunStep,
  onEditStep,
  canEdit,
}: StepCardProps) {
  const stepOrder = step.step_order ?? 0
  const isPending = status === 'pending'
  const isInProgress = status === 'in_progress'
  const isFailed = status === 'failed'
  const isCompleted = status === 'completed'
  const isRerunning = rerunningStep !== null && stepOrder > 0 && rerunningStep === stepOrder - 1

  const stepClassName = (() => {
    if (isRerunning) {
      return 'border-blue-500 bg-blue-50/90 shadow-lg ring-1 ring-blue-200'
    }
    if (isInProgress) {
      return 'border-blue-400 bg-blue-50/80 shadow-md ring-1 ring-blue-100'
    }
    if (isFailed) {
      return 'border-red-300 bg-red-50/80 shadow-md'
    }
    if (isCompleted) {
      return 'border-green-200 bg-white shadow-sm'
    }
    return 'border-gray-300 bg-gray-50/50 shadow-sm'
  })()

  const filesToShow = getStepFilePreviews(step, imageArtifacts)

  return (
    <div
      className={`border-2 rounded-xl transition-all hover:shadow-md ${stepClassName}`}
      data-step-status={status}
      data-step-order={stepOrder}
    >
      <StepHeader
        step={step}
        status={status}
        jobStatus={jobStatus}
        canEdit={canEdit}
        rerunningStep={rerunningStep}
        onEditStep={onEditStep}
        onRerunStep={onRerunStep}
      />

      <StepDetailsPanel
        step={step}
        status={status}
        isExpanded={isExpanded}
        onToggle={onToggle}
        onCopy={onCopy}
        previousSteps={previousSteps}
        formSubmission={formSubmission}
        imageArtifacts={imageArtifacts}
        loadingImageArtifacts={loadingImageArtifacts}
        onEditStep={onEditStep}
        canEdit={canEdit}
      />

      {filesToShow.length > 0 && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4">
          {filesToShow.map((file, idx) => {
            if (file.type === 'imageArtifact') {
              const artifact = file.data as Artifact
              return (
                <ImagePreview
                  key={file.key}
                  artifact={artifact}
                  imageIndex={idx}
                  model={step.model}
                  tools={step.input?.tools || step.tools}
                  toolChoice={step.input?.tool_choice || step.tool_choice}
                />
              )
            }
            if (file.type === 'imageUrl') {
              const imageUrl = file.data as string
              return (
                <ImagePreview
                  key={file.key}
                  imageUrl={imageUrl}
                  imageIndex={idx}
                  model={step.model}
                  tools={step.input?.tools || step.tools}
                  toolChoice={step.input?.tool_choice || step.tool_choice}
                />
              )
            }
            return null
          })}
        </div>
      )}
    </div>
  )
}

