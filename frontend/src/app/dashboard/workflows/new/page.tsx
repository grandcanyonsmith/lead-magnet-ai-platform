'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { FiArrowLeft, FiSave, FiZap } from 'react-icons/fi'

export default function NewWorkflowPage() {
  const router = useRouter()
  const [step, setStep] = useState<'prompt' | 'form'>('prompt')
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [generatedTemplateId, setGeneratedTemplateId] = useState<string | null>(null)
  
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
  })

  const [templateData, setTemplateData] = useState({
    template_name: '',
    template_description: '',
    html_content: '',
    placeholder_tags: [] as string[],
  })

  const handleGenerateWithAI = async () => {
    if (!prompt.trim()) {
      setError('Please describe what you want to build a lead magnet for')
      return
    }

    console.log('[Workflow Generation] Starting AI generation...', {
      prompt: prompt.trim(),
      timestamp: new Date().toISOString(),
    })

    setGenerating(true)
    setError(null)
    setGenerationStatus('Generating your lead magnet configuration...')

    try {
      const startTime = Date.now()
      const result = await api.generateWorkflowWithAI(prompt.trim(), 'gpt-5')
      const duration = Date.now() - startTime

      console.log('[Workflow Generation] Success!', {
        duration: `${duration}ms`,
        workflow: result.workflow,
        template: result.template,
        timestamp: new Date().toISOString(),
      })

      setGenerationStatus('Generation complete! Review and edit the fields below.')

      // Populate workflow fields
      setFormData(prev => ({
        ...prev,
        workflow_name: result.workflow.workflow_name || '',
        workflow_description: result.workflow.workflow_description || '',
        ai_instructions: result.workflow.research_instructions || '',
      }))

      // Populate template fields
      setTemplateData({
        template_name: result.template.template_name || '',
        template_description: result.template.template_description || '',
        html_content: result.template.html_content || '',
        placeholder_tags: result.template.placeholder_tags || [],
      })

      // Move to form step
      setStep('form')

      setTimeout(() => {
        setGenerationStatus(null)
      }, 3000)
    } catch (error: any) {
      console.error('[Workflow Generation] Failed:', error)
      setError(error.response?.data?.message || error.message || 'Failed to generate lead magnet with AI')
      setGenerationStatus(null)
    } finally {
      setGenerating(false)
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

    if (formData.html_enabled && !templateData.html_content.trim()) {
      setError('Template HTML content is required when HTML generation is enabled')
      return
    }

    setSubmitting(true)

    try {
      // First, create the template if HTML is enabled
      let templateId = formData.template_id
      if (formData.html_enabled && templateData.html_content.trim()) {
        if (!generatedTemplateId) {
          // Create new template
          const template = await api.createTemplate({
            template_name: templateData.template_name || 'Generated Template',
            template_description: templateData.template_description || '',
            html_content: templateData.html_content.trim(),
            placeholder_tags: templateData.placeholder_tags.length > 0 ? templateData.placeholder_tags : undefined,
            is_published: true,
          })
          templateId = template.template_id
          setGeneratedTemplateId(templateId)
        } else {
          // Update existing template
          await api.updateTemplate(generatedTemplateId, {
            template_name: templateData.template_name || 'Generated Template',
            template_description: templateData.template_description || '',
            html_content: templateData.html_content.trim(),
            placeholder_tags: templateData.placeholder_tags.length > 0 ? templateData.placeholder_tags : undefined,
            is_published: true,
          })
          templateId = generatedTemplateId
        }
      }

      // Then create the workflow
      await api.createWorkflow({
        workflow_name: formData.workflow_name.trim(),
        workflow_description: formData.workflow_description.trim() || undefined,
        ai_model: formData.ai_model,
        ai_instructions: formData.ai_instructions.trim(),
        rewrite_model: formData.rewrite_model,
        research_enabled: formData.research_enabled,
        html_enabled: formData.html_enabled,
        template_id: templateId || undefined,
        template_version: formData.template_version,
      })

      router.push('/dashboard/workflows')
    } catch (error: any) {
      console.error('Failed to create workflow:', error)
      setError(error.response?.data?.message || error.message || 'Failed to create workflow')
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleTemplateChange = (field: string, value: any) => {
    setTemplateData(prev => ({ ...prev, [field]: value }))
  }

  // Prompt Step
  if (step === 'prompt') {
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
          <h1 className="text-2xl font-bold text-gray-900">Create Lead Magnet</h1>
          <p className="text-gray-600">Describe what you want to build, and AI will generate everything for you</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
              <FiZap className={`w-5 h-5 mr-2 text-purple-600 ${generating ? 'animate-pulse' : ''}`} />
              What do you want to build?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Describe your lead magnet idea. AI will generate the name, description, research instructions, and template HTML for you.
            </p>
            
            <div className="space-y-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="e.g., A course idea validator that analyzes market demand, competition, target audience, and provides actionable recommendations for course creators..."
                rows={6}
                disabled={generating}
              />
              
              {generationStatus && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
                  <span className="text-sm text-blue-800 font-medium">{generationStatus}</span>
                </div>
              )}
              
              <button
                type="button"
                onClick={handleGenerateWithAI}
                disabled={generating || !prompt.trim()}
                className="flex items-center justify-center px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              >
                {generating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <FiZap className="w-5 h-5 mr-2" />
                    <span>Generate Lead Magnet</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Form Step - Show all generated fields
  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => setStep('prompt')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <FiArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Create Lead Magnet</h1>
        <p className="text-gray-600">Review and edit the generated configuration</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {generationStatus && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {generationStatus}
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
        {/* Workflow Fields */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900 border-b pb-2">Lead Magnet Configuration</h2>
          
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
              placeholder="Describe what this lead magnet does..."
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
                <option value="gpt-5">GPT-5</option>
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
                <option value="gpt-5">GPT-5</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Used for converting content to styled HTML
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.research_enabled}
                onChange={(e) => handleChange('research_enabled', e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Generate AI Research Report</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.html_enabled}
                onChange={(e) => handleChange('html_enabled', e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Generate Styled HTML</span>
            </label>
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
                rows={8}
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Tell the AI how to generate personalized research based on form submission data. Use [field_name] to reference form fields.
              </p>
            </div>
          )}
        </div>

        {/* Template Fields */}
        {formData.html_enabled && (
          <div className="space-y-6 pt-6 border-t">
            <h2 className="text-xl font-semibold text-gray-900 border-b pb-2">Template Configuration</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={templateData.template_name}
                onChange={(e) => handleTemplateChange('template_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Email Template"
                maxLength={200}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={templateData.template_description}
                onChange={(e) => handleTemplateChange('template_description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Describe what this template is used for..."
                rows={3}
                maxLength={1000}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                HTML Content <span className="text-red-500">*</span>
              </label>
              <textarea
                value={templateData.html_content}
                onChange={(e) => handleTemplateChange('html_content', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                placeholder="<!DOCTYPE html>..."
                rows={20}
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Use <code className="px-1 py-0.5 bg-gray-100 rounded">&#123;&#123;PLACEHOLDER_NAME&#125;&#125;</code> syntax for dynamic content.
              </p>
              {templateData.placeholder_tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="text-sm font-medium text-gray-700">Detected placeholders:</span>
                  {templateData.placeholder_tags.map((placeholder) => (
                    <span
                      key={placeholder}
                      className="px-2 py-1 bg-primary-50 text-primary-700 rounded text-xs font-mono"
                    >
                      {`{{${placeholder}}}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-4 pt-4 border-t">
          <button
            type="button"
            onClick={() => setStep('prompt')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiSave className="w-5 h-5 mr-2" />
            {submitting ? 'Creating...' : 'Create Lead Magnet'}
          </button>
        </div>
      </form>
    </div>
  )
}
