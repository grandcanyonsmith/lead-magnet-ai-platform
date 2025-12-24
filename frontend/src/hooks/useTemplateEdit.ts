'use client'

import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { AIModel } from '@/types'
import { extractPlaceholders } from '@/utils/templateUtils'

export interface TemplateData {
  template_name: string
  template_description: string
  html_content: string
  is_published: boolean
}

interface HistoryItem {
  html: string
  label: string
  timestamp: number
}

export function useTemplateEdit(workflowName: string, templateId: string | null, workflowTemplateId?: string) {
  const [templateLoading, setTemplateLoading] = useState(false)
  const [templateData, setTemplateData] = useState<TemplateData>({
    template_name: '',
    template_description: '',
    html_content: '',
    is_published: false,
  })

  // History state
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  // Use ref to track latest templateData for async operations to avoid stale closures
  const templateDataRef = useRef(templateData)
  useEffect(() => {
    templateDataRef.current = templateData
  }, [templateData])

  const [detectedPlaceholders, setDetectedPlaceholders] = useState<string[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const [templateViewMode, setTemplateViewMode] = useState<'split' | 'editor' | 'preview'>('split')
  const [devicePreviewSize, setDevicePreviewSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')
  const [refining, setRefining] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<string | null>(null)
  const [editPrompt, setEditPrompt] = useState('')
  const [selectedSelectors, setSelectedSelectors] = useState<string[]>([])

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

  const addToHistory = (html: string, label: string = 'Edit') => {
    // Don't add if same as current
    if (historyIndex >= 0 && history[historyIndex].html === html) return

    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({
      html,
      label,
      timestamp: Date.now()
    })
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  const loadTemplate = async (id: string) => {
    setTemplateLoading(true)
    try {
      const template = await api.getTemplate(id)
      const htmlContent = template.html_content || ''
      
      setTemplateData({
        template_name: template.template_name || '',
        template_description: template.template_description || '',
        html_content: htmlContent,
        is_published: (template as any).is_published || false,
      })
      
      // Initialize history
      const initialHistoryItem = {
        html: htmlContent,
        label: 'Initial Load',
        timestamp: Date.now()
      }
      setHistory([initialHistoryItem])
      setHistoryIndex(0)
      
      if (htmlContent) {
        const placeholders = extractPlaceholders(htmlContent)
        setDetectedPlaceholders(placeholders)
        if (htmlContent.trim() && !showPreview) {
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
    
    // Update derived state as user types
    const placeholders = extractPlaceholders(html)
    setDetectedPlaceholders(placeholders)
    setPreviewKey(prev => prev + 1)
    if (html.trim() && !showPreview) {
      setShowPreview(true)
    }
    
    // Note: We don't add to history on every keystroke
  }
  
  // Wrapper to commit manual changes to history (e.g. on blur or after debounce)
  const commitHtmlChange = (html: string) => {
      addToHistory(html, 'Manual Edit')
  }
  
  const jumpToHistory = (index: number) => {
      if (index >= 0 && index < history.length) {
          const item = history[index]
          setHistoryIndex(index)
          setTemplateData(prev => ({ ...prev, html_content: item.html }))
          
          // Update derived state
          const placeholders = extractPlaceholders(item.html)
          setDetectedPlaceholders(placeholders)
          setPreviewKey(prev => prev + 1)
      }
  }

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      const item = history[newIndex]
      setHistoryIndex(newIndex)
      setTemplateData(prev => ({ ...prev, html_content: item.html }))
      
      // Update derived state
      const placeholders = extractPlaceholders(item.html)
      setDetectedPlaceholders(placeholders)
      setPreviewKey(prev => prev + 1)
    }
  }

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      const item = history[newIndex]
      setHistoryIndex(newIndex)
      setTemplateData(prev => ({ ...prev, html_content: item.html }))
      
      // Update derived state
      const placeholders = extractPlaceholders(item.html)
      setDetectedPlaceholders(placeholders)
      setPreviewKey(prev => prev + 1)
    }
  }

  const handleRefine = async () => {
    if (!editPrompt.trim()) {
      return { error: 'Please describe what changes you want to make' }
    }

    // Use the ref to get the absolute latest HTML content
    const currentHtml = templateDataRef.current.html_content

    if (!currentHtml.trim()) {
      return { error: 'No HTML content to refine' }
    }
    
    // Ensure current state is in history before refining if it's new
    if (historyIndex === -1 || history[historyIndex].html !== currentHtml) {
        addToHistory(currentHtml, 'Before Refine')
    }

    setRefining(true)
    setGenerationStatus('Refining template with AI...')

    try {
      const result = await api.refineTemplateWithAI({
        current_html: currentHtml,
        edit_prompt: editPrompt.trim(),
        selectors: selectedSelectors,
        model: 'gpt-5' as AIModel,
      })

      const newHtml = result.html_content
      setTemplateData(prev => ({
        ...prev,
        html_content: newHtml,
      }))
      
      // Add successful refinement to history
      addToHistory(newHtml, `AI: ${editPrompt.substring(0, 30)}${editPrompt.length > 30 ? '...' : ''}`)
      
      const placeholders = extractPlaceholders(newHtml)
      setDetectedPlaceholders(placeholders)
      setPreviewKey(prev => prev + 1)
      
      if (!showPreview) {
        setShowPreview(true)
      }
      
      setEditPrompt('')
      setSelectedSelectors([]) // Clear selection after refine
      
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
    // Use ref to get latest state to avoid race conditions
    const currentHtml = templateDataRef.current.html_content
    const newHtml = currentHtml + placeholderText
    setTemplateData(prev => ({
      ...prev,
      html_content: newHtml,
    }))
    addToHistory(newHtml, `Inserted ${placeholder}`)
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
    commitHtmlChange,
    handleRefine,
    insertPlaceholder,
    loadTemplate,
<<<<<<< Current (Your changes)
    handleUndo,
    handleRedo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    history,
    historyIndex,
    jumpToHistory,
=======
    selectedSelectors,
    setSelectedSelectors,
>>>>>>> Incoming (Background Agent changes)
  }
}
