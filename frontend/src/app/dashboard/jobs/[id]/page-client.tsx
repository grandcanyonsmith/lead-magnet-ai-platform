'use client'

import { useRouter } from 'next/navigation'
import { FiChevronDown, FiChevronUp, FiRefreshCw } from 'react-icons/fi'
import { useJobDetail } from '@/hooks/useJobDetail'
import { useJobExecutionSteps } from '@/hooks/useJobExecutionSteps'
import { useMergedSteps } from '@/hooks/useMergedSteps'
import { useJobDetailState } from '@/hooks/useJobDetailState'
import { JobHeader } from '@/components/jobs/JobHeader'
import { JobDetails } from '@/components/jobs/JobDetails'
import { ExecutionSteps } from '@/components/jobs/ExecutionSteps'
import { ExecutionStepsError } from '@/components/jobs/ExecutionStepsError'
import { TechnicalDetails } from '@/components/jobs/TechnicalDetails'
import { ResubmitModal } from '@/components/jobs/ResubmitModal'
import { JobDetailSkeleton } from '@/components/jobs/JobDetailSkeleton'
import { RerunConfirmDialog } from '@/components/jobs/RerunConfirmDialog'
import FlowchartSidePanel from '@/app/dashboard/workflows/components/FlowchartSidePanel'
import { api } from '@/lib/api'
import { copyToClipboard } from '@/utils/clipboard'
import { toast } from 'react-hot-toast'

/**
 * Job Detail Page Client Component
 * 
 * Displays detailed information about a job execution including:
 * - Job status and metadata
 * - Execution steps with ability to edit and rerun
 * - Form submission details
 * - Technical details and artifacts
 * 
 * Features:
 * - Real-time polling for processing jobs
 * - Step editing via side panel
 * - Step rerun functionality
 * - Job resubmission
 */
