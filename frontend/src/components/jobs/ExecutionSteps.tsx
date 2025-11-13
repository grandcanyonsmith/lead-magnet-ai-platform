'use client'

import { useState, useMemo, useCallback } from 'react'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'
import { MergedStep, StepStatus } from '@/types/job'
import { useImageArtifacts } from '@/hooks/useImageArtifacts'
import { StepHeader } from './StepHeader'
import { StepInputOutput } from './StepInputOutput'
import { StepProgressBar } from './StepProgressBar'
import { ArtifactPreview } from './ArtifactPreview'

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
  onQuickEdit?: (stepOrder: number, stepName: string) => void
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
  onQuickEdit,
  jobId,
}: ExecutionStepsProps) {
  // State for managing expanded previous steps (separate from main step expansion)
  const [expandedPrevSteps, setExpandedPrevSteps] = useState<Set<number>>(new Set())
  
  // Fetch image artifacts using custom hook
  const { imageArtifactsByStep, loading: loadingImageArtifacts } = useImageArtifacts({
    jobId,
    steps,
  })

  if (!steps || steps.length === 0) {
    return null
  }

  // Sort steps by step_order to ensure correct display order
  const sortedSteps = useMemo(() => {
    return [...steps].sort((a, b) => {
      const orderA = a.step_order ?? 0
      const orderB = b.step_order ?? 0
      return orderA - orderB
    })
  }, [steps])

  const togglePrevStep = useCallback((stepOrder: number) => {
    setExpandedPrevSteps((prev) => {
      const newExpanded = new Set(prev)
      if (newExpanded.has(stepOrder)) {
        newExpanded.delete(stepOrder)
      } else {
        newExpanded.add(stepOrder)
      }
      return newExpanded
    })
  }, [])

  // Get step status function (memoized)
  const getStepStatus = useCallback((step: MergedStep): StepStatus => {
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
      const completedSteps = sortedSteps.filter((s) => 
        s.output !== null && s.output !== undefined && s.output !== ''
      )
      const stepIndex = sortedSteps.indexOf(step)
      // If this step comes right after the last completed step, it's in progress
      if (stepIndex === completedSteps.length && stepIndex < sortedSteps.length) {
        return 'in_progress'
      }
    }
    
    // Check if job failed and step has no output
    if (jobStatus === 'failed') {
      const completedSteps = sortedSteps.filter((s) => 
        s.output !== null && s.output !== undefined && s.output !== ''
      )
      const stepIndex = sortedSteps.indexOf(step)
      // If step was supposed to run but didn't complete, mark as failed
      if (stepIndex <= completedSteps.length && step.output === null) {
        return 'failed'
      }
    }
    
    return 'pending'
  }, [sortedSteps, jobStatus])

  // Get previous steps for context
  const getPreviousSteps = useCallback((currentStep: MergedStep) => {
    const currentOrder = currentStep.step_order || 0
    
    return sortedSteps
      .filter((step) => {
        const stepOrder = step.step_order || 0
        return (
          stepOrder < currentOrder &&
          stepOrder > 0 && // Exclude form submission (step 0)
          step.output !== null &&
          step.output !== undefined &&
          step.output !== ''
        )
      })
      .sort((a, b) => (a.step_order || 0) - (b.step_order || 0))
      .map((step) => ({
        step_order: step.step_order,
        step_name: step.step_name || `Step ${step.step_order}`,
        output: step.output,
        image_urls: undefined,
      }))
  }, [sortedSteps])

  // Get form submission data
  const getFormSubmission = useCallback((currentStep: MergedStep) => {
    const formSubmissionStep = sortedSteps.find((s) => s.step_order === 0)
    if (formSubmissionStep && formSubmissionStep.output) {
      return formSubmissionStep.output
    }
    return null
  }, [sortedSteps])

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
            getStepStatus={getStepStatus}
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
          {sortedSteps.map((step, index) => {
            const isExpanded = expandedSteps.has(step.step_order ?? 0)
            const stepStatus = getStepStatus(step)
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

            // Create unique key combining step_order, step_type, and index to avoid duplicates
            const uniqueKey = `${step.step_order || index}-${step.step_type || 'unknown'}-${index}`

            return (
              <div 
                key={uniqueKey} 
                className={`border rounded-lg transition-colors ${
                  isPending 
                    ? 'border-gray-200 bg-gray-50' 
                    : 'border-gray-200 bg-white hover:border-gray-300'
                } ${isInProgress ? 'border-blue-300 bg-blue-50' : ''}`}
              >
                {/* Header Section */}
                <StepHeader
                  step={step}
                  status={stepStatus}
                  jobStatus={jobStatus}
                  canEdit={canEdit}
                  rerunningStep={rerunningStep}
                  onEditStep={onEditStep}
                  onQuickEdit={onQuickEdit}
                  onRerunStep={onRerunStep}
                />

                {/* Input/Output Section */}
                <StepInputOutput
                  step={step}
                  status={stepStatus}
                  isExpanded={isExpanded}
                  onToggle={() => onToggleStep(step.step_order ?? 0)}
                  onCopy={onCopy}
                  previousSteps={getPreviousSteps(step)}
                  formSubmission={getFormSubmission(step)}
                  expandedPrevSteps={expandedPrevSteps}
                  onTogglePrevStep={togglePrevStep}
                  imageArtifacts={imageArtifactsByStep.get(step.step_order ?? 0) || []}
                  loadingImageArtifacts={loadingImageArtifacts}
                />

                {/* Artifact Preview/Link */}
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
