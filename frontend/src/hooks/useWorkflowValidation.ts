'use client'

import { useMemo } from 'react'
import { WorkflowStep } from '@/types/workflow'
import { WorkflowFormData, TemplateData } from './useWorkflowForm'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function useWorkflowValidation(
  formData: WorkflowFormData,
  steps: WorkflowStep[],
  templateData: TemplateData
) {
  const validate = useMemo((): ValidationResult => {
    const errors: string[] = []

    // Validate workflow name
    if (!formData.workflow_name.trim()) {
      errors.push('Lead magnet name is required')
    }

    // Validate steps
    if (steps.length === 0) {
      errors.push('At least one workflow step is required')
    }

    steps.forEach((step, index) => {
      if (!step.step_name.trim()) {
        errors.push(`Step ${index + 1} name is required`)
      }
      if (!step.instructions.trim()) {
        errors.push(`Step ${index + 1} instructions are required`)
      }
    })

    // Template validation is optional - only validate if template content exists

    return {
      valid: errors.length === 0,
      errors,
    }
  }, [formData, steps])

  return validate
}

