'use client'

import { WorkflowFormData } from '@/hooks/useWorkflowForm'

interface WorkflowBasicFieldsProps {
  formData: WorkflowFormData
  onChange: (field: keyof WorkflowFormData, value: any) => void
}

export function WorkflowBasicFields({ formData, onChange }: WorkflowBasicFieldsProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900 border-b pb-2">Lead Magnet Configuration</h2>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Lead Magnet Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.workflow_name}
          onChange={(e) => onChange('workflow_name', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Course Idea Validator"
          maxLength={200}
          required
          data-tour="workflow-name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          value={formData.workflow_description}
          onChange={(e) => onChange('workflow_description', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Describe what this lead magnet does..."
          rows={3}
          maxLength={1000}
          data-tour="workflow-description"
        />
      </div>
    </div>
  )
}

