'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { FiRefreshCw } from 'react-icons/fi'
import { useJobDetail } from '@/hooks/useJobDetail'
import { useJobExecutionSteps } from '@/hooks/useJobExecutionSteps'
import { useMergedSteps } from '@/hooks/useMergedSteps'
import { JobHeader } from '@/components/jobs/JobHeader'
import { JobDetails } from '@/components/jobs/JobDetails'
import { ExecutionSteps } from '@/components/jobs/ExecutionSteps'
import { TechnicalDetails } from '@/components/jobs/TechnicalDetails'
import { ResubmitModal } from '@/components/jobs/ResubmitModal'
import { StepEditModal } from '@/components/jobs/StepEditModal'
import { QuickEditStepModal } from '@/components/jobs/QuickEditStepModal'
import { api } from '@/lib/api'
import { WorkflowStep } from '@/types'
import { toast } from 'react-hot-toast'

export default function JobDetailClient() {
  const router = useRouter()
  const [showResubmitModal, setShowResubmitModal] = useState(false)
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null)
  const [quickEditStep, setQuickEditStep] = useState<{ stepOrder: number; stepName: string } | null>(null)
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

      // Close the modal
      setEditingStepIndex(null)

      // Refresh the page to show updated data
      router.refresh()
    } catch (error: any) {
      console.error('Failed to save step:', error)
      toast.error(error.message || 'Failed to save step changes')
      throw error
    }
  }

  const handleCancelEdit = () => {
    setEditingStepIndex(null)
  }

  const handleQuickEdit = (stepOrder: number, stepName: string) => {
    setQuickEditStep({ stepOrder, stepName })
  }

  const handleQuickEditClose = () => {
    setQuickEditStep(null)
  }

  const handleQuickEditSave = () => {
    // Refresh job data to show updated step
    router.refresh()
  }


  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
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
      <JobHeader error={error} resubmitting={resubmitting} onResubmit={handleResubmitClick} />
      
      <ResubmitModal
        isOpen={showResubmitModal}
        onClose={() => setShowResubmitModal(false)}
        onConfirm={handleResubmitConfirm}
        isResubmitting={resubmitting}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <JobDetails job={job} workflow={workflow} />

        {/* Form Submission Details */}
        {submission && submission.submission_data ? (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Form Submission Details</h2>
              <button
                onClick={handleResubmitClick}
                disabled={resubmitting}
                className="flex items-center justify-center px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium touch-target"
              >
                {resubmitting ? (
                  <>
                    <FiRefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Resubmitting...
                  </>
                ) : (
                  <>
                    <FiRefreshCw className="w-4 h-4 mr-2" />
                    Resubmit
                  </>
                )}
              </button>
            </div>
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
          </div>
        ) : submission ? (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Form Submission Details</h2>
              <button
                onClick={handleResubmitClick}
                disabled={resubmitting}
                className="flex items-center justify-center px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium touch-target"
              >
                {resubmitting ? (
                  <>
                    <FiRefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Resubmitting...
                  </>
                ) : (
                  <>
                    <FiRefreshCw className="w-4 h-4 mr-2" />
                    Resubmit
                  </>
                )}
              </button>
            </div>
            <p className="text-sm text-gray-500">No submission data available</p>
          </div>
        ) : null}
      </div>

      {/* Step Edit Modal */}
      <StepEditModal
        step={editingStepIndex !== null && workflow?.steps?.[editingStepIndex] ? workflow.steps[editingStepIndex] : null}
        isOpen={editingStepIndex !== null}
        onClose={handleCancelEdit}
        onSave={handleSaveStep}
        jobStatus={job.status}
        allSteps={workflow?.steps || []}
        currentStepIndex={editingStepIndex ?? undefined}
      />

      {/* Quick Edit Step Modal */}
      {quickEditStep && (
        <QuickEditStepModal
          isOpen={true}
          onClose={handleQuickEditClose}
          jobId={job.job_id}
          stepOrder={quickEditStep.stepOrder}
          stepName={quickEditStep.stepName}
          onSave={handleQuickEditSave}
        />
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
            onQuickEdit={handleQuickEdit}
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

      {/* Technical Details */}
      <TechnicalDetails job={job} form={form} />
    </div>
  )
}

