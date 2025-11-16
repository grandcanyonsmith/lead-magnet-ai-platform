'use client'

import { useState, useEffect } from 'react'
import { api } from '@/shared/lib/api'
import { AIModel } from '@/shared/types'
import { extractPlaceholders } from '@/features/templates/utils/templateUtils'

export interface TemplateData {
  template_name: string
  template_description: string
  html_content: string
  is_published: boolean
}

export function useTemplateEdit(workflowName: string, templateId: string | null, workflowTemplateId?: string) {
  const [templateLoading, setTemplateLoading] = useState(false)
  const [templateData, setTemplateData] = useState<TemplateData>({
    template_name: '',
    template_description: '',
    html_content: '',
    is_published: false,
  })

  const [detectedPlaceholders, setDetectedPlaceholders] = useState<string[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const [templateViewMode, setTemplateViewMode] = useState<'split' | 'editor' | 'preview'>('split')
  const [devicePreviewSize, setDevicePreviewSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')
  const [refining, setRefining] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<string | null>(null)
  const [editPrompt, setEditPrompt] = useState('')

  // Load template if templateId is provided
  useEffect(() => {
    if (workflowTemplateId && !templateId) {
      loadTemplate(workflowTemplateId)
    } else if (!workflowTemplateId && workflowName) {
      setTemplateData(prev => ({
        ...prev,
        template_name: `${workflowName || 'Lead Magnet'} Template`,
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowTemplateId, workflowName])

  // Auto-update template name when workflow name changes
  useEffect(() => {
    if (workflowName && !templateId && (templateData.template_name === `${workflowName} Template` || !templateData.template_name)) {
      setTemplateData(prev => ({
        ...prev,
        template_name: `${workflowName || 'Lead Magnet'} Template`,
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowName, templateId])

  const loadTemplate = async (id: string) => {
    setTemplateLoading(true)
    try {
      const template = await api.getTemplate(id)
      setTemplateData({
        template_name: template.template_name || '',
        template_description: template.template_description || '',
        html_content: template.html_content || '',
        is_published: (template as any).is_published || false,
      })
      
      if (template.html_content) {
        const placeholders = extractPlaceholders(template.html_content)
        setDetectedPlaceholders(placeholders)
        if (template.html_content.trim() && !showPreview) {
          setShowPreview(true)
          setPreviewKey(1)
        }
      }
    } catch (error: any) {
      console.error('Failed to load template:', error)
    } finally {
      setTemplateLoading(false)
    }
  }

  const handleTemplateChange = (field: string, value: any) => {
    setTemplateData(prev => ({ ...prev, [field]: value }))
  }

  const handleHtmlChange = (html: string) => {
    setTemplateData(prev => ({ ...prev, html_content: html }))
    const placeholders = extractPlaceholders(html)
    setDetectedPlaceholders(placeholders)
    setPreviewKey(prev => prev + 1)
    if (html.trim() && !showPreview) {
      setShowPreview(true)
    }
  }

  const handleRefine = async () => {
    if (!editPrompt.trim()) {
      return { error: 'Please describe what changes you want to make' }
    }

    if (!templateData.html_content.trim()) {
      return { error: 'No HTML content to refine' }
    }

    setRefining(true)
    setGenerationStatus('Refining template with AI...')

    try {
      const result = await api.refineTemplateWithAI({
        current_html: templateData.html_content,
        edit_prompt: editPrompt.trim(),
        model: 'gpt-5' as AIModel,
      })

      const newHtml = result.html_content
      setTemplateData(prev => ({
        ...prev,
        html_content: newHtml,
      }))
      
      const placeholders = extractPlaceholders(newHtml)
      setDetectedPlaceholders(placeholders)
      setPreviewKey(prev => prev + 1)
      
      if (!showPreview) {
        setShowPreview(true)
      }
      
      setEditPrompt('')
      
      setTimeout(() => {
        setGenerationStatus(null)
      }, 2000)

      return { success: true }
    } catch (error: any) {
      return { error: error.response?.data?.message || error.message || 'Failed to refine template with AI' }
    } finally {
      setRefining(false)
    }
  }

  const insertPlaceholder = (placeholder: string) => {
    const placeholderText = `{{${placeholder}}}`
    setTemplateData(prev => ({
      ...prev,
      html_content: prev.html_content + placeholderText,
    }))
  }

  return {
    templateLoading,
    templateData,
    setTemplateData,
    detectedPlaceholders,
    showPreview,
    setShowPreview,
    previewKey,
    templateViewMode,
    setTemplateViewMode,
    devicePreviewSize,
    setDevicePreviewSize,
    refining,
    generationStatus,
    editPrompt,
    setEditPrompt,
    handleTemplateChange,
    handleHtmlChange,
    handleRefine,
    insertPlaceholder,
    loadTemplate,
  }
}

