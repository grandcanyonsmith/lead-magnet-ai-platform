'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { AIModel, Tool } from '@/types'
import { WorkflowStep } from '@/app/dashboard/workflows/components/WorkflowStepEditor'
import { useWorkflowId } from './useWorkflowId'

export interface WorkflowFormData {
  workflow_name: string
  workflow_description: string
  ai_model: string
  ai_instructions: string
  rewrite_model: string
  research_enabled: boolean
  html_enabled: boolean
  template_id: string
  template_version: number
}

export function useWorkflowEdit() {
  const router = useRouter()
  const workflowId = useWorkflowId()
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState<WorkflowFormData>({
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

  const [steps, setSteps] = useState<WorkflowStep[]>([])
  const [formId, setFormId] = useState<string | null>(null)

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
        const loadedSteps = workflow.steps.map((step: any, index: number) => {
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

      if (workflow.form) {
        setFormId(workflow.form.form_id)
      }
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
    handleChange,
    handleStepChange,
    handleAddStep,
    handleDeleteStep,
    handleMoveStepUp,
    handleMoveStepDown,
    router,
  }
}

