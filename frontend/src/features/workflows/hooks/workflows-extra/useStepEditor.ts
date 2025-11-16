import { useState, useEffect } from 'react'
import { WorkflowStep } from '@/features/workflows/types'

interface UseStepEditorProps {
  step: WorkflowStep
  index: number
  onChange: (index: number, step: WorkflowStep) => void
}

export function useStepEditor({ step, index, onChange }: UseStepEditorProps) {
  const [localStep, setLocalStep] = useState<WorkflowStep>(step)
  const [webhookHeaders, setWebhookHeaders] = useState<Record<string, string>>(
    step.webhook_headers || {}
  )

  // Sync localStep when step prop changes
  useEffect(() => {
    setLocalStep(step)
    // Sync webhook headers
    if (step.webhook_headers) {
      setWebhookHeaders(step.webhook_headers)
    } else {
      setWebhookHeaders({})
    }
  }, [step])

  const handleChange = (field: keyof WorkflowStep, value: any) => {
    const updated = { ...localStep, [field]: value }
    setLocalStep(updated)
    onChange(index, updated)
  }

  const handleWebhookHeadersChange = (headers: Record<string, string>) => {
    setWebhookHeaders(headers)
    handleChange('webhook_headers', headers)
  }

  return {
    localStep,
    webhookHeaders,
    handleChange,
    handleWebhookHeadersChange,
  }
}

