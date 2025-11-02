'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { FiArrowLeft, FiSave, FiZap } from 'react-icons/fi'

export default function NewTemplatePage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiDescription, setAiDescription] = useState('')
  const [detectedPlaceholders, setDetectedPlaceholders] = useState<string[]>([])
  
  const [formData, setFormData] = useState({
    template_name: '',
    template_description: '',
    html_content: '',
    is_published: false,
  })

  const extractPlaceholders = (html: string): string[] => {
    const regex = /\{\{([A-Z_]+)\}\}/g
    const matches = html.matchAll(regex)
    const placeholders = new Set<string>()
    for (const match of matches) {
      placeholders.add(match[1])
    }
    return Array.from(placeholders).sort()
  }

  const handleHtmlChange = (html: string) => {
    setFormData(prev => ({ ...prev, html_content: html }))
    const placeholders = extractPlaceholders(html)
    setDetectedPlaceholders(placeholders)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!formData.template_name.trim()) {
      setError('Template name is required')
      return
    }

    if (!formData.html_content.trim()) {
      setError('HTML content is required')
      return
    }

    setSubmitting(true)

    try {
      const placeholders = extractPlaceholders(formData.html_content)
      
      await api.createTemplate({
        template_name: formData.template_name.trim(),
        template_description: formData.template_description.trim() || undefined,
        html_content: formData.html_content.trim(),
        placeholder_tags: placeholders.length > 0 ? placeholders : undefined,
        is_published: formData.is_published,
      })

      router.push('/dashboard/templates')
    } catch (error: any) {
      console.error('Failed to create template:', error)
      setError(error.response?.data?.message || error.message || 'Failed to create template')
    } finally {
      setSubmitting(false)
    }
  }

  const handleGenerateWithAI = async () => {
    if (!aiDescription.trim()) {
      setError('Please describe what you want the template to look like')
      return
    }

    setGenerating(true)
    setError(null)

    try {
      const result = await api.generateTemplateWithAI(aiDescription.trim())
      
      setFormData({
        template_name: result.template_name || 'Generated Template',
        template_description: result.template_description || '',
        html_content: result.html_content || '',
        is_published: false,
      })
      
      const placeholders = result.placeholder_tags || []
      setDetectedPlaceholders(placeholders)
      
      // Clear the description after successful generation
      setAiDescription('')
    } catch (error: any) {
      console.error('Failed to generate template:', error)
      setError(error.response?.data?.message || error.message || 'Failed to generate template with AI')
    } finally {
      setGenerating(false)
    }
  }

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
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
        <h1 className="text-2xl font-bold text-gray-900">Create Template</h1>
        <p className="text-gray-600">Create a new HTML template for rendering lead magnet content</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* AI Generation Section */}
      <div className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
              <FiZap className="w-5 h-5 mr-2 text-purple-600" />
              Generate with AI
            </h3>
            <p className="text-sm text-gray-600">
              Describe what you want your template to look like, and AI will generate the name, description, and HTML for you.
            </p>
          </div>
        </div>
        
        <div className="space-y-4">
          <textarea
            value={aiDescription}
            onChange={(e) => setAiDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="e.g., A modern, professional email template for course idea validation reports with a clean header, content sections, and call-to-action buttons. Use a blue and white color scheme."
            rows={4}
            disabled={generating}
          />
          <button
            type="button"
            onClick={handleGenerateWithAI}
            disabled={generating || !aiDescription.trim()}
            className="flex items-center px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiZap className="w-5 h-5 mr-2" />
            {generating ? 'Generating...' : 'Generate Template'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Template Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.template_name}
            onChange={(e) => handleChange('template_name', e.target.value)}
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
            value={formData.template_description}
            onChange={(e) => handleChange('template_description', e.target.value)}
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
            value={formData.html_content}
            onChange={(e) => handleHtmlChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
            placeholder={`<!DOCTYPE html>
<html>
<head>
  <title>Lead Magnet</title>
</head>
<body>
  <h1>{{TITLE}}</h1>
  <div>{{CONTENT}}</div>
</body>
</html>`}
            rows={20}
            required
          />
          <div className="mt-2 space-y-2">
            <p className="text-sm text-gray-500">
              Use <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">&#123;&#123;PLACEHOLDER_NAME&#125;&#125;</code> syntax for dynamic content.
            </p>
            {detectedPlaceholders.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-sm font-medium text-gray-700">Detected placeholders:</span>
                {detectedPlaceholders.map((placeholder) => (
                  <span
                    key={placeholder}
                    className="px-2 py-1 bg-primary-50 text-primary-700 rounded text-xs font-mono"
                  >
                    {`{{${placeholder}}}`}
                  </span>
                ))}
              </div>
            )}
            {detectedPlaceholders.length === 0 && formData.html_content.trim() && (
              <p className="text-sm text-yellow-600">
                No placeholders detected. Use <code className="px-1 py-0.5 bg-yellow-100 rounded text-xs">&#123;&#123;PLACEHOLDER_NAME&#125;&#125;</code> format.
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.is_published}
              onChange={(e) => handleChange('is_published', e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700">Publish Template</span>
          </label>
          <p className="mt-1 text-sm text-gray-500 ml-6">
            Published templates can be used in workflows immediately
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
            disabled={submitting}
            className="flex items-center px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiSave className="w-5 h-5 mr-2" />
            {submitting ? 'Creating...' : 'Create Template'}
          </button>
        </div>
      </form>
    </div>
  )
}
