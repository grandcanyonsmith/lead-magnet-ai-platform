'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef } from 'react'
import { FiChevronDown, FiChevronUp, FiExternalLink, FiRefreshCw } from 'react-icons/fi'
import { useJobDetail } from '@/hooks/useJobDetail'
import { useJobExecutionSteps } from '@/hooks/useJobExecutionSteps'
import { useMergedSteps } from '@/hooks/useMergedSteps'
import { JobHeader } from '@/components/jobs/JobHeader'
import { JobDetails } from '@/components/jobs/JobDetails'
import { ExecutionSteps } from '@/components/jobs/ExecutionSteps'
import { TechnicalDetails } from '@/components/jobs/TechnicalDetails'
import { ResubmitModal } from '@/components/jobs/ResubmitModal'
import FlowchartSidePanel from '@/app/dashboard/workflows/components/FlowchartSidePanel'
import { api } from '@/lib/api'
import { WorkflowStep } from '@/types'
import { toast } from 'react-hot-toast'

export default function JobDetailClient() {
  const router = useRouter()
  const [showResubmitModal, setShowResubmitModal] = useState(false)
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null)
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)
  const [showRerunConfirm, setShowRerunConfirm] = useState(false)
  const [stepIndexForRerun, setStepIndexForRerun] = useState<number | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showFormSubmission, setShowFormSubmission] = useState(false)
  const latestStepUpdateRef = useRef<WorkflowStep | null>(null)
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
  } = useJobExecutionSteps()

  // Use the extracted merged steps hook
  const mergedSteps = useMergedSteps({ job, workflow })

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const handleResubmitClick = () => {
    setShowResubmitModal(true)
  }

  const handleResubmitConfirm = async () => {
    await handleResubmit()
    setShowResubmitModal(false)
  }

  const handleEditStep = (stepIndex: number) => {
    setEditingStepIndex(stepIndex)
    setIsSidePanelOpen(true)
    // Reset the ref when opening
    latestStepUpdateRef.current = null
  }

  const handleSaveStep = async (updatedStep: WorkflowStep) => {
    if (!workflow || editingStepIndex === null || !workflow.steps) {
      toast.error('Unable to save: Workflow data not available')
      return
    }

    try {
      // Clone the steps array and merge updated step with original to preserve all fields
      const updatedSteps = [...workflow.steps]
      const originalStep = updatedSteps[editingStepIndex]
      
      // Merge: keep all original fields, override with updated form fields
      updatedSteps[editingStepIndex] = {
        ...originalStep,
        ...updatedStep,
      }

      // Update the workflow via API
      await api.updateWorkflow(workflow.workflow_id, {
        steps: updatedSteps,
      })

      // Show success toast
      toast.success('Step updated successfully')

      // Store the step index for rerun confirmation
      setStepIndexForRerun(editingStepIndex)

      // Close the side panel
      setEditingStepIndex(null)
      setIsSidePanelOpen(false)

      // Show confirmation dialog for rerun
      setShowRerunConfirm(true)

      // Refresh the page to show updated data
      router.refresh()
    } catch (error: any) {
      console.error('Failed to save step:', error)
      toast.error(error.message || 'Failed to save step changes')
      throw error
    }
  }

  const handleCancelEdit = async () => {
    // FlowchartSidePanel's handleClose calls onChange with latest step, then onClose
    // So latestStepUpdateRef should have the latest changes
    // Only save if there are actual changes (ref is set)
    if (latestStepUpdateRef.current && editingStepIndex !== null) {
      const currentStep = workflow?.steps?.[editingStepIndex]
      // Check if there are actual changes by comparing step data
      const hasChanges = currentStep && JSON.stringify(currentStep) !== JSON.stringify(latestStepUpdateRef.current)
      if (hasChanges) {
        await handleSaveStep(latestStepUpdateRef.current)
      }
      latestStepUpdateRef.current = null
    }
    setEditingStepIndex(null)
    setIsSidePanelOpen(false)
  }

  const handleConfirmRerun = async () => {
    if (stepIndexForRerun !== null && handleRerunStep) {
      setShowRerunConfirm(false)
      await handleRerunStep(stepIndexForRerun)
      setStepIndexForRerun(null)
    }
  }

  const handleCancelRerun = () => {
    setShowRerunConfirm(false)
    setStepIndexForRerun(null)
  }


  if (loading) {
    return (
      <div>
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="h-10 bg-gray-200 rounded w-20 mb-4 animate-pulse"></div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-0">
            <div>
              <div className="h-7 sm:h-8 bg-gray-200 rounded w-64 mb-2 animate-pulse"></div>
              <div className="h-4 sm:h-5 bg-gray-200 rounded w-96 max-w-full animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Job Details skeleton */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-gray-50 rounded-lg border border-gray-100 p-3">
                  <div className="h-3 bg-gray-200 rounded w-24 mb-2 animate-pulse"></div>
                  <div className="h-5 bg-gray-200 rounded w-32 animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Execution Steps skeleton */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="h-6 bg-gray-200 rounded w-40 mb-4 animate-pulse"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 bg-gray-200 rounded-full animate-pulse flex-shrink-0"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-gray-200 rounded w-48 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                    <div className="h-20 bg-gray-100 rounded animate-pulse mt-2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
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
      <JobHeader error={error} resubmitting={resubmitting} onResubmit={handleResubmitClick} job={job} />
      
      <ResubmitModal
        isOpen={showResubmitModal}
        onClose={() => setShowResubmitModal(false)}
        onConfirm={handleResubmitConfirm}
        isResubmitting={resubmitting}
      />

      {/* Step Edit Side Panel */}
      {editingStepIndex !== null && workflow?.steps?.[editingStepIndex] && (
        <FlowchartSidePanel
          step={workflow.steps[editingStepIndex]}
          index={editingStepIndex}
          totalSteps={workflow.steps.length}
          allSteps={workflow.steps}
          isOpen={isSidePanelOpen}
          onClose={handleCancelEdit}
          onChange={(index, updatedStep) => {
            // Store the latest step update in a ref
            // When onClose is called, it will have the latest changes
            latestStepUpdateRef.current = updatedStep
          }}
          onDelete={() => {
            // Disable delete in execution viewer context
            toast.error('Cannot delete steps from execution viewer. Please edit the workflow template.')
          }}
          onMoveUp={() => {
            // Disable move in execution viewer context
            toast.error('Cannot reorder steps from execution viewer. Please edit the workflow template.')
          }}
          onMoveDown={() => {
            // Disable move in execution viewer context
            toast.error('Cannot reorder steps from execution viewer. Please edit the workflow template.')
          }}
          workflowId={workflow.workflow_id}
        />
      )}

      {/* Rerun Confirmation Dialog */}
      {showRerunConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={handleCancelRerun}
            />

            {/* Modal */}
            <div className="relative z-50 w-full max-w-md bg-white rounded-lg shadow-xl mx-4">
              <div className="p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
                  Step Updated Successfully
                </h3>
                <p className="text-sm text-gray-600 mb-4 sm:mb-6">
                  Would you like to rerun this step with the updated configuration?
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
                  <button
                    onClick={handleCancelRerun}
                    className="px-4 py-2.5 sm:py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors touch-target min-h-[44px] sm:min-h-0"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmRerun}
                    className="px-4 py-2.5 sm:py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors touch-target min-h-[44px] sm:min-h-0"
                  >
                    Rerun Step
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Execution Steps */}
      {(workflow?.steps && Array.isArray(workflow.steps) && workflow.steps.length > 0) || 
       (job.execution_steps && Array.isArray(job.execution_steps) && job.execution_steps.length > 0) ? (
        <>
          {executionStepsError && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium">Execution Steps Loading Error</h3>
                  <p className="mt-1 text-sm">{executionStepsError}</p>
                  {job?.execution_steps_s3_key && !executionStepsError?.includes('S3 Key:') && (
                    <p className="mt-2 text-xs font-mono break-all">
                      S3 Key: {job.execution_steps_s3_key}
                    </p>
                  )}
                </div>
              </div>
            </div>
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
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium">Execution Steps Not Available</h3>
              <p className="mt-1 text-sm">{executionStepsError}</p>
              {process.env.NODE_ENV === 'development' && job?.execution_steps_s3_key && (
                <p className="mt-2 text-xs font-mono break-all">
                  S3 Key: {job.execution_steps_s3_key}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Details and Form Submission - Collapsible sections at bottom */}
      <div className="mt-4 sm:mt-6 space-y-3 sm:space-y-4">
        {/* Job Details Section */}
        <div className="bg-white rounded-lg shadow">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center justify-between w-full text-left p-4 sm:p-6 touch-target min-h-[48px] sm:min-h-0"
          >
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Details</h2>
            {showDetails ? (
              <FiChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
            ) : (
              <FiChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
            )}
          </button>
          {showDetails && (
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
                onClick={() => setShowFormSubmission(!showFormSubmission)}
                className="flex items-center justify-between flex-1 text-left touch-target min-h-[48px] sm:min-h-0"
              >
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Form Submission Details</h2>
                {showFormSubmission ? (
                  <FiChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
                ) : (
                  <FiChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0 ml-2" />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleResubmitClick()
                }}
                disabled={resubmitting}
                className="ml-4 flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-target min-h-[44px] sm:min-h-0"
                title="Resubmit with same form answers"
              >
                <FiRefreshCw className={`w-4 h-4 ${resubmitting ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Resubmit</span>
              </button>
            </div>
            {showFormSubmission && (
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 border-t border-gray-200">
                <div className="pt-4 sm:pt-6">
                  {submission.form_data ? (
                    <div className="space-y-3">
                      {Object.entries(submission.form_data).map(([key, value]: [string, unknown]) => (
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
        <TechnicalDetails job={job} form={form} submission={submission} />
      </div>
    </div>
  )
}

