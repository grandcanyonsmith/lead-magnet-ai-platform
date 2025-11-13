'use client'

import { useState, useCallback } from 'react'
import { WorkflowStep } from '@/app/dashboard/workflows/components/WorkflowStepEditor'

const defaultSteps: WorkflowStep[] = [
  {
    step_name: 'Deep Research',
    step_description: 'Generate comprehensive research report',
    model: 'gpt-5',
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
]

export function useWorkflowSteps(initialSteps?: WorkflowStep[]) {
  const [steps, setSteps] = useState<WorkflowStep[]>(initialSteps || defaultSteps)

  const updateStep = useCallback((index: number, step: WorkflowStep) => {
    setSteps(prev => {
      const newSteps = [...prev]
      newSteps[index] = { ...step, step_order: index }
      return newSteps
    })
  }, [])

  const addStep = useCallback(() => {
    setSteps(prev => [
      ...prev,
      {
        step_name: `Step ${prev.length + 1}`,
        step_description: '',
        step_type: 'ai_generation',
        model: 'gpt-5',
        instructions: '',
        step_order: prev.length,
        tools: [],
        tool_choice: 'auto',
      },
    ])
  }, [])

  const deleteStep = useCallback((index: number) => {
    setSteps(prev => {
      const newSteps = prev.filter((_, i) => i !== index)
      return newSteps.map((step, i) => ({ ...step, step_order: i }))
    })
  }, [])

  const moveStepUp = useCallback((index: number) => {
    if (index === 0) return
    setSteps(prev => {
      const newSteps = [...prev]
      ;[newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]]
      return newSteps.map((step, i) => ({ ...step, step_order: i }))
    })
  }, [])

  const moveStepDown = useCallback((index: number) => {
    setSteps(prev => {
      if (index === prev.length - 1) return prev
      const newSteps = [...prev]
      ;[newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]]
      return newSteps.map((step, i) => ({ ...step, step_order: i }))
    })
  }, [])

  const setStepsFromAIGeneration = useCallback((aiSteps: WorkflowStep[]) => {
    if (aiSteps && Array.isArray(aiSteps) && aiSteps.length > 0) {
      setSteps(aiSteps.map((step: any) => ({
        step_name: step.step_name || 'Step',
        step_description: step.step_description || '',
        model: step.model || 'gpt-5',
        instructions: step.instructions || '',
        step_order: step.step_order !== undefined ? step.step_order : 0,
        tools: step.tools || [],
        tool_choice: step.tool_choice || 'auto',
      })))
    }
  }, [])

  const updateFirstStepInstructions = useCallback((instructions: string) => {
    setSteps(prev => {
      const newSteps = [...prev]
      if (newSteps.length > 0) {
        newSteps[0] = {
          ...newSteps[0],
          instructions,
        }
      }
      return newSteps
    })
  }, [])

  return {
    steps,
    updateStep,
    addStep,
    deleteStep,
    moveStepUp,
    moveStepDown,
    setStepsFromAIGeneration,
    updateFirstStepInstructions,
    setSteps,
  }
}

