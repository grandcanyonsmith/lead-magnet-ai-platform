'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/shared/lib/api'
import { AIModel, Tool } from '@/shared/types'
import { WorkflowStep } from '@/features/workflows/types'
import { useWorkflowId } from './useWorkflowId'
import { WorkflowFormData } from './useWorkflowForm'

export function useWorkflowEdit() {
  const router = useRouter()
  const workflowId = useWorkflowId()
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState<WorkflowFormData>({
    workflow_name: '',
    workflow_description: '',
    template_id: '',
    template_version: 0,
    delivery_method: 'none',
    delivery_webhook_url: '',
    delivery_webhook_headers: {},
    delivery_sms_enabled: false,
    delivery_sms_message: '',
    delivery_sms_ai_generated: false,
    delivery_sms_ai_instructions: '',
  })

  const [steps, setSteps] = useState<WorkflowStep[]>([])
  const [formId, setFormId] = useState<string | null>(null)
  const [workflowForm, setWorkflowForm] = useState<any>(null)
  const [workflowStatus, setWorkflowStatus] = useState<'active' | 'inactive' | 'draft' | null>(null)

  useEffect(() => {
    if (workflowId) {
      loadWorkflow()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId])

  const loadWorkflow = async () => {
    try {
      const workflow = await api.getWorkflow(workflowId)
      const workflowAny = workflow as any
      setFormData({
        workflow_name: workflow.workflow_name || '',
        workflow_description: workflow.workflow_description || '',
        template_id: workflow.template_id || '',
        template_version: workflow.template_version || 0,
        delivery_method: (workflowAny.delivery_method as 'webhook' | 'sms' | 'none') || 'none',
        delivery_webhook_url: workflowAny.delivery_webhook_url || '',
        delivery_webhook_headers: workflowAny.delivery_webhook_headers || {},
        delivery_sms_enabled: workflowAny.delivery_sms_enabled || false,
        delivery_sms_message: workflowAny.delivery_sms_message || '',
        delivery_sms_ai_generated: workflowAny.delivery_sms_ai_generated || false,
        delivery_sms_ai_instructions: workflowAny.delivery_sms_ai_instructions || '',
      })

      // Load steps - all workflows must have steps
      if (!workflow.steps || workflow.steps.length === 0) {
        throw new Error('Workflow has no steps. Legacy format is no longer supported.')
      }
      
      const loadedSteps = workflow.steps.map((step: any, index: number) => {
        let defaultInstructions = ''
        if (step.step_name && step.step_name.toLowerCase().includes('html')) {
          defaultInstructions = 'Rewrite the content into styled HTML matching the provided template. Ensure the output is complete, valid HTML that matches the template\'s design and structure.'
        } else if (step.step_name && step.step_name.toLowerCase().includes('research')) {
          defaultInstructions = 'Generate a comprehensive research report based on the form submission data.'
        } else {
          defaultInstructions = 'Process the input data according to the workflow requirements.'
        }
        
        const stepType = step.step_type || 'ai_generation'
        
        return {
          step_name: step.step_name || `Step ${index + 1}`,
          step_description: step.step_description || '',
          step_type: stepType,
          model: step.model || 'gpt-5',
          instructions: step.instructions?.trim() || (stepType === 'webhook' ? '' : defaultInstructions),
          step_order: step.step_order !== undefined ? step.step_order : index,
          tools: step.tools || (stepType === 'webhook' ? [] : ['web_search_preview']),
          tool_choice: step.tool_choice || 'auto',
          depends_on: step.depends_on || [],
          // Webhook step fields
          webhook_url: step.webhook_url || '',
          webhook_headers: step.webhook_headers || {},
          webhook_custom_payload: step.webhook_custom_payload,
          webhook_data_selection: step.webhook_data_selection || (stepType === 'webhook' ? {
            include_submission: true,
            exclude_step_indices: [],
            include_job_info: true
          } : undefined),
        }
      })
      setSteps(loadedSteps)

      if (workflow.form) {
        setFormId(workflow.form.form_id)
        setWorkflowForm(workflow.form)
      }
      
      // Store workflow status
      setWorkflowStatus(workflow.status || 'active')
    } catch (error: any) {
      console.error('Failed to load workflow:', error)
      setError(error.response?.data?.message || error.message || 'Failed to load workflow')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

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
        step_type: 'ai_generation',
        model: 'gpt-5',
        instructions: '',
        step_order: prev.length,
        tools: ['web_search_preview'],
        tool_choice: 'auto',
        depends_on: [],
      },
    ])
  }

  const handleDeleteStep = (index: number) => {
    setSteps(prev => {
      const newSteps = prev.filter((_, i) => i !== index)
      return newSteps.map((step, i) => ({ ...step, step_order: i }))
    })
  }

  const handleMoveStepUp = (index: number) => {
    if (index === 0) return
    setSteps(prev => {
      const newSteps = [...prev]
      ;[newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]]
      return newSteps.map((step, i) => ({ ...step, step_order: i }))
    })
  }

  const handleMoveStepDown = (index: number) => {
    if (index === steps.length - 1) return
    setSteps(prev => {
      const newSteps = [...prev]
      ;[newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]]
      return newSteps.map((step, i) => ({ ...step, step_order: i }))
    })
  }

  return {
    workflowId,
    loading,
    submitting,
    setSubmitting,
    error,
    setError,
    formData,
    setFormData,
    steps,
    setSteps,
    formId,
    workflowForm,
    workflowStatus,
    handleChange,
    handleStepChange,
    handleAddStep,
    handleDeleteStep,
    handleMoveStepUp,
    handleMoveStepDown,
    router,
  }
}