export default function JobDetailClient() {
  const router = useRouter()
  
  // Consolidated state management
  const state = useJobDetailState()
  const {
    job,
    workflow,
    form,
    submission,
    loading,
    error,
    resubmitting,
    handleResubmit,
    rerunningStep,
    handleRerunStep,
    executionStepsError,
  } = useJobDetail()
  
  const {
    showExecutionSteps,
    setShowExecutionSteps,
    expandedSteps,
    toggleStep,
  } = useJobExecutionSteps({ jobId })

  const mergedSteps = useMergedSteps({ job, workflow, rerunningStep })
  const hasSteps = (workflow?.steps?.length ?? 0) > 0 || (job?.execution_steps?.length ?? 0) > 0

  /**
   * Handle resubmit confirmation - creates a new job with same submission data
   */
  const handleResubmitConfirm = async () => {
    await handleResubmit()
    state.closeResubmitModal()
  }

  /**
   * Open step editor panel for the specified step index
   */
  const handleEditStep = (stepIndex: number) => {
    state.openEditStep(stepIndex)
  }

  /**
   * Save updated step configuration and prompt for rerun
   * 
   * @param updatedStep - Updated step configuration from the editor
   */
  const handleSaveStep = async (updatedStep: any) => {
    if (!workflow || state.editingStepIndex === null || !workflow.steps) {
      toast.error('Unable to save: Workflow data not available')
      return
    }

    try {
      // Clone the steps array and merge updated step with original to preserve all fields
      const updatedSteps = [...workflow.steps]
      const originalStep = updatedSteps[state.editingStepIndex]
      
      // Merge: keep all original fields, override with updated form fields
      updatedSteps[state.editingStepIndex] = {
        ...originalStep,
        ...updatedStep,
      }

      // Update the workflow via API
      await api.updateWorkflow(workflow.workflow_id, {
        steps: updatedSteps,
      })

      toast.success('Step updated successfully')

      // Store the step index for rerun confirmation and close panel
      const stepIndex = state.editingStepIndex
      state.closeEditStep()
      state.openRerunConfirm(stepIndex)

      // Refresh the page to show updated data
      router.refresh()
    } catch (error: any) {
      console.error('Failed to save step:', error)
      toast.error(error.message || 'Failed to save step changes')
      throw error
    }
  }

  /**
   * Cancel step editing - saves changes if any were made
   * FlowchartSidePanel calls onChange before onClose, so ref contains latest changes
   */
  const handleCancelEdit = async () => {
    if (state.latestStepUpdateRef.current && state.editingStepIndex !== null) {
      const currentStep = workflow?.steps?.[state.editingStepIndex]
      const hasChanges = currentStep && 
        JSON.stringify(currentStep) !== JSON.stringify(state.latestStepUpdateRef.current)
      if (hasChanges) {
        await handleSaveStep(state.latestStepUpdateRef.current)
      }
      state.latestStepUpdateRef.current = null
    }
    state.closeEditStep()
  }

  /**
   * Confirm and execute step rerun after editing
   */
  const handleConfirmRerun = async () => {
    if (state.stepIndexForRerun !== null && handleRerunStep) {
      const stepIndex = state.stepIndexForRerun
      state.closeRerunConfirm()
      await handleRerunStep(stepIndex)
    }
  }


  if (loading) {
    return <JobDetailSkeleton />
  }

  if (error && !job) {
    return (
      <div>
        <JobHeader error={error} resubmitting={false} onResubmit={() => {}} />
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      </div>
    )
  }

  if (!job) {
    return null
  }

  return (
    <div>
      <JobHeader error={error} resubmitting={resubmitting} onResubmit={state.openResubmitModal} job={job} />
      
      <ResubmitModal
        isOpen={state.showResubmitModal}
        onClose={state.closeResubmitModal}
        onConfirm={handleResubmitConfirm}
        isResubmitting={resubmitting}
      />

      {/* Step Edit Side Panel */}
      {state.editingStepIndex !== null && workflow?.steps?.[state.editingStepIndex] && (
        <FlowchartSidePanel
          step={workflow.steps[state.editingStepIndex]}
          index={state.editingStepIndex}
          totalSteps={workflow.steps.length}
          allSteps={workflow.steps}
          isOpen={state.isSidePanelOpen}
          onClose={handleCancelEdit}
          onChange={(index, updatedStep) => {
            // Store the latest step update in a ref
            // When onClose is called, it will have the latest changes
            state.latestStepUpdateRef.current = updatedStep
          }}
          onDelete={() => toast.error('Cannot delete steps from execution viewer. Please edit the workflow template.')}
          onMoveUp={() => toast.error('Cannot reorder steps from execution viewer. Please edit the workflow template.')}
          onMoveDown={() => toast.error('Cannot reorder steps from execution viewer. Please edit the workflow template.')}
          workflowId={workflow.workflow_id}
        />
      )}

      {/* Rerun Confirmation Dialog */}
      <RerunConfirmDialog
        isOpen={state.showRerunConfirm}
        onConfirm={handleConfirmRerun}
        onCancel={state.closeRerunConfirm}
      />

      {/* Execution Steps */}
      {hasSteps ? (
        <>
          {executionStepsError && (
            <ExecutionStepsError 
              error={executionStepsError} 
              s3Key={job?.execution_steps_s3_key}
              className="mb-4"
            />
          )}
          <ExecutionSteps
            steps={mergedSteps}
            expandedSteps={expandedSteps}
            showExecutionSteps={showExecutionSteps}
            onToggleShow={() => setShowExecutionSteps(!showExecutionSteps)}
            onToggleStep={toggleStep}
            onCopy={copyToClipboard}
            jobStatus={job.status}
            onRerunStep={handleRerunStep}
            rerunningStep={rerunningStep}
            onEditStep={handleEditStep}
            canEdit={!!workflow}
            jobId={job.job_id}
          />
        </>
      ) : executionStepsError ? (
        <ExecutionStepsError 
          error={executionStepsError} 
          s3Key={job?.execution_steps_s3_key}
          title="Execution Steps Not Available"
        />
      ) : null}

      {/* Details and Form Submission - Collapsible sections at bottom */}
      <div className="mt-4 sm:mt-6 space-y-3 sm:space-y-4">
        {/* Job Details Section */}
        <div className="bg-white rounded-lg shadow">
          <button
            onClick={() => state.setShowDetails(!state.showDetails)}
            className="flex items-center justify-between w-full text-left p-4 sm:p-6 touch-target min-h-[48px] sm:min-h-0"
          >
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Details</h2>
            {state.showDetails ? (
              <FiChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
            ) : (
              <FiChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
            )}
          </button>
          {state.showDetails && (
            <div className="px-4 sm:px-6 pb-4 sm:pb-6 border-t border-gray-200">
              <div className="pt-4 sm:pt-6">
                <JobDetails job={job} workflow={workflow} hideContainer={true} />
              </div>
            </div>
          )}
        </div>

        {/* Form Submission Details Section */}
        {submission && (
          <div className="bg-white rounded-lg shadow">
            <div className="flex items-center justify-between p-4 sm:p-6">
              <button
                onClick={() => state.setShowFormSubmission(!state.showFormSubmission)}
                className="flex items-center justify-between flex-1 text-left touch-target min-h-[48px] sm:min-h-0"
              >
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Form Submission Details</h2>
                {state.showFormSubmission ? (
                  <FiChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
                ) : (
                  <FiChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  state.openResubmitModal()
                }}
                disabled={resubmitting}
                className="ml-4 flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-target min-h-[44px] sm:min-h-0"
                title="Resubmit with same form answers"
              >
                <FiRefreshCw className={`w-4 h-4 ${resubmitting ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Resubmit</span>
              </button>
            </div>
            {state.showFormSubmission && (
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 border-t border-gray-200">
                <div className="pt-4 sm:pt-6">
                  {submission.submission_data ? (
                    <div className="space-y-3">
                      {Object.entries(submission.submission_data).map(([key, value]: [string, any]) => (
                        <div key={key} className="border-b border-gray-100 pb-3 last:border-b-0">
                          <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                            {key.replace(/_/g, ' ')}
                          </label>
                          <p className="text-sm text-gray-900 break-words">
                            {typeof value === 'string' ? value : JSON.stringify(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No submission data available</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Technical Details */}
        <TechnicalDetails job={job} form={form} />
      </div>
    </div>
  )
}

