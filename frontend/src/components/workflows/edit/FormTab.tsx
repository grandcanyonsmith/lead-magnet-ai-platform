'use client'

import { FiSave, FiPlus, FiMinus, FiChevronUp, FiChevronDown } from 'react-icons/fi'
import { FormFormData, FormField } from '@/hooks/useFormEdit'
import { getFieldTypeIcon } from '@/utils/formUtils'

interface FormTabProps {
  formFormData: FormFormData
  workflowName: string
  submitting: boolean
  onFormChange: (field: string, value: any) => void
  onFieldChange: (index: number, field: string, value: any) => void
  onAddField: () => void
  onRemoveField: (index: number) => void
  onMoveFieldUp: (index: number) => void
  onMoveFieldDown: (index: number) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

function FormPreview({ formFormData }: { formFormData: FormFormData }) {
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

export function FormTab({
  formFormData,
  workflowName,
  submitting,
  onFormChange,
  onFieldChange,
  onAddField,
  onRemoveField,
  onMoveFieldUp,
  onMoveFieldDown,
  onSubmit,
  onCancel,
}: FormTabProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Form Settings */}
      <form onSubmit={onSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> The form name is automatically synced with the lead magnet name. Name, email, and phone fields are always included and cannot be removed.
          </p>
        </div>

        {/* Basic Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Basic Settings</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Form Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formFormData.form_name}
              onChange={(e) => onFormChange('form_name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Lead Magnet Form"
              maxLength={200}
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              This is automatically set to &quot;{workflowName} Form&quot;
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Public URL Slug <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formFormData.public_slug}
              onChange={(e) => onFormChange('public_slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
              placeholder="lead-magnet-form"
              pattern="[a-z0-9-]+"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              URL-friendly identifier. Only lowercase letters, numbers, and hyphens allowed.
            </p>
            {formFormData.public_slug && (
              <p className="mt-1 text-xs text-primary-600">
                Form URL: {typeof window !== 'undefined' ? `${window.location.origin}/v1/forms/${formFormData.public_slug}` : `/v1/forms/${formFormData.public_slug}`}
              </p>
            )}
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-4 pt-6 border-t">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Form Fields</h3>
            <button
              type="button"
              onClick={onAddField}
              className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
            >
              <FiPlus className="w-4 h-4 mr-2" />
              Add Field
            </button>
          </div>
          <div className="space-y-3">
            {formFormData.form_fields_schema.fields.map((field, index) => (
              <div
                key={field.field_id || index}
                className="border border-gray-200 rounded-lg p-4 space-y-3 bg-white hover:border-gray-300"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2 flex-1">
                    <div className="flex items-center space-x-2 px-2 py-1 bg-gray-100 rounded text-gray-700">
                      {getFieldTypeIcon(field.field_type)}
                      <span className="text-xs font-medium capitalize">{field.field_type}</span>
                    </div>
                    {field.required && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                        Required
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onMoveFieldUp(index)}
                      disabled={index === 0}
                      className="text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed p-1 touch-target"
                      title="Move up"
                    >
                      <FiChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveFieldDown(index)}
                      disabled={index === formFormData.form_fields_schema.fields.length - 1}
                      className="text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed p-1 touch-target"
                      title="Move down"
                    >
                      <FiChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveField(index)}
                      className="text-red-600 hover:text-red-700 p-1 touch-target ml-2"
                      title="Remove field"
                    >
                      <FiMinus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Field Type</label>
                    <select
                      value={field.field_type}
                      onChange={(e) => onFieldChange(index, 'field_type', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="tel">Phone</option>
                      <option value="textarea">Textarea</option>
                      <option value="select">Select</option>
                      <option value="number">Number</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Label</label>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => onFieldChange(index, 'label', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Field Label"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Placeholder</label>
                  <input
                    type="text"
                    value={field.placeholder || ''}
                    onChange={(e) => onFieldChange(index, 'placeholder', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Placeholder text"
                  />
                </div>
                {field.field_type === 'select' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Options (comma-separated)</label>
                    <input
                      type="text"
                      value={field.options?.join(', ') || ''}
                      onChange={(e) => onFieldChange(index, 'options', e.target.value.split(',').map(o => o.trim()).filter(o => o))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Option 1, Option 2, Option 3"
                    />
                  </div>
                )}
                <div className="flex items-center">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => onFieldChange(index, 'required', e.target.checked)}
                      className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="text-xs text-gray-700">Required field</span>
                  </label>
                </div>
              </div>
                ))}
                {formFormData.form_fields_schema.fields.length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <p className="text-sm text-gray-500">No custom fields. Name, email, and phone are always included.</p>
                    <button
                      type="button"
                      onClick={onAddField}
                      className="mt-3 text-sm text-primary-600 hover:text-primary-700 py-2 px-2 touch-target"
                    >
                      Add your first field
                    </button>
                  </div>
                )}
              </div>
            </div>

        {/* Security & Limits */}
        <div className="space-y-4 pt-6 border-t">
          <h3 className="text-lg font-semibold text-gray-900">Security & Limits</h3>
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formFormData.rate_limit_enabled}
                onChange={(e) => onFormChange('rate_limit_enabled', e.target.checked)}
                className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Enable Rate Limiting</span>
            </label>
          </div>
          {formFormData.rate_limit_enabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Submissions Per Hour
              </label>
              <input
                type="number"
                value={formFormData.rate_limit_per_hour}
                onChange={(e) => onFormChange('rate_limit_per_hour', parseInt(e.target.value) || 10)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                min={1}
                max={1000}
              />
            </div>
          )}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formFormData.captcha_enabled}
                onChange={(e) => onFormChange('captcha_enabled', e.target.checked)}
                className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Enable CAPTCHA</span>
            </label>
          </div>
        </div>

        {/* Customization */}
        <div className="space-y-4 pt-6 border-t">
          <h3 className="text-lg font-semibold text-gray-900">Customization</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Thank You Message
            </label>
            <textarea
              value={formFormData.thank_you_message}
              onChange={(e) => onFormChange('thank_you_message', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Thank you! Your submission is being processed."
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Redirect URL (optional)
            </label>
            <input
              type="url"
              value={formFormData.redirect_url}
              onChange={(e) => onFormChange('redirect_url', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="https://example.com/thank-you"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom CSS (optional)
            </label>
            <textarea
              value={formFormData.custom_css}
              onChange={(e) => onFormChange('custom_css', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
              placeholder="/* Custom CSS styles */"
              rows={6}
            />
          </div>
        </div>

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
              disabled={submitting}
              className="flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-target"
            >
              <FiSave className="w-5 h-5 mr-2" />
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        {/* Form Preview - Always visible */}
        <div className="bg-white rounded-lg shadow p-6 sticky top-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Live Preview</h3>
            <span className="text-xs text-gray-500">Updates in real-time</span>
          </div>
          <div className="border border-gray-200 rounded-lg overflow-auto max-h-[800px]">
            <FormPreview formFormData={formFormData} />
          </div>
        </div>
      </div>
   
  )
}

