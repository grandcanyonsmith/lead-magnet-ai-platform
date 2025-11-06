'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { FiArrowLeft, FiSave, FiSettings, FiFileText } from 'react-icons/fi'

type Template = {
  template_id: string
  template_name?: string
  version?: number
}

type FormField = {
  field_id: string
  field_type: string
  label: string
  placeholder?: string
  required: boolean
  options?: string[]
}

export default function EditWorkflowPage() {
  const router = useRouter()
  const params = useParams()
  const workflowId = params?.id as string
  
  const [activeTab, setActiveTab] = useState<'workflow' | 'form'>('workflow')
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    workflow_name: '',
    workflow_description: '',
    ai_model: 'gpt-5',
    ai_instructions: '',
    rewrite_model: 'gpt-5',
    research_enabled: true,
    html_enabled: true,
    template_id: '',
    template_version: 0,
  })

  const [formFormData, setFormFormData] = useState({
    form_name: '',
    public_slug: '',
    form_fields_schema: {
      fields: [] as FormField[],
    },
    rate_limit_enabled: true,
    rate_limit_per_hour: 10,
    captcha_enabled: false,
    custom_css: '',
    thank_you_message: '',
    redirect_url: '',
  })

  const [formId, setFormId] = useState<string | null>(null)

  useEffect(() => {
    if (workflowId) {
      Promise.all([loadTemplates(), loadWorkflow()])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId])

  const loadTemplates = async (retryCount = 0) => {
    try {
      const data = await api.getTemplates()
      setTemplates(data.templates || [])
      setError(null)
    } catch (error: any) {
      console.error('Failed to load templates:', error)
      const status = error.response?.status
      const message = error.response?.data?.message || error.message
      
      if (status === 401) {
        setError('Authentication failed. Please try logging out and logging back in.')
      } else if (status === 403) {
        setError('You do not have permission to access templates.')
      } else if (retryCount < 2 && (status >= 500 || status === undefined)) {
        setTimeout(() => loadTemplates(retryCount + 1), 1000 * (retryCount + 1))
        return
      } else {
        setError(`Failed to load templates: ${message || 'Please refresh the page or try again later.'}`)
      }
    }
  }

  const loadWorkflow = async () => {
    try {
      const workflow = await api.getWorkflow(workflowId)
      setFormData({
        workflow_name: workflow.workflow_name || '',
        workflow_description: workflow.workflow_description || '',
        ai_model: workflow.ai_model || 'gpt-5',
        ai_instructions: workflow.ai_instructions || '',
        rewrite_model: workflow.rewrite_model || 'gpt-5',
        research_enabled: workflow.research_enabled !== undefined ? workflow.research_enabled : true,
        html_enabled: workflow.html_enabled !== undefined ? workflow.html_enabled : true,
        template_id: workflow.template_id || '',
        template_version: workflow.template_version || 0,
      })

      // Load form data if it exists
      if (workflow.form) {
        setFormId(workflow.form.form_id)
        setFormFormData({
          form_name: workflow.form.form_name || '',
          public_slug: workflow.form.public_slug || '',
          form_fields_schema: workflow.form.form_fields_schema || { fields: [] },
          rate_limit_enabled: workflow.form.rate_limit_enabled !== undefined ? workflow.form.rate_limit_enabled : true,
          rate_limit_per_hour: workflow.form.rate_limit_per_hour || 10,
          captcha_enabled: workflow.form.captcha_enabled || false,
          custom_css: workflow.form.custom_css || '',
          thank_you_message: workflow.form.thank_you_message || '',
          redirect_url: workflow.form.redirect_url || '',
        })
      }
    } catch (error: any) {
      console.error('Failed to load workflow:', error)
      setError(error.response?.data?.message || error.message || 'Failed to load workflow')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!formData.workflow_name.trim()) {
      setError('Lead magnet name is required')
      return
    }

    if (formData.research_enabled && !formData.ai_instructions.trim()) {
      setError('Research instructions are required when research is enabled')
      return
    }

    if (formData.html_enabled && !formData.template_id) {
      setError('Template is required when HTML generation is enabled')
      return
    }

    setSubmitting(true)

    try {
      // Update workflow
      await api.updateWorkflow(workflowId, {
        workflow_name: formData.workflow_name.trim(),
        workflow_description: formData.workflow_description.trim() || undefined,
        ai_model: formData.ai_model,
        ai_instructions: formData.ai_instructions.trim(),
        rewrite_model: formData.rewrite_model,
        research_enabled: formData.research_enabled,
        html_enabled: formData.html_enabled,
        template_id: formData.template_id || undefined,
        template_version: formData.template_version,
      })

      // Update form if it exists
      if (formId) {
        await api.updateForm(formId, {
          form_name: formFormData.form_name.trim(),
          public_slug: formFormData.public_slug.trim(),
          form_fields_schema: formFormData.form_fields_schema,
          rate_limit_enabled: formFormData.rate_limit_enabled,
          rate_limit_per_hour: formFormData.rate_limit_per_hour,
          captcha_enabled: formFormData.captcha_enabled,
          custom_css: formFormData.custom_css.trim() || undefined,
          thank_you_message: formFormData.thank_you_message.trim() || undefined,
          redirect_url: formFormData.redirect_url.trim() || undefined,
        })
      }

      router.push('/dashboard/workflows')
    } catch (error: any) {
      console.error('Failed to update:', error)
      setError(error.response?.data?.message || error.message || 'Failed to update')
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleFormChange = (field: string, value: any) => {
    setFormFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleFieldChange = (index: number, field: string, value: any) => {
    setFormFormData(prev => {
      const newFields = [...prev.form_fields_schema.fields]
      newFields[index] = { ...newFields[index], [field]: value }
      return {
        ...prev,
        form_fields_schema: {
          ...prev.form_fields_schema,
          fields: newFields,
        },
      }
    })
  }

  const addField = () => {
    setFormFormData(prev => ({
      ...prev,
      form_fields_schema: {
        ...prev.form_fields_schema,
        fields: [
          ...prev.form_fields_schema.fields,
          {
            field_id: `field_${Date.now()}`,
            field_type: 'text',
            label: '',
            placeholder: '',
            required: false,
          },
        ],
      },
    }))
  }

  const removeField = (index: number) => {
    setFormFormData(prev => {
      const newFields = [...prev.form_fields_schema.fields]
      newFields.splice(index, 1)
      return {
        ...prev,
        form_fields_schema: {
          ...prev.form_fields_schema,
          fields: newFields,
        },
      }
    })
  }

  // Update template_version when template_id changes
  useEffect(() => {
    const selectedTemplate = templates.find(t => t.template_id === formData.template_id)
    if (selectedTemplate && selectedTemplate.version) {
      setFormData(prev => ({ ...prev, template_version: selectedTemplate.version || 0 }))
    }
  }, [formData.template_id, templates])

  // Auto-update form name when workflow name changes
  useEffect(() => {
    if (formData.workflow_name && formFormData.form_name === `${formData.workflow_name} Form` || !formFormData.form_name) {
      setFormFormData(prev => ({
        ...prev,
        form_name: `${formData.workflow_name} Form`,
      }))
    }
  }, [formData.workflow_name])

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Loading workflow...</p>
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
        <h1 className="text-2xl font-bold text-gray-900">Edit Lead Magnet</h1>
        <p className="text-gray-600">Update your AI lead magnet and form configuration</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('workflow')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'workflow'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FiSettings className="inline w-4 h-4 mr-2" />
            Lead Magnet Settings
          </button>
          <button
            onClick={() => setActiveTab('form')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'form'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FiFileText className="inline w-4 h-4 mr-2" />
            Form Settings
          </button>
        </nav>
      </div>

      {activeTab === 'workflow' && (
        <>
          {/* Info Box */}
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Processing Modes</h3>
            <p className="text-sm text-blue-800 mb-2">
              Choose how your lead magnet is generated:
            </p>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li><strong>Research + HTML:</strong> AI generates personalized research, then converts it to styled HTML</li>
              <li><strong>Research Only:</strong> AI generates research report (markdown format)</li>
              <li><strong>HTML Only:</strong> AI generates styled HTML directly from form submission</li>
              <li><strong>Text Only:</strong> Simple text output from form submission</li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lead Magnet Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.workflow_name}
                onChange={(e) => handleChange('workflow_name', e.target.value)}
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
                onChange={(e) => handleChange('workflow_description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Describe what this lead magnet does (e.g., validates course ideas and provides market research)..."
                rows={3}
                maxLength={1000}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Research Model <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs text-gray-500" title="Used for generating personalized research">
                    ℹ️
                  </span>
                </label>
                <select
                  value={formData.ai_model}
                  onChange={(e) => handleChange('ai_model', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                  disabled={!formData.research_enabled}
                >
                  <option value="gpt-5">GPT-5</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Used for generating personalized research
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Styling Model
                  <span className="ml-2 text-xs text-gray-500" title="Used for converting content to styled HTML">
                    ℹ️
                  </span>
                </label>
                <select
                  value={formData.rewrite_model}
                  onChange={(e) => handleChange('rewrite_model', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={!formData.html_enabled}
                >
                  <option value="gpt-5">GPT-5</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Used for converting content to styled HTML
                </p>
              </div>
            </div>

            {formData.research_enabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Research Instructions <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.ai_instructions}
                  onChange={(e) => handleChange('ai_instructions', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                  placeholder="Example: Generate a personalized market research report for [course idea]. Analyze market demand, competition, target audience, and provide actionable recommendations..."
                  rows={6}
                  required={formData.research_enabled}
                />
                <p className="mt-1 text-sm text-gray-500">
                  Tell the AI how to generate personalized research based on form submission data. Use [field_name] to reference form fields.
                </p>
              </div>
            )}

            <div className="border-t pt-6 space-y-4">
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.research_enabled}
                    onChange={(e) => handleChange('research_enabled', e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Generate AI Research Report</span>
                </label>
                <p className="mt-1 text-sm text-gray-500 ml-6">
                  Generate personalized research first (stored as report.md for fact-checking/reference). This makes your lead magnet 10x more valuable.
                </p>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.html_enabled}
                    onChange={(e) => handleChange('html_enabled', e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Generate Styled HTML</span>
                </label>
                <p className="mt-1 text-sm text-gray-500 ml-6">
                  Convert content to beautifully styled HTML matching your template. Most lead magnets use this.
                </p>
              </div>
            </div>

            {formData.html_enabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template <span className="text-red-500">*</span>
                </label>
                {templates.length === 0 && !loading ? (
                  <div className="text-sm text-gray-500 mb-2">
                    No templates available. <a href="/dashboard/templates/new" className="text-primary-600 hover:text-primary-900">Create one first</a>.
                  </div>
                ) : (
                  <select
                    value={formData.template_id}
                    onChange={(e) => handleChange('template_id', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required={formData.html_enabled}
                  >
                    <option value="">Select a template...</option>
                    {templates.map((template) => (
                      <option key={template.template_id} value={template.template_id}>
                        {template.template_name || template.template_id}
                        {template.version ? ` (v${template.version})` : ''}
                      </option>
                    ))}
                  </select>
                )}
                <p className="mt-1 text-sm text-gray-500">
                  Select the HTML template that will style your lead magnet
                </p>
              </div>
            )}

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
                disabled={submitting || (formData.html_enabled && !formData.template_id) || (formData.research_enabled && !formData.ai_instructions.trim())}
                className="flex items-center px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiSave className="w-5 h-5 mr-2" />
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </>
      )}

      {activeTab === 'form' && formId && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> The form name is automatically synced with the lead magnet name. Name, email, and phone fields are always included and cannot be removed.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Form Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formFormData.form_name}
              onChange={(e) => handleFormChange('form_name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Lead Magnet Form"
              maxLength={200}
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              This is automatically set to &quot;{formData.workflow_name} Form&quot;
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Public URL Slug <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formFormData.public_slug}
              onChange={(e) => handleFormChange('public_slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
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

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Form Fields
              </label>
              <button
                type="button"
                onClick={addField}
                className="text-sm text-primary-600 hover:text-primary-900"
              >
                + Add Field
              </button>
            </div>
            <div className="space-y-4">
              {formFormData.form_fields_schema.fields.map((field, index) => (
                <div key={field.field_id || index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Field Type</label>
                      <select
                        value={field.field_type}
                        onChange={(e) => handleFieldChange(index, 'field_type', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                        onChange={(e) => handleFieldChange(index, 'label', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Field Label"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Placeholder</label>
                    <input
                      type="text"
                      value={field.placeholder || ''}
                      onChange={(e) => handleFieldChange(index, 'placeholder', e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Placeholder text"
                    />
                  </div>
                  {field.field_type === 'select' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Options (comma-separated)</label>
                      <input
                        type="text"
                        value={field.options?.join(', ') || ''}
                        onChange={(e) => handleFieldChange(index, 'options', e.target.value.split(',').map(o => o.trim()).filter(o => o))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Option 1, Option 2, Option 3"
                      />
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => handleFieldChange(index, 'required', e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-xs text-gray-700">Required</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => removeField(index)}
                      className="text-xs text-red-600 hover:text-red-900"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              {formFormData.form_fields_schema.fields.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No custom fields. Name, email, and phone are always included.</p>
              )}
            </div>
          </div>

          <div className="border-t pt-6 space-y-4">
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formFormData.rate_limit_enabled}
                  onChange={(e) => handleFormChange('rate_limit_enabled', e.target.checked)}
                  className="mr-2"
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
                  onChange={(e) => handleFormChange('rate_limit_per_hour', parseInt(e.target.value) || 10)}
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
                  onChange={(e) => handleFormChange('captcha_enabled', e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Enable CAPTCHA</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Thank You Message
            </label>
            <textarea
              value={formFormData.thank_you_message}
              onChange={(e) => handleFormChange('thank_you_message', e.target.value)}
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
              onChange={(e) => handleFormChange('redirect_url', e.target.value)}
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
              onChange={(e) => handleFormChange('custom_css', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
              placeholder="/* Custom CSS styles */"
              rows={6}
            />
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
              disabled={submitting}
              className="flex items-center px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiSave className="w-5 h-5 mr-2" />
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'form' && !formId && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600 mb-4">No form found for this lead magnet.</p>
          <p className="text-sm text-gray-500">Forms are automatically created when you create a lead magnet.</p>
        </div>
      )}
    </div>
  )
}

