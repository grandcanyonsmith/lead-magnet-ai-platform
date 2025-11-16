'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FiSave, FiZap, FiPlus } from 'react-icons/fi'
import WorkflowStepEditor from '../components/WorkflowStepEditor'
import { WorkflowBasicFields } from '@/features/workflows/components/workflows/WorkflowBasicFields'
import { TemplateEditor } from '@/features/workflows/components/workflows/TemplateEditor'
import { FormFieldsEditor } from '@/features/workflows/components/workflows/FormFieldsEditor'
import { DeliveryConfig } from '@/features/workflows/components/workflows/DeliveryConfig'
import { useAIGeneration } from '@/features/workflows/hooks/useAIGeneration'
import { useWorkflowForm } from '@/features/workflows/hooks/useWorkflowForm'
import { useWorkflowSteps } from '@/features/workflows/hooks/useWorkflowSteps'
import { useWorkflowValidation } from '@/features/workflows/hooks/useWorkflowValidation'
import { useWorkflowSubmission } from '@/features/workflows/hooks/useWorkflowSubmission'
import { useWorkflowGenerationStatus } from '@/features/workflows/hooks/useWorkflowGenerationStatus'

export default function NewWorkflowPage() {
  const router = useRouter()
  const [step, setStep] = useState<'prompt' | 'form' | 'creating'>('prompt')
  const [prompt, setPrompt] = useState('')
  const [generatedTemplateId, setGeneratedTemplateId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generationJobId, setGenerationJobId] = useState<string | null>(null)

  // Hooks
  const aiGeneration = useAIGeneration()
  const workflowForm = useWorkflowForm()
  const workflowSteps = useWorkflowSteps()
  const validation = useWorkflowValidation(workflowForm.formData, workflowSteps.steps, workflowForm.templateData)
  const submission = useWorkflowSubmission()
  const generationStatus = useWorkflowGenerationStatus(generationJobId)

  // Handle AI generation result
  useEffect(() => {
    if (aiGeneration.result) {
      const result = aiGeneration.result
      
      // Populate form data
      workflowForm.populateFromAIGeneration(result)
      
      // Populate steps
      if (result.workflow?.steps && Array.isArray(result.workflow.steps) && result.workflow.steps.length > 0) {
        workflowSteps.setStepsFromAIGeneration(result.workflow.steps)
      } else if (result.workflow?.research_instructions) {
        workflowSteps.updateFirstStepInstructions(result.workflow.research_instructions)
      }
      
      // Move to form step
      setStep('form')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiGeneration.result])

  // Set error from hooks
  useEffect(() => {
    if (aiGeneration.error) {
      setError(aiGeneration.error)
    }
    if (submission.error) {
      setError(submission.error)
    }
  }, [aiGeneration.error, submission.error])

  const handleGenerateWithAI = async () => {
    if (!prompt.trim()) {
      setError('Please describe what you want to build a lead magnet for')
      return
    }

    setError(null)
    setStep('creating')
    const result = await aiGeneration.generateWorkflow(prompt.trim(), 'gpt-5')
    
    if (result && result.job_id) {
      // Store job_id for status tracking
      setGenerationJobId(result.job_id)
    } else if (result) {
      // Fallback: synchronous result (legacy behavior)
      // Auto-save will be handled by useEffect
      aiGeneration.generationStatus && setTimeout(() => {
        // Status will be cleared by hook
          }, 5000)
    }
  }

  // Handle generation status changes
  useEffect(() => {
    if (generationStatus.status === 'completed' && generationStatus.workflowId) {
      // Navigation is handled by useWorkflowGenerationStatus hook
      // Just clear the creating state
      setStep('form')
    } else if (generationStatus.status === 'failed') {
      setError(generationStatus.error || 'Workflow generation failed')
      setStep('prompt')
      setGenerationJobId(null)
    }
  }, [generationStatus.status, generationStatus.workflowId, generationStatus.error])


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate
    if (!validation.valid) {
      setError(validation.errors[0])
      return
    }

    setError(null)
    const workflow = await submission.submitWorkflow(
      workflowForm.formData,
      workflowSteps.steps,
      workflowForm.templateData,
      workflowForm.formFieldsData,
      generatedTemplateId,
      setGeneratedTemplateId,
      false
    )
    
    if (workflow) {
      router.push('/dashboard/workflows')
    }
  }

  // Creating Step
  if (step === 'creating') {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Creating Your Lead Magnet</h1>
          <p className="text-gray-600">AI is generating your lead magnet configuration...</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-8 text-center">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600"></div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {aiGeneration.generationStatus || 'Creating your lead magnet...'}
                </h3>
                <p className="text-sm text-gray-600">
                  This may take a minute. We&apos;ll automatically take you to the edit page when it&apos;s ready.
                </p>
                {generationJobId && (
                  <p className="text-xs text-gray-500 mt-2 font-mono">
                    Job ID: {generationJobId}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Prompt Step
  if (step === 'prompt') {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
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
              <FiZap className={`w-5 h-5 mr-2 text-purple-600 ${aiGeneration.isGenerating ? 'animate-pulse' : ''}`} />
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
                disabled={aiGeneration.isGenerating}
              />
              
              {aiGeneration.generationStatus && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
                  <span className="text-sm text-blue-800 font-medium">{aiGeneration.generationStatus}</span>
                </div>
              )}
              
              <button
                type="button"
                onClick={handleGenerateWithAI}
                disabled={aiGeneration.isGenerating || !prompt.trim()}
                className="flex items-center justify-center px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              >
                {aiGeneration.isGenerating ? (
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
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create Lead Magnet</h1>
        <p className="text-gray-600">Review and edit the generated configuration</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {aiGeneration.generationStatus && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {aiGeneration.generationStatus}
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

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6" data-tour="workflow-form">
        {/* Workflow Basic Fields */}
        <WorkflowBasicFields
          formData={workflowForm.formData}
          onChange={workflowForm.updateFormData}
        />

          {/* Workflow Steps */}
          <div className="space-y-4 pt-6 border-t" data-tour="workflow-steps">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Workflow Steps</h2>
              <button
                type="button"
              onClick={workflowSteps.addStep}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors touch-target"
              >
                <FiPlus className="w-4 h-4" />
                Add Step
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Define the steps your workflow will execute. Each step receives context from all previous steps.
            </p>
            
            <div className="space-y-4">
            {workflowSteps.steps.map((step, index) => (
                <WorkflowStepEditor
                  key={index}
                  step={step}
                  index={index}
                totalSteps={workflowSteps.steps.length}
                allSteps={workflowSteps.steps}
                onChange={workflowSteps.updateStep}
                onDelete={workflowSteps.deleteStep}
                onMoveUp={workflowSteps.moveStepUp}
                onMoveDown={workflowSteps.moveStepDown}
                />
              ))}
            </div>
          </div>

        {/* Template Editor */}
        {(workflowForm.formData.template_id || workflowForm.templateData.html_content.trim()) && (
          <TemplateEditor
            templateData={workflowForm.templateData}
            onChange={workflowForm.updateTemplateData}
          />
        )}

        {/* Form Fields Editor */}
        {workflowForm.formFieldsData.form_fields_schema.fields.length > 0 && (
          <FormFieldsEditor
            formFieldsData={workflowForm.formFieldsData}
            onChange={workflowForm.updateFormFieldsData}
            onFieldChange={workflowForm.updateFormField}
          />
        )}

        {/* Delivery Configuration */}
        <DeliveryConfig
          formData={workflowForm.formData}
          onChange={workflowForm.updateFormData}
        />

        <div className="flex justify-end space-x-4 pt-4 border-t">
          <button
            type="submit"
            disabled={submission.isSubmitting}
            className="flex items-center px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-tour="create-workflow-button"
          >
            <FiSave className="w-5 h-5 mr-2" />
            {submission.isSubmitting ? 'Creating...' : 'Create Lead Magnet'}
          </button>
        </div>
      </form>
    </div>
  )
}
