'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { FiArrowLeft, FiSave } from 'react-icons/fi'

export default function EditTemplatePage() {
  const router = useRouter()
  const params = useParams()
  const templateId = params?.id as string
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detectedPlaceholders, setDetectedPlaceholders] = useState<string[]>([])
  
  const [formData, setFormData] = useState({
    template_name: '',
    template_description: '',
    html_content: '',
    is_published: false,
  })

  useEffect(() => {
    if (templateId) {
      loadTemplate()
    }
  }, [templateId])

  const loadTemplate = async () => {
    try {
      const template = await api.getTemplate(templateId)
      setFormData({
        template_name: template.template_name || '',
        template_description: template.template_description || '',
        html_content: template.html_content || '',
        is_published: template.is_published || false,
      })
      
      // Extract placeholders from loaded HTML
      if (template.html_content) {
        const placeholders = extractPlaceholders(template.html_content)
        setDetectedPlaceholders(placeholders)
      }
    } catch (error: any) {
      console.error('Failed to load template:', error)
      setError(error.response?.data?.message || error.message || 'Failed to load template')
    } finally {
      setLoading(false)
    }
  }

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
      
      await api.updateTemplate(templateId, {
        template_name: formData.template_name.trim(),
        template_description: formData.template_description.trim() || undefined,
        html_content: formData.html_content.trim(),
        placeholder_tags: placeholders.length > 0 ? placeholders : undefined,
        is_published: formData.is_published,
      })

      router.push('/dashboard/templates')
    } catch (error: any) {
      console.error('Failed to update template:', error)
      setError(error.response?.data?.message || error.message || 'Failed to update template')
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
        <p className="text-gray-600">Loading template...</p>
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
        <h1 className="text-2xl font-bold text-gray-900">Edit Template</h1>
        <p className="text-gray-600">Update your HTML template</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

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
            {submitting ? 'Updating...' : 'Update Template'}
          </button>
        </div>
      </form>
    </div>
  )
}

