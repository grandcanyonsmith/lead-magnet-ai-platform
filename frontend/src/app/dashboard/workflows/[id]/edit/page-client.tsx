'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { FiArrowLeft, FiSave, FiSettings, FiFileText, FiLayout, FiZap, FiEdit2, FiEye, FiPlus, FiType, FiMail, FiPhone, FiHash, FiList, FiChevronDown, FiChevronUp, FiGripVertical, FiMinus, FiMaximize2, FiMinimize2, FiMonitor, FiTablet, FiSmartphone, FiCode, FiCopy } from 'react-icons/fi'
import WorkflowStepEditor, { WorkflowStep } from '../../components/WorkflowStepEditor'
import WorkflowFlowchart from '../../components/WorkflowFlowchart'
import FlowchartSidePanel from '../../components/FlowchartSidePanel'

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
  // Extract workflow ID from params, or fallback to URL pathname if param is '_' (Vercel rewrite)
  const getWorkflowId = () => {
    const paramId = params?.id as string
    if (paramId && paramId !== '_') {
      return paramId
    }
    // Fallback: extract from browser URL
    if (typeof window !== 'undefined') {
      const pathMatch = window.location.pathname.match(/\/dashboard\/workflows\/([^/]+)\/edit/)
      if (pathMatch && pathMatch[1] && pathMatch[1] !== '_') {
        return pathMatch[1]
      }
    }
    return paramId || ''
  }
  const workflowId = getWorkflowId()
  
  const [activeTab, setActiveTab] = useState<'workflow' | 'form' | 'template'>('workflow')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    workflow_name: '',
    workflow_description: '',
    ai_model: 'o3-deep-research',
    ai_instructions: '',
    rewrite_model: 'gpt-5',
    research_enabled: true,
    html_enabled: true,
    template_id: '',
    template_version: 0,
  })

  // Steps array for multi-step workflow format
  const [steps, setSteps] = useState<WorkflowStep[]>([])

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
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [refining, setRefining] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<string | null>(null)
  const [editPrompt, setEditPrompt] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [detectedPlaceholders, setDetectedPlaceholders] = useState<string[]>([])
  const [previewKey, setPreviewKey] = useState(0)
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null)
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)
  
  // Form Settings UI states
  const [showFormPreview, setShowFormPreview] = useState(true)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    basic: false,
    fields: false,
    security: false,
    customization: false,
  })
  const [draggedFieldIndex, setDraggedFieldIndex] = useState<number | null>(null)
  
  // Template Viewer UI states
  const [templateViewMode, setTemplateViewMode] = useState<'split' | 'editor' | 'preview'>('split')
  const [devicePreviewSize, setDevicePreviewSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')

  const [templateData, setTemplateData] = useState({
    template_name: '',
    template_description: '',
    html_content: '',
    is_published: false,
  })

  useEffect(() => {
    if (workflowId) {
      loadWorkflow()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId])

  const loadWorkflow = async () => {
    try {
      const workflow = await api.getWorkflow(workflowId)
      setFormData({
        workflow_name: workflow.workflow_name || '',
        workflow_description: workflow.workflow_description || '',
        ai_model: workflow.ai_model || 'o3-deep-research',
        ai_instructions: workflow.ai_instructions || '',
        rewrite_model: workflow.rewrite_model || 'gpt-5',
        research_enabled: workflow.research_enabled !== undefined ? workflow.research_enabled : true,
        html_enabled: workflow.html_enabled !== undefined ? workflow.html_enabled : true,
        template_id: workflow.template_id || '',
        template_version: workflow.template_version || 0,
      })

      // Load steps if present, otherwise migrate from legacy format
      if (workflow.steps && workflow.steps.length > 0) {
        // Ensure all steps have required fields with defaults
        const loadedSteps = workflow.steps.map((step: any, index: number) => {
          // Provide default instructions if empty
          let defaultInstructions = ''
          if (step.step_name && step.step_name.toLowerCase().includes('html')) {
            defaultInstructions = 'Rewrite the content into styled HTML matching the provided template. Ensure the output is complete, valid HTML that matches the template\'s design and structure.'
          } else if (step.step_name && step.step_name.toLowerCase().includes('research')) {
            defaultInstructions = 'Generate a comprehensive research report based on the form submission data.'
          } else {
            defaultInstructions = 'Process the input data according to the workflow requirements.'
          }
          
          return {
            step_name: step.step_name || `Step ${index + 1}`,
            step_description: step.step_description || '',
            model: step.model || 'gpt-5',
            instructions: step.instructions?.trim() || defaultInstructions,
            step_order: step.step_order !== undefined ? step.step_order : index,
            tools: step.tools || ['web_search_preview'],
            tool_choice: step.tool_choice || 'auto',
          }
        })
        setSteps(loadedSteps)
      } else {
        // Migrate legacy format to steps
        const migratedSteps: WorkflowStep[] = []
        if (workflow.research_enabled && workflow.ai_instructions) {
          migratedSteps.push({
            step_name: 'Deep Research',
            step_description: 'Generate comprehensive research report',
            model: workflow.ai_model || 'o3-deep-research',
            instructions: workflow.ai_instructions,
            step_order: 0,
            tools: ['web_search_preview'],
            tool_choice: 'auto',
          })
        }
        if (workflow.html_enabled) {
          migratedSteps.push({
            step_name: 'HTML Rewrite',
            step_description: 'Rewrite content into styled HTML matching template',
            model: workflow.rewrite_model || 'gpt-5',
            instructions: 'Rewrite the research content into styled HTML matching the provided template. Ensure the output is complete, valid HTML that matches the template\'s design and structure.',
            step_order: migratedSteps.length,
            tools: [],
            tool_choice: 'none',
          })
        }
        // If no steps were created, create default steps
        if (migratedSteps.length === 0) {
          migratedSteps.push({
            step_name: 'Deep Research',
            step_description: 'Generate comprehensive research report',
            model: 'o3-deep-research',
            instructions: workflow.ai_instructions || 'Generate a comprehensive research report based on the form submission data.',
            step_order: 0,
            tools: ['web_search_preview'],
            tool_choice: 'auto',
          })
          if (workflow.html_enabled !== false) {
            migratedSteps.push({
              step_name: 'HTML Rewrite',
              step_description: 'Rewrite content into styled HTML matching template',
              model: 'gpt-5',
              instructions: 'Rewrite the research content into styled HTML matching the provided template. Ensure the output is complete, valid HTML that matches the template\'s design and structure.',
              step_order: 1,
              tools: [],
              tool_choice: 'none',
            })
          }
        }
        setSteps(migratedSteps)
      }

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

      // Load template if it exists
      if (workflow.template_id) {
        setTemplateId(workflow.template_id)
        loadTemplate(workflow.template_id)
      } else {
        // Initialize with default template name based on workflow name
        setTemplateData(prev => ({
          ...prev,
          template_name: `${workflow.workflow_name || 'Lead Magnet'} Template`,
        }))
      }
    } catch (error: any) {
      console.error('Failed to load workflow:', error)
      setError(error.response?.data?.message || error.message || 'Failed to load workflow')
    } finally {
      setLoading(false)
    }
  }

  const loadTemplate = async (id: string) => {
    setTemplateLoading(true)
    try {
      const template = await api.getTemplate(id)
      setTemplateData({
        template_name: template.template_name || '',
        template_description: template.template_description || '',
        html_content: template.html_content || '',
        is_published: template.is_published || false,
      })
      
      // Extract placeholders from loaded HTML
      if (template.html_content) {
        const placeholders = extractPlaceholders(template.html_content)
        setDetectedPlaceholders(placeholders)
        // Auto-show preview when HTML is loaded
        if (template.html_content.trim() && !showPreview) {
          setShowPreview(true)
          setPreviewKey(1)
        }
      }
    } catch (error: any) {
      console.error('Failed to load template:', error)
      setError(error.response?.data?.message || error.message || 'Failed to load template')
    } finally {
      setTemplateLoading(false)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!formData.workflow_name.trim()) {
      setError('Lead magnet name is required')
      return
    }

    // Validate steps
    if (steps.length === 0) {
      setError('At least one workflow step is required')
      return
    }

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      if (!step.step_name.trim()) {
        setError(`Step ${i + 1} name is required`)
        return
      }
      if (!step.instructions.trim()) {
        setError(`Step ${i + 1} instructions are required`)
        return
      }
    }

    if (formData.html_enabled && !templateId && !templateData.html_content.trim()) {
      setError('Template HTML content is required when HTML generation is enabled')
      return
    }

    setSubmitting(true)

    try {
      // Create or update template if HTML is enabled
      let finalTemplateId = templateId
      if (formData.html_enabled) {
        if (!templateData.html_content.trim()) {
          setError('Template HTML content is required when HTML generation is enabled')
          setSubmitting(false)
          return
        }

        const placeholders = extractPlaceholders(templateData.html_content)
        
        if (templateId) {
          // Update existing template
          await api.updateTemplate(templateId, {
            template_name: templateData.template_name.trim(),
            template_description: templateData.template_description.trim() || undefined,
            html_content: templateData.html_content.trim(),
            placeholder_tags: placeholders.length > 0 ? placeholders : undefined,
            is_published: templateData.is_published,
          })
          finalTemplateId = templateId
        } else {
          // Create new template
          const template = await api.createTemplate({
            template_name: templateData.template_name.trim(),
            template_description: templateData.template_description.trim() || undefined,
            html_content: templateData.html_content.trim(),
            placeholder_tags: placeholders.length > 0 ? placeholders : undefined,
            is_published: templateData.is_published,
          })
          finalTemplateId = template.template_id
          setTemplateId(template.template_id)
        }
      }

      // Update workflow with steps
      await api.updateWorkflow(workflowId, {
        workflow_name: formData.workflow_name.trim(),
        workflow_description: formData.workflow_description.trim() || undefined,
        steps: steps.map((step, index) => ({
          ...step,
          step_order: index,
        })),
        // Keep legacy fields for backward compatibility
        ai_model: formData.ai_model,
        ai_instructions: steps[0]?.instructions || formData.ai_instructions.trim() || '',
        rewrite_model: formData.rewrite_model,
        research_enabled: formData.research_enabled,
        html_enabled: formData.html_enabled,
        template_id: formData.html_enabled ? finalTemplateId : undefined,
        template_version: 0,
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

  // Step management functions
  const handleStepChange = (index: number, step: WorkflowStep) => {
    setSteps(prev => {
      const newSteps = [...prev]
      newSteps[index] = { ...step, step_order: index }
      return newSteps
    })
  }

  const handleAddStep = () => {
    setSteps(prev => [
      ...prev,
      {
        step_name: `Step ${prev.length + 1}`,
        step_description: '',
        model: 'gpt-5',
        instructions: '',
        step_order: prev.length,
        tools: ['web_search_preview'],
        tool_choice: 'auto',
      },
    ])
  }

  const handleDeleteStep = (index: number) => {
    setSteps(prev => {
      const newSteps = prev.filter((_, i) => i !== index)
      // Reorder steps
      return newSteps.map((step, i) => ({ ...step, step_order: i }))
    })
  }

  const handleMoveStepUp = (index: number) => {
    if (index === 0) return
    setSteps(prev => {
      const newSteps = [...prev]
      ;[newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]]
      // Reorder steps
      return newSteps.map((step, i) => ({ ...step, step_order: i }))
    })
  }

  const handleMoveStepDown = (index: number) => {
    if (index === steps.length - 1) return
    setSteps(prev => {
      const newSteps = [...prev]
      ;[newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]]
      // Reorder steps
      return newSteps.map((step, i) => ({ ...step, step_order: i }))
    })
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

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedFieldIndex(index)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (dropIndex: number) => {
    if (draggedFieldIndex === null || draggedFieldIndex === dropIndex) {
      setDraggedFieldIndex(null)
      return
    }

    setFormFormData(prev => {
      const newFields = [...prev.form_fields_schema.fields]
      const draggedField = newFields[draggedFieldIndex]
      newFields.splice(draggedFieldIndex, 1)
      newFields.splice(dropIndex, 0, draggedField)
      return {
        ...prev,
        form_fields_schema: {
          ...prev.form_fields_schema,
          fields: newFields,
        },
      }
    })
    setDraggedFieldIndex(null)
  }

  // Field type icon helper
  const getFieldTypeIcon = (fieldType: string) => {
    switch (fieldType) {
      case 'email':
        return <FiMail className="w-4 h-4" />
      case 'tel':
        return <FiPhone className="w-4 h-4" />
      case 'number':
        return <FiHash className="w-4 h-4" />
      case 'select':
        return <FiList className="w-4 h-4" />
      case 'textarea':
        return <FiType className="w-4 h-4" />
      default:
        return <FiType className="w-4 h-4" />
    }
  }

  // Toggle section collapse
  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  // Render form preview
  const renderFormPreview = () => {
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

  // Format HTML helper
  const formatHTML = () => {
    // Simple HTML formatting - indent based on tags
    let formatted = templateData.html_content
    formatted = formatted.replace(/>\s*</g, '>\n<')
    const lines = formatted.split('\n')
    let indent = 0
    const formattedLines = lines.map(line => {
      const trimmed = line.trim()
      if (!trimmed) return ''
      if (trimmed.startsWith('</')) {
        indent = Math.max(0, indent - 2)
      }
      const indented = ' '.repeat(indent) + trimmed
      if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.endsWith('/>')) {
        indent += 2
      }
      return indented
    })
    setTemplateData(prev => ({ ...prev, html_content: formattedLines.join('\n') }))
  }

  // Insert placeholder helper
  const insertPlaceholder = (placeholder: string) => {
    const placeholderText = `{{${placeholder}}}`
    setTemplateData(prev => ({
      ...prev,
      html_content: prev.html_content + placeholderText,
    }))
  }

  // Get device preview width
  const getDevicePreviewWidth = () => {
    switch (devicePreviewSize) {
      case 'mobile':
        return '375px'
      case 'tablet':
        return '768px'
      default:
        return '100%'
    }
  }

  const handleTemplateChange = (field: string, value: any) => {
    setTemplateData(prev => ({ ...prev, [field]: value }))
  }

  const handleHtmlChange = (html: string) => {
    setTemplateData(prev => ({ ...prev, html_content: html }))
    const placeholders = extractPlaceholders(html)
    setDetectedPlaceholders(placeholders)
    // Force preview re-render when HTML changes manually
    setPreviewKey(prev => prev + 1)
    // Auto-show preview when HTML is added
    if (html.trim() && !showPreview) {
      setShowPreview(true)
    }
  }

  const handleRefine = async () => {
    if (!editPrompt.trim()) {
      setError('Please describe what changes you want to make')
      return
    }

    if (!templateData.html_content.trim()) {
      setError('No HTML content to refine')
      return
    }

    setRefining(true)
    setError(null)
    setGenerationStatus('Refining template with AI...')

    try {
      const result = await api.refineTemplateWithAI(
        templateData.html_content,
        editPrompt.trim(),
        'gpt-5'
      )

      const newHtml = result.html_content
      setTemplateData(prev => ({
        ...prev,
        html_content: newHtml,
      }))
      
      const placeholders = result.placeholder_tags || []
      setDetectedPlaceholders(placeholders)
      
      // Force preview re-render by incrementing previewKey
      setPreviewKey(prev => prev + 1)
      
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
      setError(error.response?.data?.message || error.message || 'Failed to refine template with AI')
      setGenerationStatus(null)
    } finally {
      setRefining(false)
    }
  }

  // Generate preview HTML with sample data
  const getPreviewHtml = () => {
    if (!templateData.html_content.trim()) return ''
    
    let previewHtml = templateData.html_content
    
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

  // Auto-update form name when workflow name changes
  useEffect(() => {
    if (formData.workflow_name && formFormData.form_name === `${formData.workflow_name} Form` || !formFormData.form_name) {
      setFormFormData(prev => ({
        ...prev,
        form_name: `${formData.workflow_name} Form`,
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.workflow_name])

  // Auto-update template name when workflow name changes (if template doesn't have a custom name)
  useEffect(() => {
    if (formData.workflow_name && !templateId && templateData.template_name === `${formData.workflow_name} Template` || !templateData.template_name) {
      setTemplateData(prev => ({
        ...prev,
        template_name: `${formData.workflow_name || 'Lead Magnet'} Template`,
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.workflow_name, templateId])

  // Switch away from template tab if HTML is disabled
  useEffect(() => {
    if (!formData.html_enabled && activeTab === 'template') {
      setActiveTab('workflow')
    }
  }, [formData.html_enabled, activeTab])

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
          {formData.html_enabled && (
            <button
              onClick={() => setActiveTab('template')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'template'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FiLayout className="inline w-4 h-4 mr-2" />
              Template
            </button>
          )}
        </nav>
      </div>

      {activeTab === 'workflow' && (
        <>
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

            {/* Workflow Steps - Flowchart Visualization */}
            <div className="space-y-4 pt-6 border-t">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Workflow Steps</h2>
                <p className="text-sm text-gray-600">
                  Define the steps your workflow will execute. Each step receives context from all previous steps.
                  Click on a step to edit its details.
                </p>
              </div>
              
              <WorkflowFlowchart
                steps={steps}
                activeStepIndex={selectedStepIndex}
                onStepClick={(index) => {
                  setSelectedStepIndex(index)
                  setIsSidePanelOpen(true)
                }}
                onAddStep={handleAddStep}
                onStepsReorder={(newSteps) => {
                  // Update step order based on new positions
                  const reorderedSteps = newSteps.map((step, index) => ({
                    ...step,
                    step_order: index,
                  }))
                  setSteps(reorderedSteps)
                }}
              />
            </div>

            {/* Legacy fields - hidden but kept for backward compatibility */}
            <div className="hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Research Model <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.ai_model}
                    onChange={(e) => handleChange('ai_model', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={!formData.research_enabled}
                  >
                    <option value="o3-deep-research">O3 Deep Research</option>
                    <option value="gpt-5">GPT-5</option>
                    <option value="gpt-4.1">GPT-4.1</option>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Styling Model
                  </label>
                  <select
                    value={formData.rewrite_model}
                    onChange={(e) => handleChange('rewrite_model', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={!formData.html_enabled}
                  >
                    <option value="gpt-5">GPT-5</option>
                    <option value="gpt-4.1">GPT-4.1</option>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </select>
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
                  />
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
                </div>
              </div>
            </div>

            {formData.html_enabled && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Templates are managed in the Template tab above. Enable &quot;Generate Styled HTML&quot; to access template editing.
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
                disabled={submitting || (formData.html_enabled && !templateId && !templateData.html_content.trim()) || (formData.research_enabled && !formData.ai_instructions.trim())}
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
        <div className="space-y-6">
          {/* Form Preview Toggle */}
          <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FiEye className="w-5 h-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Form Preview</span>
            </div>
            <button
              type="button"
              onClick={() => setShowFormPreview(!showFormPreview)}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
            >
              {showFormPreview ? (
                <>
                  <FiMinimize2 className="w-4 h-4 mr-1" />
                  Hide Preview
                </>
              ) : (
                <>
                  <FiMaximize2 className="w-4 h-4 mr-1" />
                  Show Preview
                </>
              )}
            </button>
          </div>

          {/* Split Layout: Form Settings and Preview */}
          <div className={`grid gap-6 ${showFormPreview ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
            {/* Form Settings */}
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> The form name is automatically synced with the lead magnet name. Name, email, and phone fields are always included and cannot be removed.
                </p>
              </div>

              {/* Basic Settings Section */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('basic')}
                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
                >
                  <h3 className="text-sm font-semibold text-gray-900">Basic Settings</h3>
                  {collapsedSections.basic ? (
                    <FiChevronDown className="w-5 h-5 text-gray-500" />
                  ) : (
                    <FiChevronUp className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                {!collapsedSections.basic && (
                  <div className="p-4 space-y-4">
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
                  </div>
                )}
              </div>

              {/* Form Fields Section */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('fields')}
                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
                >
                  <h3 className="text-sm font-semibold text-gray-900">Form Fields</h3>
                  {collapsedSections.fields ? (
                    <FiChevronDown className="w-5 h-5 text-gray-500" />
                  ) : (
                    <FiChevronUp className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                {!collapsedSections.fields && (
                  <div className="p-4 space-y-4">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={addField}
                        className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
                      >
                        <FiPlus className="w-4 h-4 mr-2" />
                        Add Field
                      </button>
                    </div>
                    <div className="space-y-3">
                      {formFormData.form_fields_schema.fields.map((field, index) => (
                        <div
                          key={field.field_id || index}
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={handleDragOver}
                          onDrop={() => handleDrop(index)}
                          className={`border-2 rounded-lg p-4 space-y-3 transition-all ${
                            draggedFieldIndex === index
                              ? 'border-primary-500 bg-primary-50 opacity-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-2 flex-1">
                              <div className="cursor-move text-gray-400 hover:text-gray-600">
                                <FiGripVertical className="w-5 h-5" />
                              </div>
                              <div className="flex items-center space-x-2 px-2 py-1 bg-gray-100 rounded text-gray-700">
                                {getFieldTypeIcon(field.field_type)}
                                <span className="text-xs font-medium capitalize">{field.field_type}</span>
                              </div>
                              {field.required && (
                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                                  Required
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeField(index)}
                              className="text-red-600 hover:text-red-700 p-1"
                            >
                              <FiMinus className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Field Type</label>
                              <select
                                value={field.field_type}
                                onChange={(e) => handleFieldChange(index, 'field_type', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="Option 1, Option 2, Option 3"
                              />
                            </div>
                          )}
                          <div className="flex items-center">
                            <label className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) => handleFieldChange(index, 'required', e.target.checked)}
                                className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                              />
                              <span className="text-xs text-gray-700">Required field</span>
                            </label>
                          </div>
                        </div>
                      ))}
                      {formFormData.form_fields_schema.fields.length === 0 && (
                        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                          <p className="text-sm text-gray-500">No custom fields. Name, email, and phone are always included.</p>
                          <button
                            type="button"
                            onClick={addField}
                            className="mt-3 text-sm text-primary-600 hover:text-primary-700"
                          >
                            Add your first field
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Security & Limits Section */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('security')}
                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
                >
                  <h3 className="text-sm font-semibold text-gray-900">Security & Limits</h3>
                  {collapsedSections.security ? (
                    <FiChevronDown className="w-5 h-5 text-gray-500" />
                  ) : (
                    <FiChevronUp className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                {!collapsedSections.security && (
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formFormData.rate_limit_enabled}
                          onChange={(e) => handleFormChange('rate_limit_enabled', e.target.checked)}
                          className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
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
                          className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <span className="text-sm font-medium text-gray-700">Enable CAPTCHA</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Customization Section */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('customization')}
                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
                >
                  <h3 className="text-sm font-semibold text-gray-900">Customization</h3>
                  {collapsedSections.customization ? (
                    <FiChevronDown className="w-5 h-5 text-gray-500" />
                  ) : (
                    <FiChevronUp className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                {!collapsedSections.customization && (
                  <div className="p-4 space-y-4">
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
                  </div>
                )}
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

            {/* Form Preview */}
            {showFormPreview && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Live Preview</h3>
                  <span className="text-xs text-gray-500">Updates in real-time</span>
                </div>
                <div className="border border-gray-200 rounded-lg overflow-auto max-h-[800px]">
                  {renderFormPreview()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'form' && !formId && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600 mb-4">No form found for this lead magnet.</p>
          <p className="text-sm text-gray-500">Forms are automatically created when you create a lead magnet.</p>
        </div>
      )}

      {activeTab === 'template' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {!formData.html_enabled && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Enable &quot;Generate Styled HTML&quot; in the Lead Magnet Settings tab to use templates.
              </p>
            </div>
          )}

          {templateLoading && (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <p className="text-gray-600">Loading template...</p>
            </div>
          )}

          {!templateLoading && (
            <>
              {/* Template Metadata */}
              <div className="bg-white rounded-lg shadow p-6 space-y-4">
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
              </div>

              {/* View Mode Toggle */}
              {templateData.html_content.trim() && (
                <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FiEye className="w-5 h-5 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">View Mode</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setTemplateViewMode('split')}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        templateViewMode === 'split'
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Split
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemplateViewMode('editor')}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        templateViewMode === 'editor'
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Editor
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemplateViewMode('preview')}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        templateViewMode === 'preview'
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Preview
                    </button>
                  </div>
                </div>
              )}

              {/* Split View: Editor and Preview */}
              <div className={`grid gap-6 ${templateViewMode === 'split' && templateData.html_content.trim() ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
                {/* HTML Editor */}
                {(templateViewMode === 'split' || templateViewMode === 'editor') && (
                  <div className="bg-white rounded-lg shadow">
                    <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <FiCode className="w-5 h-5 text-gray-500" />
                        <h3 className="text-sm font-semibold text-gray-900">HTML Editor</h3>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={formatHTML}
                          className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
                          title="Format HTML"
                        >
                          Format
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gray-50 border-r border-gray-200 flex flex-col items-center py-2 text-xs text-gray-400 font-mono">
                        {templateData.html_content.split('\n').map((_, i) => (
                          <div key={i} className="leading-6">
                            {i + 1}
                          </div>
                        ))}
                      </div>
                      <textarea
                        value={templateData.html_content}
                        onChange={(e) => handleHtmlChange(e.target.value)}
                        className="w-full px-3 py-2 pl-12 border-0 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm leading-6 resize-none"
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
                        style={{ minHeight: '500px' }}
                      />
                    </div>
                    <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-600">Placeholders:</span>
                          {detectedPlaceholders.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {detectedPlaceholders.map((placeholder) => (
                                <button
                                  key={placeholder}
                                  type="button"
                                  onClick={() => insertPlaceholder(placeholder)}
                                  className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded text-xs font-mono hover:bg-primary-200 transition-colors flex items-center"
                                  title={`Insert {{${placeholder}}}`}
                                >
                                  {`{{${placeholder}}}`}
                                  <FiCopy className="w-3 h-3 ml-1" />
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-yellow-600">None detected</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          Use <code className="px-1 py-0.5 bg-gray-200 rounded">&#123;&#123;NAME&#125;&#125;</code> for placeholders
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview Panel */}
                {(templateViewMode === 'split' || templateViewMode === 'preview') && templateData.html_content.trim() && (
                  <div className="bg-white rounded-lg shadow">
                    <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <FiEye className="w-5 h-5 text-gray-500" />
                        <h3 className="text-sm font-semibold text-gray-900">Preview</h3>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setDevicePreviewSize('mobile')}
                          className={`p-1.5 rounded transition-colors ${
                            devicePreviewSize === 'mobile'
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          title="Mobile (375px)"
                        >
                          <FiSmartphone className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDevicePreviewSize('tablet')}
                          className={`p-1.5 rounded transition-colors ${
                            devicePreviewSize === 'tablet'
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          title="Tablet (768px)"
                        >
                          <FiTablet className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDevicePreviewSize('desktop')}
                          className={`p-1.5 rounded transition-colors ${
                            devicePreviewSize === 'desktop'
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          title="Desktop (Full Width)"
                        >
                          <FiMonitor className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="bg-gray-100 p-4 flex justify-center" style={{ minHeight: '500px' }}>
                      <div
                        className="bg-white border border-gray-300 rounded-lg shadow-lg overflow-auto"
                        style={{
                          width: getDevicePreviewWidth(),
                          maxWidth: '100%',
                          height: devicePreviewSize === 'desktop' ? '600px' : '800px',
                        }}
                      >
                        <iframe
                          key={`preview-${previewKey}-${templateData.html_content.length}-${devicePreviewSize}`}
                          srcDoc={getPreviewHtml()}
                          className="w-full h-full border-0"
                          title="HTML Preview"
                          sandbox="allow-same-origin allow-scripts"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Refined Refine Section */}
              {templateData.html_content.trim() && (
                <div className="bg-white rounded-lg shadow border border-green-200">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-green-50 to-teal-50">
                    <div className="flex items-center space-x-2">
                      <FiZap className="w-5 h-5 text-green-600" />
                      <h3 className="text-sm font-semibold text-gray-900">AI Refine</h3>
                      <span className="text-xs text-gray-500">(Optional)</span>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <textarea
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                        placeholder="e.g., Make colors more vibrant, modernize layout, add spacing..."
                        rows={3}
                        disabled={refining}
                      />
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className="text-xs text-gray-500">Suggestions:</span>
                        {['Make colors more vibrant', 'Modernize the layout', 'Add more spacing', 'Improve typography'].map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => setEditPrompt(suggestion)}
                            className="text-xs px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {generationStatus && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-2 flex items-center">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600 mr-2"></div>
                        <span className="text-xs text-green-800 font-medium">{generationStatus}</span>
                      </div>
                    )}
                    
                    <button
                      type="button"
                      onClick={handleRefine}
                      disabled={refining || !editPrompt.trim()}
                      className="w-full flex items-center justify-center px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {refining ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          <span>Refining...</span>
                        </>
                      ) : (
                        <>
                          <FiZap className="w-4 h-4 mr-2" />
                          <span>Apply Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Publish Settings */}
              <div className="bg-white rounded-lg shadow p-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={templateData.is_published}
                    onChange={(e) => handleTemplateChange('is_published', e.target.checked)}
                    className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Publish Template</span>
                </label>
                <p className="mt-1 text-sm text-gray-500 ml-6">
                  Published templates can be used in workflows immediately
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !templateData.html_content.trim()}
                  className="flex items-center px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiSave className="w-5 h-5 mr-2" />
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {/* Flowchart Side Panel */}
      <FlowchartSidePanel
        step={selectedStepIndex !== null ? steps[selectedStepIndex] : null}
        index={selectedStepIndex}
        totalSteps={steps.length}
        isOpen={isSidePanelOpen}
        onClose={() => {
          setIsSidePanelOpen(false)
          setSelectedStepIndex(null)
        }}
        onChange={handleStepChange}
        onDelete={handleDeleteStep}
        onMoveUp={(index) => {
          handleMoveStepUp(index)
          // Update selected index if needed (step moves to index - 1)
          if (selectedStepIndex === index && index > 0) {
            setSelectedStepIndex(index - 1)
          }
        }}
        onMoveDown={(index) => {
          handleMoveStepDown(index)
          // Update selected index if needed (step moves to index + 1)
          if (selectedStepIndex === index && index < steps.length - 1) {
            setSelectedStepIndex(index + 1)
          }
        }}
      />
    </div>
  )
}

