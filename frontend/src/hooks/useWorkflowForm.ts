'use client'

import { useState, useCallback } from 'react'
import { WorkflowStep } from '@/app/dashboard/workflows/components/WorkflowStepEditor'

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
  delivery_method: 'webhook' | 'sms' | 'none'
  delivery_webhook_url: string
  delivery_webhook_headers: Record<string, string>
  delivery_sms_enabled: boolean
  delivery_sms_message: string
  delivery_sms_ai_generated: boolean
  delivery_sms_ai_instructions: string
}

export interface TemplateData {
  template_name: string
  template_description: string
  html_content: string
  placeholder_tags: string[]
}

export interface FormFieldsData {
  form_name: string
  public_slug: string
  form_fields_schema: {
    fields: any[]
  }
}

const defaultFormData: WorkflowFormData = {
  workflow_name: '',
  workflow_description: '',
  ai_model: 'o3-deep-research',
  ai_instructions: '',
  rewrite_model: 'gpt-5',
  research_enabled: true,
  html_enabled: true,
  template_id: '',
  template_version: 0,
  delivery_method: 'none',
  delivery_webhook_url: '',
  delivery_webhook_headers: {},
  delivery_sms_enabled: false,
  delivery_sms_message: '',
  delivery_sms_ai_generated: false,
  delivery_sms_ai_instructions: '',
}

const defaultTemplateData: TemplateData = {
  template_name: '',
  template_description: '',
  html_content: '',
  placeholder_tags: [],
}

const defaultFormFieldsData: FormFieldsData = {
  form_name: '',
  public_slug: '',
  form_fields_schema: {
    fields: [],
  },
}

export function useWorkflowForm() {
  const [formData, setFormData] = useState<WorkflowFormData>(defaultFormData)
  const [templateData, setTemplateData] = useState<TemplateData>(defaultTemplateData)
  const [formFieldsData, setFormFieldsData] = useState<FormFieldsData>(defaultFormFieldsData)

  const updateFormData = useCallback((field: keyof WorkflowFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  const updateTemplateData = useCallback((field: keyof TemplateData, value: any) => {
    setTemplateData(prev => ({ ...prev, [field]: value }))
  }, [])

  const updateFormFieldsData = useCallback((field: keyof FormFieldsData, value: any) => {
    setFormFieldsData(prev => ({ ...prev, [field]: value }))
  }, [])

  const updateFormField = useCallback((fieldIndex: number, field: string, value: any) => {
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
  }, [])

  const populateFromAIGeneration = useCallback((result: {
    workflow?: {
      workflow_name?: string
      workflow_description?: string
      research_instructions?: string
      steps?: WorkflowStep[]
    }
    template?: {
      template_name?: string
      template_description?: string
      html_content?: string
      placeholder_tags?: string[]
    }
    form?: {
      form_name?: string
      public_slug?: string
      form_fields_schema?: {
        fields: any[]
      }
    }
  }) => {
    if (result.workflow) {
      setFormData(prev => ({
        ...prev,
        workflow_name: result.workflow?.workflow_name || prev.workflow_name,
        workflow_description: result.workflow?.workflow_description || prev.workflow_description,
        ai_instructions: result.workflow?.research_instructions || prev.ai_instructions,
      }))
    }

    if (result.template) {
      setTemplateData({
        template_name: result.template?.template_name || '',
        template_description: result.template?.template_description || '',
        html_content: result.template?.html_content || '',
        placeholder_tags: result.template?.placeholder_tags || [],
      })
    }

    if (result.form) {
      setFormFieldsData({
        form_name: result.form.form_name || '',
        public_slug: result.form.public_slug || '',
        form_fields_schema: result.form.form_fields_schema || { fields: [] },
      })
    }
  }, [])

  const reset = useCallback(() => {
    setFormData(defaultFormData)
    setTemplateData(defaultTemplateData)
    setFormFieldsData(defaultFormFieldsData)
  }, [])

  return {
    formData,
    templateData,
    formFieldsData,
    updateFormData,
    updateTemplateData,
    updateFormFieldsData,
    updateFormField,
    populateFromAIGeneration,
    reset,
  }
}

