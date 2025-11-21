'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/shared/lib/api'
import { AIModel, WorkflowStep } from '@/features/workflows/types'
import { useWorkflowEdit } from '@/features/workflows/hooks/useWorkflowEdit'
import { useFormEdit } from '@/features/forms/hooks/useFormEdit'
import { useTemplateEdit } from '@/features/templates/hooks/useTemplateEdit'
import { extractPlaceholders } from '@/features/templates/utils/templateUtils'
import { FiPlus, FiTrash2, FiSave } from 'react-icons/fi'

const MODELS: AIModel[] = ['gpt-5', 'gpt-4.1', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo']

export default function EditWorkflowClient() {
  const router = useRouter()
  const [templateId, setTemplateId] = useState<string | null>(null)

  const workflowEdit = useWorkflowEdit()
  const {
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
    handleChange,
    handleAddStep,
    handleDeleteStep,
    router: workflowRouter,
  } = workflowEdit

  const formEdit = useFormEdit(formData.workflow_name, formId, workflowForm)
  const {
    formFormData,
    handleFormChange,
    handleFieldChange,
    addField,
    removeField,
  } = formEdit

  const templateEdit = useTemplateEdit(formData.workflow_name, templateId, formData.template_id)
  const {
    templateLoading,
    templateData,
    handleTemplateChange,
  } = templateEdit

  useEffect(() => {
    if (formData.template_id && !templateId) {
      setTemplateId(formData.template_id)
    }
  }, [formData.template_id, templateId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.workflow_name.trim()) {
      setError('Lead magnet name is required')
      return
    }

    if (steps.length === 0) {
      setError('At least one step is required')
      return
    }

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      if (!step.step_name.trim()) {
        setError(`Step ${i + 1} name is required`)
        return
      }
      if (step.step_type !== 'webhook' && (!step.instructions || !step.instructions.trim())) {
        setError(`Step ${i + 1} instructions are required`)
        return
      }
    }

    setSubmitting(true)

    try {
      let finalTemplateId = templateId
      if (templateData.html_content.trim()) {
        const placeholders = extractPlaceholders(templateData.html_content)
        
        if (templateId) {
          await api.updateTemplate(templateId, {
            template_name: templateData.template_name.trim(),
            template_description: templateData.template_description.trim(),
            html_content: templateData.html_content.trim(),
            placeholder_tags: placeholders.length > 0 ? placeholders : undefined,
          })
        } else {
          const template = await api.createTemplate({
            template_name: templateData.template_name.trim(),
            template_description: templateData.template_description.trim(),
            html_content: templateData.html_content.trim(),
            placeholder_tags: placeholders.length > 0 ? placeholders : undefined,
          })
          finalTemplateId = template.template_id
          setTemplateId(template.template_id)
        }
      }

      await api.updateWorkflow(workflowId, {
        workflow_name: formData.workflow_name.trim(),
        workflow_description: formData.workflow_description.trim() || undefined,
        steps: steps.map((step, index) => ({
            ...step,
            step_order: index,
            model: step.model as AIModel,
        })),
        template_id: finalTemplateId || undefined,
        template_version: 0,
      })

      if (formId) {
        await api.updateForm(formId, {
          form_name: formFormData.form_name.trim(),
          public_slug: formFormData.public_slug.trim(),
          form_fields_schema: formFormData.form_fields_schema as any,
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

  const updateStep = (index: number, field: string, value: any) => {
    const newSteps = [...steps]
    newSteps[index] = { ...newSteps[index], [field]: value }
    setSteps(newSteps)
  }

  if (loading || templateLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <p className="text-ink-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900">Edit Lead Magnet</h1>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info */}
        <div className="bg-white rounded-2xl border border-white/60 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.workflow_name}
              onChange={(e) => handleChange('workflow_name', e.target.value)}
              className="w-full px-4 py-2 border border-white/60 rounded-2xl bg-white/90 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.workflow_description}
              onChange={(e) => handleChange('workflow_description', e.target.value)}
              className="w-full px-4 py-2 border border-white/60 rounded-2xl bg-white/90 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              rows={3}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="bg-white rounded-2xl border border-white/60 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-ink-900">Steps</h2>
            <button
              type="button"
              onClick={handleAddStep}
              className="flex items-center px-3 py-1.5 bg-brand-600 text-white rounded-2xl hover:bg-brand-700 text-sm"
            >
              <FiPlus className="w-4 h-4 mr-1" />
              Add Step
            </button>
          </div>
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={index} className="border border-white/60 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-ink-700 mb-1">
                        Step Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={step.step_name}
                        onChange={(e) => updateStep(index, 'step_name', e.target.value)}
                        className="w-full px-3 py-2 border border-white/60 rounded-2xl bg-white/90 focus:ring-2 focus:ring-brand-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-700 mb-1">
                        Model
                      </label>
                      <select
                        value={step.model}
                        onChange={(e) => updateStep(index, 'model', e.target.value)}
                        className="w-full px-3 py-2 border border-white/60 rounded-2xl bg-white/90 focus:ring-2 focus:ring-brand-500"
                      >
                        {MODELS.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-700 mb-1">
                        Instructions <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={step.instructions}
                        onChange={(e) => updateStep(index, 'instructions', e.target.value)}
                        className="w-full px-3 py-2 border border-white/60 rounded-2xl bg-white/90 focus:ring-2 focus:ring-brand-500"
                        rows={4}
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteStep(index)}
                    className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-2xl"
                  >
                    <FiTrash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Form Section */}
        {formId && (
          <div className="bg-white rounded-2xl border border-white/60 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-ink-900">Form</h2>
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">
                Form Name
              </label>
              <input
                type="text"
                value={formFormData.form_name}
                onChange={(e) => handleFormChange('form_name', e.target.value)}
                className="w-full px-4 py-2 border border-white/60 rounded-2xl bg-white/90 focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-ink-700">
                  Fields
                </label>
                <button
                  type="button"
                  onClick={addField}
                  className="flex items-center px-3 py-1.5 bg-brand-600 text-white rounded-2xl hover:bg-brand-700 text-sm"
                >
                  <FiPlus className="w-4 h-4 mr-1" />
                  Add Field
                </button>
              </div>
              <div className="space-y-3">
                {formFormData.form_fields_schema.fields.map((field, index) => (
                  <div key={index} className="flex gap-2 items-start border border-white/60 rounded-2xl p-3">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => handleFieldChange(index, 'label', e.target.value)}
                        placeholder="Label"
                        className="px-3 py-2 border border-white/60 rounded-2xl bg-white/90 focus:ring-2 focus:ring-brand-500"
                      />
                      <select
                        value={field.field_type}
                        onChange={(e) => handleFieldChange(index, 'field_type', e.target.value)}
                        className="px-3 py-2 border border-white/60 rounded-2xl bg-white/90 focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="text">Text</option>
                        <option value="email">Email</option>
                        <option value="textarea">Textarea</option>
                        <option value="number">Number</option>
                        <option value="select">Select</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeField(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-2xl"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Template Section */}
        {(templateId || templateData.html_content.trim()) && (
          <div className="bg-white rounded-2xl border border-white/60 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-ink-900">Template</h2>
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">
                Template Name
              </label>
              <input
                type="text"
                value={templateData.template_name}
                onChange={(e) => handleTemplateChange('template_name', e.target.value)}
                className="w-full px-4 py-2 border border-white/60 rounded-2xl bg-white/90 focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">
                HTML Content
              </label>
              <textarea
                value={templateData.html_content}
                onChange={(e) => handleTemplateChange('html_content', e.target.value)}
                className="w-full px-4 py-2 border border-white/60 rounded-2xl bg-white/90 focus:ring-2 focus:ring-brand-500 font-mono text-sm"
                rows={20}
              />
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 border border-white/60 rounded-2xl hover:bg-white/90"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center px-6 py-2.5 bg-brand-600 text-white rounded-2xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiSave className="w-5 h-5 mr-2" />
            {submitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
