'use client'

import { useRouter } from 'next/navigation'
import { FiSave } from 'react-icons/fi'
import WorkflowFlowchart from '@/app/dashboard/workflows/components/WorkflowFlowchart'
import { WorkflowFormData } from '@/hooks/useWorkflowEdit'
import { WorkflowStep } from '@/app/dashboard/workflows/components/WorkflowStepEditor'

interface WorkflowTabProps {
  formData: WorkflowFormData
  steps: WorkflowStep[]
  submitting: boolean
  selectedStepIndex: number | null
  isSidePanelOpen: boolean
  onFormDataChange: (field: string, value: any) => void
  onAddStep: () => void
  onStepClick: (index: number) => void
  onStepsReorder: (newSteps: WorkflowStep[]) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

export function WorkflowTab({
  formData,
  steps,
  submitting,
  selectedStepIndex,
  isSidePanelOpen,
  onFormDataChange,
  onAddStep,
  onStepClick,
  onStepsReorder,
  onSubmit,
  onCancel,
}: WorkflowTabProps) {
  return (
    <form onSubmit={onSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Lead Magnet Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.workflow_name}
          onChange={(e) => onFormDataChange('workflow_name', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Course Idea Validator"
          maxLength={200}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          value={formData.workflow_description}
          onChange={(e) => onFormDataChange('workflow_description', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Describe what this lead magnet does (e.g., validates course ideas and provides market research)..."
          rows={3}
          maxLength={1000}
        />
      </div>

      {/* Workflow Steps - Flowchart Visualization */}
      <div className="space-y-4 pt-6 border-t">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Workflow Steps</h2>
          <p className="text-sm text-gray-600">
            Define the steps your workflow will execute. Each step receives context from all previous steps.
            Click on a step to edit its details.
          </p>
        </div>
        
        <WorkflowFlowchart
          steps={steps}
          activeStepIndex={selectedStepIndex}
          onStepClick={onStepClick}
          onAddStep={onAddStep}
          onStepsReorder={(newSteps) => {
            const reorderedSteps = newSteps.map((step, index) => ({
              ...step,
              step_order: index,
            }))
            onStepsReorder(reorderedSteps)
          }}
        />
      </div>

      {formData.html_enabled && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Templates are managed in the Template tab above. Enable &quot;Generate Styled HTML&quot; to access template editing.
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors touch-target"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || (formData.html_enabled && !formData.template_id)}
          className="flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-target"
        >
          <FiSave className="w-5 h-5 mr-2" />
          {submitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

