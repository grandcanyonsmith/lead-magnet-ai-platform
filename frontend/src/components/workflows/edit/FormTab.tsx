'use client'

import {
  FiChevronDown,
  FiChevronUp,
  FiEye,
  FiInfo,
  FiMinus,
  FiPlus,
  FiSave,
  FiSettings,
  FiShield,
} from 'react-icons/fi'
import { SectionCard } from '@/components/ui/SectionCard'
import { FormFormData, FormField } from '@/hooks/useFormEdit'
import { getFieldTypeIcon } from '@/utils/formUtils'
import { buildPublicFormUrl } from '@/utils/url'

interface FormTabProps {
  formFormData: FormFormData
  workflowName: string
  submitting: boolean
  customDomain?: string
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
  const customFields = formFormData.form_fields_schema.fields

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <form onSubmit={onSubmit} className="order-2 space-y-6 lg:order-1">
        <SectionCard
          title="Form basics"
          description="Keep your form easy to identify and simple to share."
          icon={<FiInfo className="h-5 w-5" aria-hidden="true" />}
        >
          <div className="rounded-2xl border border-blue-100/80 bg-blue-50/70 px-4 py-3 text-sm text-blue-900">
            <p>
              <strong className="font-semibold">Heads up:</strong> this form name automatically mirrors your lead magnet name. Name, email, and phone fields are always included for you.
            </p>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-900">
                Form name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formFormData.form_name}
                onChange={(e) => onFormChange('form_name', e.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="Lead Magnet Form"
                maxLength={200}
                required
              />
              <p className="mt-2 text-xs text-gray-500">Automatically set to “{workflowName} Form”.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900">
                Public URL slug <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formFormData.public_slug}
                onChange={(e) =>
                  onFormChange(
                    'public_slug',
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
                  )
                }
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 font-mono text-sm lowercase shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="lead-magnet-form"
                pattern="[a-z0-9-]+"
                required
              />
              <p className="mt-2 text-xs text-gray-500">
                Only lowercase letters, numbers, and hyphens are allowed.
              </p>
              {formFormData.public_slug && (
                <p className="mt-1 text-xs font-medium text-primary-600">
                  Form URL: {buildPublicFormUrl(formFormData.public_slug, customDomain)}
                </p>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Form fields"
          description="Collect only the information that matters."
          icon={<FiSettings className="h-5 w-5" aria-hidden="true" />}
          actions={
            <button
              type="button"
              onClick={onAddField}
              className="inline-flex items-center gap-2 rounded-full border border-primary-600 px-4 py-2 text-sm font-semibold text-primary-700 transition hover:bg-primary-600 hover:text-white"
            >
              <FiPlus className="h-4 w-4" aria-hidden="true" />
              Add field
            </button>
          }
        >
          <p className="text-sm text-gray-500">
            Name, email, and phone are already in place. Add custom fields below or reorder them to fine tune your lead capture.
          </p>

          <div className="mt-4 space-y-3">
            {customFields.map((field, index) => (
              <div
                key={field.field_id || index}
                className="rounded-2xl border border-gray-100 bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 text-xs font-semibold text-gray-500">
                      #{index + 1}
                    </span>
                    <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      {getFieldTypeIcon(field.field_type)}
                      <span className="capitalize">{field.field_type}</span>
                    </div>
                    {field.required && (
                      <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                        Required
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onMoveFieldUp(index)}
                      disabled={index === 0}
                      className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:text-gray-900 disabled:cursor-not-allowed disabled:text-gray-300"
                      title="Move field up"
                      aria-label={`Move ${field.label || 'field'} up`}
                    >
                      <FiChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveFieldDown(index)}
                      disabled={index === customFields.length - 1}
                      className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:text-gray-900 disabled:cursor-not-allowed disabled:text-gray-300"
                      title="Move field down"
                      aria-label={`Move ${field.label || 'field'} down`}
                    >
                      <FiChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveField(index)}
                      className="ml-1 rounded-full border border-red-100 p-2 text-red-600 transition hover:bg-red-50"
                      title="Remove field"
                      aria-label={`Remove ${field.label || 'field'}`}
                    >
                      <FiMinus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Field type
                    </label>
                    <select
                      value={field.field_type}
                      onChange={(e) => onFieldChange(index, 'field_type', e.target.value)}
                      className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
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
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Label
                    </label>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => onFieldChange(index, 'label', e.target.value)}
                      className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                      placeholder="Field label"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Placeholder
                  </label>
                  <input
                    type="text"
                    value={field.placeholder || ''}
                    onChange={(e) => onFieldChange(index, 'placeholder', e.target.value)}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    placeholder="Placeholder text"
                  />
                </div>

                {field.field_type === 'select' && (
                  <div className="mt-3">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Options (comma separated)
                    </label>
                    <input
                      type="text"
                      value={field.options?.join(', ') || ''}
                      onChange={(e) =>
                        onFieldChange(
                          index,
                          'options',
                          e.target.value
                            .split(',')
                            .map((option) => option.trim())
                            .filter((option) => option)
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                      placeholder="Option 1, Option 2, Option 3"
                    />
                  </div>
                )}

                <label className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => onFieldChange(index, 'required', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  Required field
                </label>
              </div>
            ))}

            {customFields.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 px-4 py-10 text-center">
                <p className="text-sm text-gray-600">
                  No custom fields yet. Your default contact fields are ready to go.
                </p>
                <button
                  type="button"
                  onClick={onAddField}
                  className="mt-4 text-sm font-semibold text-primary-600 transition hover:text-primary-800"
                >
                  Add your first field
                </button>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Security & limits"
          description="Prevent spam and control submission flow."
          icon={<FiShield className="h-5 w-5" aria-hidden="true" />}
        >
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formFormData.rate_limit_enabled}
                onChange={(e) => onFormChange('rate_limit_enabled', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-900">Enable rate limiting</span>
            </label>

            {formFormData.rate_limit_enabled && (
              <div>
                <label className="block text-sm font-medium text-gray-900">
                  Submissions per hour
                </label>
                <input
                  type="number"
                  value={formFormData.rate_limit_per_hour}
                  onChange={(e) =>
                    onFormChange('rate_limit_per_hour', parseInt(e.target.value, 10) || 10)
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  min={1}
                  max={1000}
                />
              </div>
            )}

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formFormData.captcha_enabled}
                onChange={(e) => onFormChange('captcha_enabled', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-900">Enable CAPTCHA</span>
            </label>
          </div>
        </SectionCard>

        <SectionCard
          title="Confirmation & styling"
          description="Polish the experience after someone submits the form."
          icon={<FiSettings className="h-5 w-5" aria-hidden="true" />}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900">
                Thank you message
              </label>
              <textarea
                value={formFormData.thank_you_message}
                onChange={(e) => onFormChange('thank_you_message', e.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="Thank you! Your submission is being processed."
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900">
                Redirect URL (optional)
              </label>
              <input
                type="url"
                value={formFormData.redirect_url}
                onChange={(e) => onFormChange('redirect_url', e.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="https://example.com/thank-you"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900">
                Custom CSS (optional)
              </label>
              <textarea
                value={formFormData.custom_css}
                onChange={(e) => onFormChange('custom_css', e.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 font-mono text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="/* Custom CSS styles */"
                rows={6}
              />
            </div>
          </div>
        </SectionCard>

        <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <FiSave className="h-4 w-4" aria-hidden="true" />
            {submitting ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>

      <div className="order-1 lg:order-2">
        <div className="sticky top-6">
          <SectionCard
            title="Live preview"
            description="See exactly what visitors will experience."
            icon={<FiEye className="h-5 w-5" aria-hidden="true" />}
            stickyHeader
          >
            <div className="rounded-2xl border border-gray-100 bg-white">
              <FormPreview formFormData={formFormData} />
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
