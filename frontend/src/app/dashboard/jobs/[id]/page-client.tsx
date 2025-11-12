'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { FiRefreshCw } from 'react-icons/fi'
import { useJobDetail } from '@/hooks/useJobDetail'
import { useJobExecutionSteps } from '@/hooks/useJobExecutionSteps'
import { JobHeader } from '@/components/jobs/JobHeader'
import { JobDetails } from '@/components/jobs/JobDetails'
import { ExecutionSteps } from '@/components/jobs/ExecutionSteps'
import { TechnicalDetails } from '@/components/jobs/TechnicalDetails'
import { ResubmitModal } from '@/components/jobs/ResubmitModal'
import { StepEditModal } from '@/components/jobs/StepEditModal'
import { api } from '@/lib/api'
import { WorkflowStep } from '@/types'
import { toast } from 'react-hot-toast'

export default function JobDetailClient() {
  const router = useRouter()
  const [showResubmitModal, setShowResubmitModal] = useState(false)
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null)
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
  } = useJobDetail()
  
  const {
    showExecutionSteps,
    setShowExecutionSteps,
    expandedSteps,
    toggleStep,
  } = useJobExecutionSteps()

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

  /**
   * Merge workflow steps with execution steps to display all steps in the UI.
   * 
   * This function:
   * - Maps execution steps to workflow steps by step_order
   * - Includes all execution steps (even those not in workflow, like html_generation)
   * - Creates pending steps for workflow steps that haven't executed yet
   * - Enriches execution steps with workflow step metadata
   */
  const getMergedSteps = () => {
    const executionSteps = job.execution_steps || []
    const workflowSteps = workflow?.steps || []
    
    if (!workflowSteps || !Array.isArray(workflowSteps) || workflowSteps.length === 0) {
      // Fallback to execution steps if no workflow steps available
      return executionSteps.map((step: any) => ({
        ...step,
        _status: step.output !== null && step.output !== undefined && step.output !== '' 
          ? 'completed' as const 
          : 'pending' as const
      }))
    }

    const executionStepsMap = new Map<number, any>()
    const mergedStepsMap = new Map<number, any>()
    
    // Create a map of execution steps by step_order
    executionSteps.forEach((execStep: any) => {
      const order = execStep.step_order
      if (order !== undefined && order !== null) {
        executionStepsMap.set(order, execStep)
      }
    })

    // First, add ALL execution steps to the merged map
    executionSteps.forEach((execStep: any) => {
      const order = execStep.step_order
      if (order !== undefined && order !== null) {
        mergedStepsMap.set(order, {
          ...execStep,
          _status: execStep.output !== null && execStep.output !== undefined && execStep.output !== '' 
            ? 'completed' as const 
            : 'pending' as const
        })
      }
    })

    // Then, ensure ALL workflow steps are included (both executed and pending)
    workflowSteps.forEach((workflowStep: any, index: number) => {
      // Workflow steps are 0-indexed, execution steps for workflow steps are 1-indexed
      const executionStepOrder = index + 1
      const existingStep = mergedStepsMap.get(executionStepOrder)
      
      if (existingStep) {
        // Step has been executed - enrich with workflow step info
        mergedStepsMap.set(executionStepOrder, {
          ...existingStep,
          // Override with workflow step info for consistency
          step_name: workflowStep.step_name || existingStep.step_name,
          model: workflowStep.model || existingStep.model,
          tools: workflowStep.tools || existingStep.input?.tools || existingStep.tools,
          tool_choice: workflowStep.tool_choice || existingStep.input?.tool_choice || existingStep.tool_choice,
        })
      } else {
        // Step hasn't been executed yet - create pending step
        const isJobProcessing = job.status === 'processing'
        // Count how many workflow steps have been executed (only count ai_generation steps with step_order matching workflow step indices)
        const executedWorkflowStepsCount = executionSteps.filter((s: any) => 
          s.step_order > 0 && 
          s.step_order <= workflowSteps.length &&
          (s.step_type === 'ai_generation' || s.step_type === 'workflow_step')
        ).length
        const isCurrentStep = isJobProcessing && executionStepOrder === executedWorkflowStepsCount + 1
        
        mergedStepsMap.set(executionStepOrder, {
          step_name: workflowStep.step_name,
          step_order: executionStepOrder,
          step_type: 'workflow_step',
          model: workflowStep.model,
          tools: workflowStep.tools || [],
          tool_choice: workflowStep.tool_choice || 'auto',
          instructions: workflowStep.instructions,
          input: {
            tools: workflowStep.tools || [],
            tool_choice: workflowStep.tool_choice || 'auto',
          },
          output: null,
          _status: isCurrentStep ? 'in_progress' as const : 'pending' as const,
        })
      }
    })

    // Also include any execution steps that don't map to workflow steps (like form_submission, html_generation, final_output)
    // Only add if they're not already in the map (to avoid overwriting enriched workflow steps)
    executionSteps.forEach((execStep: any) => {
      const order = execStep.step_order
      if (order !== undefined && order !== null && !mergedStepsMap.has(order)) {
        // If it's not a workflow step (step_order > workflowSteps.length or step_order === 0), ensure it's included
        if (order === 0 || order > workflowSteps.length || 
            (execStep.step_type !== 'ai_generation' && execStep.step_type !== 'workflow_step')) {
          mergedStepsMap.set(order, {
            ...execStep,
            _status: execStep.output !== null && execStep.output !== undefined && execStep.output !== '' 
              ? 'completed' as const 
              : 'pending' as const
          })
        }
      }
    })

    // Convert map to array and sort by step_order
    return Array.from(mergedStepsMap.values()).sort((a: any, b: any) => (a.step_order || 0) - (b.step_order || 0))
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

      {/* Execution Steps */}
      {(workflow?.steps && Array.isArray(workflow.steps) && workflow.steps.length > 0) || 
       (job.execution_steps && Array.isArray(job.execution_steps) && job.execution_steps.length > 0) ? (
        <ExecutionSteps
          steps={getMergedSteps()}
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
        />
      ) : null}

      {/* Technical Details */}
      <TechnicalDetails job={job} form={form} />
    </div>
  )
}

