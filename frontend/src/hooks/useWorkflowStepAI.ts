'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { WorkflowStep } from '@/types/workflow'

export interface AIStepGenerationResult {
  action: 'update' | 'add'
  step_index?: number
  step: WorkflowStep
}

export interface AIStepProposal {
  original?: WorkflowStep
  proposed: WorkflowStep
  action: 'update' | 'add'
  step_index?: number
}

export function useWorkflowStepAI(workflowId?: string) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proposal, setProposal] = useState<AIStepProposal | null>(null)

  const generateStep = async (
    userPrompt: string,
    currentStep?: WorkflowStep,
    currentStepIndex?: number,
    suggestedAction?: 'update' | 'add'
  ) => {
    if (!workflowId) {
      setError('Workflow ID is required for AI generation')
      return null
    }

    setIsGenerating(true)
    setError(null)
    setProposal(null)

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('[useWorkflowStepAI] Generating step', {
          workflowId,
          promptLength: userPrompt.length,
          action: suggestedAction,
          hasCurrentStep: !!currentStep,
        })
      }

      const result = await api.generateStepWithAI(workflowId, {
        userPrompt,
        action: suggestedAction,
        currentStep,
        currentStepIndex,
      })

      if (process.env.NODE_ENV === 'development') {
        console.log('[useWorkflowStepAI] Generation successful', {
          action: result.action,
          stepName: result.step.step_name,
        })
      }

      // Create proposal for review
      const aiProposal: AIStepProposal = {
        original: currentStep,
        proposed: result.step,
        action: result.action,
        step_index: result.step_index,
      }

      setProposal(aiProposal)
      return aiProposal
    } catch (err: any) {
      console.error('[useWorkflowStepAI] Generation failed', {
        error: err.message,
      })
      setError(err.message || 'Failed to generate step. Please try again.')
      return null
    } finally {
      setIsGenerating(false)
    }
  }

  const acceptProposal = () => {
    const currentProposal = proposal
    setProposal(null)
    return currentProposal
  }

  const rejectProposal = () => {
    setProposal(null)
  }

  const retry = async (
    userPrompt: string,
    currentStep?: WorkflowStep,
    currentStepIndex?: number,
    suggestedAction?: 'update' | 'add'
  ) => {
    return await generateStep(userPrompt, currentStep, currentStepIndex, suggestedAction)
  }

  return {
    isGenerating,
    error,
    proposal,
    generateStep,
    acceptProposal,
    rejectProposal,
    retry,
  }
}
