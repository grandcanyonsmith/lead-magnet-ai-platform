'use client'

import { useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { AIModel } from '@/types'
import { WorkflowFormData, TemplateData, FormFieldsData } from './useWorkflowForm'
import { WorkflowStep } from '@/app/dashboard/workflows/components/WorkflowStepEditor'

export function useWorkflowSubmission() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submitWorkflow = useCallback(async (
    formData: WorkflowFormData,
    steps: WorkflowStep[],
    templateData: TemplateData,
    formFieldsData: FormFieldsData,
    generatedTemplateId: string | null,
    setGeneratedTemplateId: (id: string) => void,
    autoSave: boolean = false
  ) => {
    setError(null)

    if (!autoSave) {
      setIsSubmitting(true)
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
          })
          templateId = generatedTemplateId
        }
      }

      // Then create the workflow with steps
      const workflow = await api.createWorkflow({
        workflow_name: formData.workflow_name.trim(),
        workflow_description: formData.workflow_description?.trim() || '',
        steps: steps.map((step, index) => ({
          ...step,
          step_order: index,
          model: step.model as any,
          tools: step.tools as any,
        })),
        // Keep legacy fields for backward compatibility (will be auto-migrated)
        ai_model: formData.ai_model as AIModel,
        ai_instructions: steps[0]?.instructions || formData.ai_instructions.trim() || '',
        rewrite_model: formData.rewrite_model as AIModel,
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
    } catch (err: any) {
      console.error('Failed to create workflow:', err)
      setError(err.response?.data?.message || err.message || 'Failed to create workflow')
      return null
    } finally {
      if (!autoSave) {
        setIsSubmitting(false)
      }
    }
  }, [])

  return {
    submitWorkflow,
    isSubmitting,
    error,
  }
}

