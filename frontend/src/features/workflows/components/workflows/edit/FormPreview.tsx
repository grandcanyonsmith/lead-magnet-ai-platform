'use client'

import { FormFormData } from '@/features/forms/hooks/useFormEdit'
import { FormField } from '@/features/forms/types'

interface FormPreviewProps {
  formFormData: FormFormData
}

export function FormPreview({ formFormData }: FormPreviewProps) {
  const defaultFields: FormField[] = [
    { field_id: 'name', field_type: 'text', label: 'Name', required: true },
    { field_id: 'email', field_type: 'email', label: 'Email', required: true },
    { field_id: 'phone', field_type: 'tel', label: 'Phone', required: false },
  ]
  const allFields = [...defaultFields, ...formFormData.form_fields_schema.fields]

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">{formFormData.form_name || 'Form Preview'}</h3>
      <div className="space-y-4">
        {allFields.map((field) => (
          <div key={field.field_id}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.field_type === 'textarea' ? (
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder={field.placeholder || ''}
                rows={4}
                disabled
              />
            ) : field.field_type === 'select' && field.options ? (
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled
              >
                <option value="">Select an option...</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.field_type === 'email' ? 'email' : field.field_type === 'tel' ? 'tel' : field.field_type === 'number' ? 'number' : 'text'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder={field.placeholder || ''}
                disabled
              />
            )}
          </div>
        ))}
        <button
          type="button"
          className="w-full py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled
        >
          Submit
        </button>
      </div>
    </div>
  )
}

