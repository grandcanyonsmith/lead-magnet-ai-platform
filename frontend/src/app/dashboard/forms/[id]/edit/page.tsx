'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { FiArrowLeft, FiSave, FiPlus, FiTrash2 } from 'react-icons/fi'

type Workflow = {
  workflow_id: string
  workflow_name?: string
}

type FormField = {
  field_id: string
  field_type: 'text' | 'textarea' | 'email' | 'tel' | 'number' | 'select' | 'checkbox'
  label: string
  placeholder?: string
  required: boolean
  validation_regex?: string
  max_length?: number
  options?: string[]
}

export default function EditFormPage() {
  const router = useRouter()
  const params = useParams()
  const formId = params?.id as string
  
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    workflow_id: '',
    form_name: '',
    public_slug: '',
    form_fields_schema: {
      fields: [] as FormField[]
    },
    rate_limit_enabled: true,
    rate_limit_per_hour: 10,
    captcha_enabled: false,
    custom_css: '',
    thank_you_message: '',
    redirect_url: '',
  })

  useEffect(() => {
    if (formId) {
      Promise.all([loadForm(), loadWorkflows()])
    }
  }, [formId])

  const loadForm = async () => {
    try {
      const data = await api.getForm(formId)
      setFormData({
        workflow_id: data.workflow_id || '',
        form_name: data.form_name || '',
        public_slug: data.public_slug || '',
        form_fields_schema: data.form_fields_schema || { fields: [] },
        rate_limit_enabled: data.rate_limit_enabled ?? true,
        rate_limit_per_hour: data.rate_limit_per_hour || 10,
        captcha_enabled: data.captcha_enabled ?? false,
        custom_css: data.custom_css || '',
        thank_you_message: data.thank_you_message || '',
        redirect_url: data.redirect_url || '',
      })
    } catch (error: any) {
      console.error('Failed to load form:', error)
      setError(error.response?.data?.message || error.message || 'Failed to load form')
    } finally {
      setLoading(false)
    }
  }

  const loadWorkflows = async (retryCount = 0) => {
    try {
      const data = await api.getWorkflows()
      setWorkflows(data.workflows || [])
    } catch (error: any) {
      console.error('Failed to load workflows:', error)
      const status = error.response?.status
      
      if (status === 401) {
        setError('Authentication failed. Please try logging out and logging back in.')
      } else if (status === 403) {
        setError('You do not have permission to access workflows.')
      } else if (retryCount < 2 && (status >= 500 || status === undefined)) {
        setTimeout(() => loadWorkflows(retryCount + 1), 1000 * (retryCount + 1))
        return
      }
    }
  }

  const addField = () => {
    const newField: FormField = {
      field_id: `field_${Date.now()}`,
      field_type: 'text',
      label: '',
      required: false,
    }
    setFormData(prev => ({
      ...prev,
      form_fields_schema: {
        fields: [...prev.form_fields_schema.fields, newField]
      }
    }))
  }

  const removeField = (index: number) => {
    setFormData(prev => ({
      ...prev,
      form_fields_schema: {
        fields: prev.form_fields_schema.fields.filter((_, i) => i !== index)
      }
    }))
  }

  const updateField = (index: number, updates: Partial<FormField>) => {
    setFormData(prev => {
      const newFields = [...prev.form_fields_schema.fields]
      newFields[index] = { ...newFields[index], ...updates }
      return {
        ...prev,
        form_fields_schema: {
          fields: newFields
        }
      }
    })
  }

  const validateSlug = (slug: string): boolean => {
    return /^[a-z0-9-]+$/.test(slug)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!formData.workflow_id) {
      setError('Workflow is required')
      return
    }

    if (!formData.form_name.trim()) {
      setError('Form name is required')
      return
    }

    if (!formData.public_slug.trim()) {
      setError('Public slug is required')
      return
    }

    if (!validateSlug(formData.public_slug)) {
      setError('Public slug must contain only lowercase letters, numbers, and hyphens')
      return
    }

    if (formData.form_fields_schema.fields.length === 0) {
      setError('At least one form field is required')
      return
    }

    // Validate each field
    for (let i = 0; i < formData.form_fields_schema.fields.length; i++) {
      const field = formData.form_fields_schema.fields[i]
      if (!field.field_id.trim()) {
        setError(`Field ${i + 1}: Field ID is required`)
        return
      }
      if (!field.label.trim()) {
        setError(`Field ${i + 1}: Label is required`)
        return
      }
      if (field.field_type === 'select' && (!field.options || field.options.length === 0)) {
        setError(`Field ${i + 1}: Select fields must have at least one option`)
        return
      }
    }

    setSubmitting(true)

    try {
      await api.updateForm(formId, {
        workflow_id: formData.workflow_id,
        form_name: formData.form_name.trim(),
        public_slug: formData.public_slug.trim(),
        form_fields_schema: {
          fields: formData.form_fields_schema.fields.map(field => ({
            field_id: field.field_id.trim(),
            field_type: field.field_type,
            label: field.label.trim(),
            placeholder: field.placeholder?.trim() || undefined,
            required: field.required,
            validation_regex: field.validation_regex?.trim() || undefined,
            max_length: field.max_length || undefined,
            options: field.options && field.options.length > 0 ? field.options.filter(o => o.trim()) : undefined,
          }))
        },
        rate_limit_enabled: formData.rate_limit_enabled,
        rate_limit_per_hour: formData.rate_limit_per_hour,
        captcha_enabled: formData.captcha_enabled,
        custom_css: formData.custom_css.trim() || undefined,
        thank_you_message: formData.thank_you_message.trim() || undefined,
        redirect_url: formData.redirect_url.trim() || undefined,
      })

      router.push('/dashboard/forms')
    } catch (error: any) {
      console.error('Failed to update form:', error)
      setError(error.response?.data?.message || error.message || 'Failed to update form')
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Loading form...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <FiArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Form</h1>
        <p className="text-gray-600">Update your lead capture form</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Workflow <span className="text-red-500">*</span>
            </label>
            {workflows.length === 0 && !loading ? (
              <div className="text-sm text-gray-500 mb-2">
                No workflows available. <a href="/dashboard/workflows/new" className="text-primary-600 hover:text-primary-900">Create one first</a>.
              </div>
            ) : (
              <select
                value={formData.workflow_id}
                onChange={(e) => handleChange('workflow_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="">Select a workflow...</option>
                {workflows.map((workflow) => (
                  <option key={workflow.workflow_id} value={workflow.workflow_id}>
                    {workflow.workflow_name || workflow.workflow_id}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Form Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.form_name}
              onChange={(e) => handleChange('form_name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Contact Form"
              maxLength={200}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Public Slug <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.public_slug}
            onChange={(e) => handleChange('public_slug', e.target.value.toLowerCase())}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
            placeholder="contact-form"
            pattern="[a-z0-9-]+"
            required
          />
          <p className="mt-1 text-sm text-gray-500">
            URL-friendly identifier (lowercase letters, numbers, and hyphens only)
          </p>
        </div>

        <div className="border-t pt-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Form Fields</h2>
              <p className="text-sm text-gray-500">Configure the fields users will fill out</p>
            </div>
            <button
              type="button"
              onClick={addField}
              className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <FiPlus className="w-4 h-4 mr-2" />
              Add Field
            </button>
          </div>

          {formData.form_fields_schema.fields.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-500 mb-4">No fields added yet</p>
              <button
                type="button"
                onClick={addField}
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <FiPlus className="w-4 h-4 mr-2" />
                Add First Field
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {formData.form_fields_schema.fields.map((field, index) => (
                <div key={field.field_id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Field ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={field.field_id}
                        onChange={(e) => updateField(index, { field_id: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                        placeholder="field_name"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Field Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={field.field_type}
                        onChange={(e) => updateField(index, { field_type: e.target.value as FormField['field_type'] })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                        required
                      >
                        <option value="text">Text</option>
                        <option value="textarea">Textarea</option>
                        <option value="email">Email</option>
                        <option value="tel">Phone</option>
                        <option value="number">Number</option>
                        <option value="select">Select</option>
                        <option value="checkbox">Checkbox</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Label <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => updateField(index, { label: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Full Name"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Placeholder
                      </label>
                      <input
                        type="text"
                        value={field.placeholder || ''}
                        onChange={(e) => updateField(index, { placeholder: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Enter your name"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => updateField(index, { required: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-xs font-medium text-gray-700">Required</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Max Length
                      </label>
                      <input
                        type="number"
                        value={field.max_length || ''}
                        onChange={(e) => updateField(index, { max_length: e.target.value ? parseInt(e.target.value) : undefined })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="255"
                        min="1"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Validation Regex
                      </label>
                      <input
                        type="text"
                        value={field.validation_regex || ''}
                        onChange={(e) => updateField(index, { validation_regex: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                        placeholder="^[A-Za-z]+$"
                      />
                    </div>
                  </div>

                  {field.field_type === 'select' && (
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Options <span className="text-red-500">*</span> (one per line)
                      </label>
                      <textarea
                        value={field.options?.join('\n') || ''}
                        onChange={(e) => {
                          const options = e.target.value.split('\n').filter(o => o.trim())
                          updateField(index, { options: options.length > 0 ? options : undefined })
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                        rows={3}
                        placeholder="Option 1&#10;Option 2&#10;Option 3"
                        required={field.field_type === 'select'}
                      />
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeField(index)}
                      className="flex items-center px-3 py-1 text-sm text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors"
                    >
                      <FiTrash2 className="w-4 h-4 mr-1" />
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-6">
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.rate_limit_enabled}
                onChange={(e) => handleChange('rate_limit_enabled', e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Enable Rate Limiting</span>
            </label>
          </div>

          {formData.rate_limit_enabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rate Limit (per hour)
              </label>
              <input
                type="number"
                value={formData.rate_limit_per_hour}
                onChange={(e) => handleChange('rate_limit_per_hour', parseInt(e.target.value) || 10)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                min="1"
              />
            </div>
          )}
        </div>

        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.captcha_enabled}
              onChange={(e) => handleChange('captcha_enabled', e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700">Enable CAPTCHA</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Thank You Message
          </label>
          <textarea
            value={formData.thank_you_message}
            onChange={(e) => handleChange('thank_you_message', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Thank you! Your submission has been received."
            rows={2}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Redirect URL
          </label>
          <input
            type="url"
            value={formData.redirect_url}
            onChange={(e) => handleChange('redirect_url', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="https://example.com/thank-you"
          />
          <p className="mt-1 text-sm text-gray-500">
            Optional URL to redirect users after submission
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Custom CSS
          </label>
          <textarea
            value={formData.custom_css}
            onChange={(e) => handleChange('custom_css', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
            placeholder=".form-field { ... }"
            rows={6}
          />
          <p className="mt-1 text-sm text-gray-500">
            Optional CSS to customize the form appearance
          </p>
        </div>

        <div className="flex justify-end space-x-4 pt-4 border-t">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !formData.workflow_id || workflows.length === 0 || formData.form_fields_schema.fields.length === 0}
            className="flex items-center px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiSave className="w-5 h-5 mr-2" />
            {submitting ? 'Updating...' : 'Update Form'}
          </button>
        </div>
      </form>
    </div>
  )
}

