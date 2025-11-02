'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { FiArrowLeft, FiSave } from 'react-icons/fi'

type Template = {
  template_id: string
  template_name?: string
  version?: number
}

export default function EditWorkflowPage() {
  const router = useRouter()
  const params = useParams()
  const workflowId = params?.id as string
  
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    workflow_name: '',
    workflow_description: '',
    ai_model: 'gpt-4o',
    ai_instructions: '',
    rewrite_model: 'gpt-4o',
    research_enabled: true,
    html_enabled: true,
    template_id: '',
    template_version: 0,
    delivery_webhook_url: '',
    delivery_phone: '',
  })

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
        ai_model: workflow.ai_model || 'gpt-4o',
        ai_instructions: workflow.ai_instructions || '',
        rewrite_model: workflow.rewrite_model || 'gpt-4o',
        research_enabled: workflow.research_enabled !== undefined ? workflow.research_enabled : true,
        html_enabled: workflow.html_enabled !== undefined ? workflow.html_enabled : true,
        template_id: workflow.template_id || '',
        template_version: workflow.template_version || 0,
        delivery_webhook_url: workflow.delivery_webhook_url || '',
        delivery_phone: workflow.delivery_phone || '',
      })
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
        delivery_webhook_url: formData.delivery_webhook_url.trim() || undefined,
        delivery_phone: formData.delivery_phone.trim() || undefined,
      })

      router.push('/dashboard/workflows')
    } catch (error: any) {
      console.error('Failed to update workflow:', error)
      setError(error.response?.data?.message || error.message || 'Failed to update workflow')
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Update template_version when template_id changes
  useEffect(() => {
    const selectedTemplate = templates.find(t => t.template_id === formData.template_id)
    if (selectedTemplate && selectedTemplate.version) {
      setFormData(prev => ({ ...prev, template_version: selectedTemplate.version || 0 }))
    }
  }, [formData.template_id, templates])

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
        <p className="text-gray-600">Update your AI lead magnet configuration</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

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

        <div className="border-t pt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Delivery Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GHL Webhook URL
                <span className="ml-2 text-xs text-gray-500" title="Your GoHighLevel webhook endpoint for SMS/Email delivery">
                  ℹ️
                </span>
              </label>
              <input
                type="url"
                value={formData.delivery_webhook_url}
                onChange={(e) => handleChange('delivery_webhook_url', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="https://api.gohighlevel.com/webhook/..."
              />
              <p className="mt-1 text-sm text-gray-500">
                Your GoHighLevel webhook endpoint for SMS/Email delivery
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lead Phone Number
              </label>
              <input
                type="tel"
                value={formData.delivery_phone}
                onChange={(e) => handleChange('delivery_phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="+1234567890"
              />
              <p className="mt-1 text-sm text-gray-500">
                Phone number field name from your form (e.g., &quot;phone&quot; or &quot;phone_number&quot;)
              </p>
            </div>
          </div>
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
            disabled={submitting || (formData.html_enabled && !formData.template_id) || (formData.research_enabled && !formData.ai_instructions.trim())}
            className="flex items-center px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiSave className="w-5 h-5 mr-2" />
            {submitting ? 'Updating...' : 'Update Lead Magnet'}
          </button>
        </div>
      </form>
    </div>
  )
}

