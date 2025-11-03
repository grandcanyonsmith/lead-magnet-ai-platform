'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { FiArrowLeft, FiSave, FiZap, FiEdit2, FiEye } from 'react-icons/fi'

export default function NewTemplatePage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [refining, setRefining] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aiDescription, setAiDescription] = useState('')
  const [editPrompt, setEditPrompt] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  
  const [formData, setFormData] = useState({
    template_name: '',
    template_description: '',
    html_content: '',
    is_published: false,
  })

  const handleHtmlChange = (html: string) => {
    setFormData(prev => ({ ...prev, html_content: html }))
    // Auto-show preview when HTML is added
    if (html.trim() && !showPreview) {
      setShowPreview(true)
    }
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
      await api.createTemplate({
        template_name: formData.template_name.trim(),
        template_description: formData.template_description.trim() || undefined,
        html_content: formData.html_content.trim(),
        placeholder_tags: undefined,
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

    console.log('[Template Generation] Starting AI generation...', {
      description: aiDescription.trim(),
      timestamp: new Date().toISOString(),
    })

    setGenerating(true)
    setError(null)
    setGenerationStatus('Initializing AI generation...')

    try {
      const startTime = Date.now()
      console.log('[Template Generation] Calling API...')
      setGenerationStatus('Generating HTML template...')

      const result = await api.generateTemplateWithAI(aiDescription.trim(), 'gpt-5')
      
      const duration = Date.now() - startTime
      console.log('[Template Generation] Success!', {
        duration: `${duration}ms`,
        templateName: result.template_name,
        templateDescription: result.template_description,
        htmlLength: result.html_content?.length || 0,
        placeholderCount: result.placeholder_tags?.length || 0,
        placeholders: result.placeholder_tags,
        timestamp: new Date().toISOString(),
      })

      setGenerationStatus('Template generated successfully!')
      
      setFormData({
        template_name: result.template_name || 'Generated Template',
        template_description: result.template_description || '',
        html_content: result.html_content || '',
        is_published: false,
      })
      
      // Auto-show preview after generation
      setShowPreview(true)
      
      // Clear the description after successful generation
      setAiDescription('')
      
      // Clear status after a short delay
      setTimeout(() => {
        setGenerationStatus(null)
      }, 2000)
    } catch (error: any) {
      const errorDetails = {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        timestamp: new Date().toISOString(),
      }
      console.error('[Template Generation] Failed:', errorDetails)
      console.error('[Template Generation] Full error:', error)
      
      setError(error.response?.data?.message || error.message || 'Failed to generate template with AI')
      setGenerationStatus(null)
    } finally {
      setGenerating(false)
    }
  }

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (field === 'html_content') {
      handleHtmlChange(value)
    }
  }

  const handleRefine = async () => {
    if (!editPrompt.trim()) {
      setError('Please describe what changes you want to make')
      return
    }

    if (!formData.html_content.trim()) {
      setError('No HTML content to refine. Please generate a template first.')
      return
    }

    console.log('[Template Refinement] Starting refinement...', {
      editPrompt: editPrompt.trim(),
      currentHtmlLength: formData.html_content.length,
      timestamp: new Date().toISOString(),
    })

    setRefining(true)
    setError(null)
    setGenerationStatus('Refining template based on your feedback...')

    try {
      const startTime = Date.now()
      const result = await api.refineTemplateWithAI(formData.html_content, editPrompt.trim(), 'gpt-5')
      
      const duration = Date.now() - startTime
      console.log('[Template Refinement] Success!', {
        duration: `${duration}ms`,
        htmlLength: result.html_content?.length || 0,
        placeholderCount: result.placeholder_tags?.length || 0,
        timestamp: new Date().toISOString(),
      })

      setGenerationStatus('Template refined successfully!')
      
      const newHtml = result.html_content || formData.html_content
      setFormData(prev => ({
        ...prev,
        html_content: newHtml,
      }))
      
      // Ensure preview is shown after refinement
      if (!showPreview) {
        setShowPreview(true)
      }
      
      // Clear the edit prompt
      setEditPrompt('')
      
      // Clear status after a short delay
      setTimeout(() => {
        setGenerationStatus(null)
      }, 2000)
    } catch (error: any) {
      const errorDetails = {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        timestamp: new Date().toISOString(),
      }
      console.error('[Template Refinement] Failed:', errorDetails)
      console.error('[Template Refinement] Full error:', error)
      
      setError(error.response?.data?.message || error.message || 'Failed to refine template with AI')
      setGenerationStatus(null)
    } finally {
      setRefining(false)
    }
  }

  // Generate preview HTML with sample data
  const getPreviewHtml = () => {
    if (!formData.html_content.trim()) return ''
    
    let previewHtml = formData.html_content
    
    // Replace placeholders with sample data
    const sampleData: Record<string, string> = {
      TITLE: 'Sample Lead Magnet Title',
      CONTENT: 'This is sample content that will be replaced with your actual lead magnet content when the template is used.',
      AUTHOR_NAME: 'John Doe',
      COMPANY_NAME: 'Your Company',
      DATE: new Date().toLocaleDateString(),
      EMAIL: 'user@example.com',
      PHONE: '+1 (555) 123-4567',
    }
    
    // Replace all placeholders
    Object.keys(sampleData).forEach(key => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      previewHtml = previewHtml.replace(regex, sampleData[key])
    })
    
    // Replace any remaining placeholders with generic text
    previewHtml = previewHtml.replace(/\{\{([A-Z_]+)\}\}/g, '[$1]')
    
    return previewHtml
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
      <div className={`mb-6 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6 ${generating ? 'opacity-75' : ''}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
              <FiZap className={`w-5 h-5 mr-2 text-purple-600 ${generating ? 'animate-pulse' : ''}`} />
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder="e.g., A modern, professional email template for course idea validation reports with a clean header, content sections, and call-to-action buttons. Use a blue and white color scheme."
            rows={4}
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
            disabled={generating || !aiDescription.trim()}
            className="flex items-center justify-center px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <FiZap className="w-5 h-5 mr-2" />
                <span>Generate Template</span>
              </>
            )}
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

        {/* Preview Section */}
        {formData.html_content.trim() && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center">
                <FiEye className="w-4 h-4 mr-2" />
                HTML Preview
              </h3>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </button>
            </div>
            {showPreview && (
              <div className="bg-white border-t border-gray-200" style={{ height: '600px' }}>
                <iframe
                  key={`preview-${formData.html_content.length}-${formData.html_content.slice(0, 50)}`} // Force re-render when HTML changes
                  srcDoc={getPreviewHtml()}
                  className="w-full h-full border-0"
                  title="HTML Preview"
                  sandbox="allow-same-origin allow-scripts"
                />
              </div>
            )}
          </div>
        )}

        {/* Edit/Refine Section */}
        {formData.html_content.trim() && (
          <div className="bg-gradient-to-r from-green-50 to-teal-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
              <FiEdit2 className="w-5 h-5 mr-2 text-green-600" />
              Refine Template
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Want changes? Describe what you&apos;d like to modify, and AI will update the HTML for you.
            </p>
            
            <div className="space-y-4">
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="e.g., Make the colors more vibrant, add a footer section, make the header larger, change the font to a sans-serif typeface..."
                rows={3}
                disabled={refining}
              />
              
              <button
                type="button"
                onClick={handleRefine}
                disabled={refining || !editPrompt.trim()}
                className="flex items-center justify-center px-6 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {refining ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    <span>Refining...</span>
                  </>
                ) : (
                  <>
                    <FiEdit2 className="w-5 h-5 mr-2" />
                    <span>Apply Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

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
  <h1>Your Content Here</h1>
  <div>Complete HTML template with actual content</div>
</body>
</html>`}
            rows={20}
            required
          />
          <div className="mt-2 space-y-2">
            <p className="text-sm text-gray-500">
              Enter complete HTML content. AI will personalize it based on form submission data.
            </p>
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
