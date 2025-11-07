'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { FiArrowLeft, FiSave, FiZap, FiEye, FiPlus } from 'react-icons/fi'
import WorkflowStepEditor, { WorkflowStep } from '../components/WorkflowStepEditor'

export default function NewWorkflowPage() {
  const router = useRouter()
  const [step, setStep] = useState<'prompt' | 'form'>('prompt')
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [generatedTemplateId, setGeneratedTemplateId] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  
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
    // Delivery configuration
    delivery_method: 'none' as 'webhook' | 'sms' | 'none',
    delivery_webhook_url: '',
    delivery_webhook_headers: {} as Record<string, string>,
    delivery_sms_enabled: false,
    delivery_sms_message: '',
    delivery_sms_ai_generated: false,
    delivery_sms_ai_instructions: '',
  })

  // Steps array for new multi-step workflow format
  const [steps, setSteps] = useState<WorkflowStep[]>([
    {
      step_name: 'Deep Research',
      step_description: 'Generate comprehensive research report',
      model: 'o3-deep-research',
      instructions: '',
      step_order: 0,
      tools: ['web_search_preview'],
      tool_choice: 'auto',
    },
    {
      step_name: 'HTML Rewrite',
      step_description: 'Rewrite content into styled HTML matching template',
      model: 'gpt-5',
      instructions: 'Rewrite the research content into styled HTML matching the provided template. Ensure the output is complete, valid HTML that matches the template\'s design and structure.',
      step_order: 1,
      tools: [],
      tool_choice: 'none',
    },
  ])

  const [templateData, setTemplateData] = useState({
    template_name: '',
    template_description: '',
    html_content: '',
    placeholder_tags: [] as string[],
  })

  const [formFieldsData, setFormFieldsData] = useState({
    form_name: '',
    public_slug: '',
    form_fields_schema: {
      fields: [] as any[],
    },
  })

  const [showFormPreview, setShowFormPreview] = useState(false)

  const saveWorkflow = async (autoSave: boolean = false) => {
    setError(null)

    // Validation
    if (!formData.workflow_name.trim()) {
      setError('Lead magnet name is required')
      return null
    }

    // Validate steps
    if (steps.length === 0) {
      setError('At least one workflow step is required')
      return null
    }

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      if (!step.step_name.trim()) {
        setError(`Step ${i + 1} name is required`)
        return null
      }
      if (!step.instructions.trim()) {
        setError(`Step ${i + 1} instructions are required`)
        return null
      }
    }

    if (formData.html_enabled && !templateData.html_content.trim()) {
      setError('Template HTML content is required when HTML generation is enabled')
      return null
    }

    if (!autoSave) {
      setSubmitting(true)
    }

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

      // Then create the workflow with steps
      const workflow = await api.createWorkflow({
        workflow_name: formData.workflow_name.trim(),
        workflow_description: formData.workflow_description.trim() || undefined,
        steps: steps.map((step, index) => ({
          ...step,
          step_order: index,
        })),
        // Keep legacy fields for backward compatibility (will be auto-migrated)
        ai_model: formData.ai_model,
        ai_instructions: steps[0]?.instructions || formData.ai_instructions.trim() || '',
        rewrite_model: formData.rewrite_model,
        research_enabled: formData.research_enabled,
        html_enabled: formData.html_enabled,
        template_id: templateId || undefined,
        template_version: formData.template_version,
        // Delivery configuration
        delivery_method: formData.delivery_method,
        delivery_webhook_url: formData.delivery_method === 'webhook' && formData.delivery_webhook_url ? formData.delivery_webhook_url : undefined,
        delivery_webhook_headers: formData.delivery_method === 'webhook' && Object.keys(formData.delivery_webhook_headers).length > 0 ? formData.delivery_webhook_headers : undefined,
        delivery_sms_enabled: formData.delivery_method === 'sms',
        delivery_sms_message: formData.delivery_method === 'sms' && formData.delivery_sms_message ? formData.delivery_sms_message : undefined,
        delivery_sms_ai_generated: formData.delivery_method === 'sms' && formData.delivery_sms_ai_generated,
        delivery_sms_ai_instructions: formData.delivery_method === 'sms' && formData.delivery_sms_ai_generated && formData.delivery_sms_ai_instructions ? formData.delivery_sms_ai_instructions : undefined,
      })

      // Create the form if form fields are provided
      if (formFieldsData.form_fields_schema.fields.length > 0) {
        await api.createForm({
          workflow_id: workflow.workflow_id,
          form_name: formFieldsData.form_name || `Form for ${formData.workflow_name}`,
          public_slug: formFieldsData.public_slug || formData.workflow_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          form_fields_schema: formFieldsData.form_fields_schema,
          rate_limit_enabled: true,
          rate_limit_per_hour: 10,
          captcha_enabled: false,
        })
      }

      return workflow
    } catch (error: any) {
      console.error('Failed to create workflow:', error)
      setError(error.response?.data?.message || error.message || 'Failed to create workflow')
      return null
    } finally {
      if (!autoSave) {
        setSubmitting(false)
      }
    }
  }

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
    setGenerationStatus('Starting workflow generation...')

    try {
      const startTime = Date.now()
      
      // Step 1: Initiate async generation (returns 202 with job_id)
      const initResponse = await api.generateWorkflowWithAI(prompt.trim(), 'gpt-5')
      
      // Check if we got a job_id (async flow)
      if (initResponse.job_id) {
        const jobId = initResponse.job_id
        console.log('[Workflow Generation] Job created', { jobId, status: initResponse.status })
        
        setGenerationStatus('Generating your lead magnet configuration... This may take a minute.')
        
        // Step 2: Poll for completion
        let attempts = 0
        const maxAttempts = 900 // 15 minutes max (1 second intervals)
        let result: any = null
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
          
          const statusResponse = await api.getWorkflowGenerationStatus(jobId)
          console.log('[Workflow Generation] Polling status', { 
            jobId, 
            status: statusResponse.status, 
            attempt: attempts + 1 
          })
          
          if (statusResponse.status === 'completed') {
            result = statusResponse.result
            console.log('[Workflow Generation] Job completed', { result })
            break
          } else if (statusResponse.status === 'failed') {
            throw new Error(statusResponse.error_message || 'Workflow generation failed')
          } else if (statusResponse.status === 'processing') {
            setGenerationStatus(`Processing... (${attempts + 1}s)`)
          } else {
            setGenerationStatus(`Preparing... (${attempts + 1}s)`)
          }
          
          attempts++
        }
        
        if (!result) {
          throw new Error('Workflow generation timed out. Please try again.')
        }
        
        const duration = Date.now() - startTime
        console.log('[Workflow Generation] Success!', {
          duration: `${duration}ms`,
          workflow: result.workflow,
          template: result.template,
          form: result.form,
          timestamp: new Date().toISOString(),
        })

        setGenerationStatus('Generation complete! Auto-saving your lead magnet...')

        // Populate workflow fields
        setFormData(prev => ({
          ...prev,
          workflow_name: result.workflow?.workflow_name || '',
          workflow_description: result.workflow?.workflow_description || '',
          ai_instructions: result.workflow?.research_instructions || '',
        }))

        // Use generated steps if present, otherwise fall back to legacy behavior
        if (result.workflow?.steps && Array.isArray(result.workflow.steps) && result.workflow.steps.length > 0) {
          // Replace entire steps array with generated steps
          setSteps(result.workflow.steps.map((step: any) => ({
            step_name: step.step_name || 'Step',
            step_description: step.step_description || '',
            model: step.model || 'gpt-5',
            instructions: step.instructions || '',
            step_order: step.step_order !== undefined ? step.step_order : 0,
            tools: step.tools || [],
            tool_choice: step.tool_choice || 'auto',
          })))
        } else if (result.workflow?.research_instructions) {
          // Legacy format - update first step with generated instructions
          setSteps(prev => {
            const newSteps = [...prev]
            if (newSteps.length > 0) {
              newSteps[0] = {
                ...newSteps[0],
                instructions: result.workflow.research_instructions,
              }
            }
            return newSteps
          })
        }

        // Populate template fields
        setTemplateData({
          template_name: result.template?.template_name || '',
          template_description: result.template?.template_description || '',
          html_content: result.template?.html_content || '',
          placeholder_tags: result.template?.placeholder_tags || [],
        })

        // Populate form fields
        if (result.form) {
          setFormFieldsData({
            form_name: result.form.form_name || '',
            public_slug: result.form.public_slug || '',
            form_fields_schema: result.form.form_fields_schema || { fields: [] },
          })
          // Auto-show form preview when form is generated
          if (result.form.form_fields_schema?.fields?.length > 0) {
            setShowFormPreview(true)
          }
        }

        // Auto-show preview when HTML is generated
        if (result.template?.html_content) {
          setShowPreview(true)
        }

        // Move to form step
        setStep('form')

        // Auto-save the workflow immediately after generation
        try {
          const savedWorkflow = await saveWorkflow(true)
          if (savedWorkflow) {
            setGenerationStatus('Lead magnet saved successfully! You can review and edit it below.')
            setTimeout(() => {
              setGenerationStatus(null)
            }, 5000)
          } else {
            setGenerationStatus('Generation complete! Review and edit the fields below, then click Save.')
            setTimeout(() => {
              setGenerationStatus(null)
            }, 5000)
          }
        } catch (saveError) {
          console.error('Auto-save failed:', saveError)
          setGenerationStatus('Generation complete! Review and edit the fields below, then click Save.')
          setTimeout(() => {
            setGenerationStatus(null)
          }, 5000)
        }
      } else {
        // Fallback: synchronous response (legacy behavior)
        const result = initResponse
        const duration = Date.now() - startTime

        console.log('[Workflow Generation] Success!', {
          duration: `${duration}ms`,
          workflow: result.workflow,
          template: result.template,
          form: result.form,
          timestamp: new Date().toISOString(),
        })

        setGenerationStatus('Generation complete! Review and edit the fields below.')

        // Populate workflow fields
        setFormData(prev => ({
          ...prev,
          workflow_name: result.workflow?.workflow_name || '',
          workflow_description: result.workflow?.workflow_description || '',
          ai_instructions: result.workflow?.research_instructions || '',
        }))

        // Use generated steps if present, otherwise fall back to legacy behavior
        if (result.workflow?.steps && Array.isArray(result.workflow.steps) && result.workflow.steps.length > 0) {
          // Replace entire steps array with generated steps
          setSteps(result.workflow.steps.map((step: any) => ({
            step_name: step.step_name || 'Step',
            step_description: step.step_description || '',
            model: step.model || 'gpt-5',
            instructions: step.instructions || '',
            step_order: step.step_order !== undefined ? step.step_order : 0,
            tools: step.tools || [],
            tool_choice: step.tool_choice || 'auto',
          })))
        } else if (result.workflow?.research_instructions) {
          // Legacy format - update first step with generated instructions
          setSteps(prev => {
            const newSteps = [...prev]
            if (newSteps.length > 0) {
              newSteps[0] = {
                ...newSteps[0],
                instructions: result.workflow.research_instructions,
              }
            }
            return newSteps
          })
        }

        // Populate template fields
        setTemplateData({
          template_name: result.template?.template_name || '',
          template_description: result.template?.template_description || '',
          html_content: result.template?.html_content || '',
          placeholder_tags: result.template?.placeholder_tags || [],
        })

        // Populate form fields
        if (result.form) {
          setFormFieldsData({
            form_name: result.form.form_name || '',
            public_slug: result.form.public_slug || '',
            form_fields_schema: result.form.form_fields_schema || { fields: [] },
          })
          // Auto-show form preview when form is generated
          if (result.form.form_fields_schema?.fields?.length > 0) {
            setShowFormPreview(true)
          }
        }

        // Auto-show preview when HTML is generated
        if (result.template?.html_content) {
          setShowPreview(true)
        }

        // Move to form step
        setStep('form')

        // Move to form step
        setStep('form')

        setTimeout(() => {
          setGenerationStatus(null)
        }, 3000)
      }
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
    const workflow = await saveWorkflow(false)
    if (workflow) {
      router.push('/dashboard/workflows')
    }
  }

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleTemplateChange = (field: string, value: any) => {
    setTemplateData(prev => ({ ...prev, [field]: value }))
    // Auto-show preview when HTML content is added
    if (field === 'html_content' && value.trim() && !showPreview) {
      setShowPreview(true)
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
      CURRENT_YEAR: new Date().getFullYear().toString(),
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

  const handleFormFieldChange = (fieldIndex: number, field: string, value: any) => {
    setFormFieldsData(prev => {
      const newFields = [...prev.form_fields_schema.fields]
      newFields[fieldIndex] = { ...newFields[fieldIndex], [field]: value }
      return {
        ...prev,
        form_fields_schema: {
          fields: newFields,
        },
      }
    })
  }

  const handleFormNameChange = (field: string, value: any) => {
    setFormFieldsData(prev => ({ ...prev, [field]: value }))
    // Auto-show preview when form name is set
    if (field === 'form_name' && value.trim() && !showFormPreview) {
      setShowFormPreview(true)
    }
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

          {/* Workflow Steps */}
          <div className="space-y-4 pt-6 border-t">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Workflow Steps</h2>
              <button
                type="button"
                onClick={handleAddStep}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <FiPlus className="w-4 h-4" />
                Add Step
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Define the steps your workflow will execute. Each step receives context from all previous steps.
            </p>
            
            <div className="space-y-4">
              {steps.map((step, index) => (
                <WorkflowStepEditor
                  key={index}
                  step={step}
                  index={index}
                  totalSteps={steps.length}
                  onChange={handleStepChange}
                  onDelete={handleDeleteStep}
                  onMoveUp={handleMoveStepUp}
                  onMoveDown={handleMoveStepDown}
                />
              ))}
            </div>
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
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
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
                />
              </div>
            )}
          </div>
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
              
              {/* Preview Section */}
              {templateData.html_content.trim() && (
                <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
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
                        key={`preview-${templateData.html_content.length}-${templateData.html_content.slice(0, 50)}`}
                        srcDoc={getPreviewHtml()}
                        className="w-full h-full border-0"
                        title="HTML Preview"
                        sandbox="allow-same-origin allow-scripts"
                      />
                    </div>
                  )}
                </div>
              )}
              
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

        {/* Form Fields */}
        {formFieldsData.form_fields_schema.fields.length > 0 && (
          <div className="space-y-6 pt-6 border-t">
            <h2 className="text-xl font-semibold text-gray-900 border-b pb-2">Lead Capture Form</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Form Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formFieldsData.form_name}
                onChange={(e) => handleFormNameChange('form_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Lead Capture Form"
                maxLength={200}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Public Slug <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formFieldsData.public_slug}
                onChange={(e) => handleFormNameChange('public_slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                placeholder="lead-capture-form"
                pattern="[a-z0-9\-]+"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                URL-friendly identifier (lowercase, hyphens only). Forms will be accessible at /v1/forms/{formFieldsData.public_slug || '[slug]'}
              </p>
            </div>

            {/* Form Preview */}
            {formFieldsData.form_fields_schema.fields.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center">
                    <FiEye className="w-4 h-4 mr-2" />
                    Form Preview
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowFormPreview(!showFormPreview)}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    {showFormPreview ? 'Hide Preview' : 'Show Preview'}
                  </button>
                </div>
                {showFormPreview && (
                  <div className="bg-white p-6">
                    <h3 className="text-lg font-semibold mb-4">{formFieldsData.form_name || 'Form Preview'}</h3>
                    <div className="space-y-4">
                      {formFieldsData.form_fields_schema.fields.map((field: any, index: number) => (
                        <div key={field.field_id || index}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {field.label || `Field ${index + 1}`}
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
                              <option value="">Select {field.label}</option>
                              {field.options.map((option: string, optIndex: number) => (
                                <option key={optIndex} value={option}>{option}</option>
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
                        className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                        disabled
                      >
                        Submit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Form Fields List */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Form Fields ({formFieldsData.form_fields_schema.fields.length})
              </label>
              <div className="space-y-4">
                {formFieldsData.form_fields_schema.fields.map((field: any, index: number) => (
                  <div key={field.field_id || index} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
                        <input
                          type="text"
                          value={field.label || ''}
                          onChange={(e) => handleFormFieldChange(index, 'label', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="Field Label"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                        <select
                          value={field.field_type || 'text'}
                          onChange={(e) => handleFormFieldChange(index, 'field_type', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="text">Text</option>
                          <option value="email">Email</option>
                          <option value="tel">Phone</option>
                          <option value="textarea">Textarea</option>
                          <option value="select">Select</option>
                          <option value="number">Number</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Placeholder</label>
                        <input
                          type="text"
                          value={field.placeholder || ''}
                          onChange={(e) => handleFormFieldChange(index, 'placeholder', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="Placeholder text"
                        />
                      </div>
                      <div className="flex items-center">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={field.required || false}
                            onChange={(e) => handleFormFieldChange(index, 'required', e.target.checked)}
                            className="mr-2"
                          />
                          <span className="text-xs font-medium text-gray-600">Required</span>
                        </label>
                      </div>
                    </div>
                    {field.field_type === 'select' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Options (comma-separated)</label>
                        <input
                          type="text"
                          value={field.options?.join(', ') || ''}
                          onChange={(e) => handleFormFieldChange(index, 'options', e.target.value.split(',').map((o: string) => o.trim()).filter(Boolean))}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="Option 1, Option 2, Option 3"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Delivery Configuration */}
        <div className="space-y-6 pt-6 border-t">
          <h2 className="text-xl font-semibold text-gray-900 border-b pb-2">Delivery Configuration</h2>
          <p className="text-sm text-gray-600">
            Configure how completed lead magnets are delivered to leads. Choose webhook or SMS delivery.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Delivery Method
            </label>
            <select
              value={formData.delivery_method}
              onChange={(e) => handleChange('delivery_method', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="none">No Delivery (Manual)</option>
              <option value="webhook">Webhook</option>
              <option value="sms">SMS (Twilio)</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Select how you want to deliver the completed lead magnet to the lead
            </p>
          </div>

          {/* Webhook Configuration */}
          {formData.delivery_method === 'webhook' && (
            <div className="space-y-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900">Webhook Configuration</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Webhook URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={formData.delivery_webhook_url}
                  onChange={(e) => handleChange('delivery_webhook_url', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="https://api.example.com/webhook"
                  required={formData.delivery_method === 'webhook'}
                />
                <p className="mt-1 text-xs text-gray-500">
                  The webhook will receive a POST request with job details, submission data, and output URL
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Headers (Optional)
                </label>
                <textarea
                  value={JSON.stringify(formData.delivery_webhook_headers, null, 2)}
                  onChange={(e) => {
                    try {
                      const headers = JSON.parse(e.target.value)
                      handleChange('delivery_webhook_headers', headers)
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                  placeholder='{\n  "Authorization": "Bearer token",\n  "X-Custom-Header": "value"\n}'
                  rows={4}
                />
                <p className="mt-1 text-xs text-gray-500">
                  JSON object with custom headers to include in webhook requests
                </p>
              </div>
            </div>
          )}

          {/* SMS Configuration */}
          {formData.delivery_method === 'sms' && (
            <div className="space-y-4 bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900">SMS Configuration</h3>
              
              <div>
                <label className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    checked={formData.delivery_sms_ai_generated}
                    onChange={(e) => handleChange('delivery_sms_ai_generated', e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Use AI-Generated SMS Message</span>
                </label>
                <p className="text-xs text-gray-500 ml-6">
                  AI will generate a personalized SMS message based on the lead magnet content
                </p>
              </div>

              {formData.delivery_sms_ai_generated ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    AI SMS Instructions (Optional)
                  </label>
                  <textarea
                    value={formData.delivery_sms_ai_instructions}
                    onChange={(e) => handleChange('delivery_sms_ai_instructions', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Example: Keep it friendly and under 160 characters. Include the lead's name and make it personal."
                    rows={3}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Optional instructions for AI SMS generation. If empty, defaults to friendly message with URL.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SMS Message Template
                  </label>
                  <textarea
                    value={formData.delivery_sms_message}
                    onChange={(e) => handleChange('delivery_sms_message', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Hi {name}! Your personalized report is ready: {output_url}"
                    rows={3}
                    maxLength={320}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Use placeholders: {'{name}'}, {'{output_url}'}, {'{job_id}'}. Max 160 characters per SMS.
                  </p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> Twilio credentials must be configured in AWS Secrets Manager (us-east-1) for SMS delivery to work.
                </p>
              </div>
            </div>
          )}
        </div>

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
