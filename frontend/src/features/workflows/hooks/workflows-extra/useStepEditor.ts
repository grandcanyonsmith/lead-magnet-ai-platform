import { useState, useEffect, useRef } from 'react'
import { WorkflowStep } from '@/features/workflows/types'

interface UseStepEditorProps {
  step: WorkflowStep
  index: number
  onChange: (index: number, step: WorkflowStep) => void
}

// Helper to compare step objects by key fields (ignoring step_order which changes frequently)
function areStepsEqual(step1: WorkflowStep, step2: WorkflowStep): boolean {
  if (!step1 || !step2) return step1 === step2
  
  return (
    step1.step_name === step2.step_name &&
    step1.step_description === step2.step_description &&
    step1.step_type === step2.step_type &&
    step1.model === step2.model &&
    step1.instructions === step2.instructions &&
    step1.webhook_url === step2.webhook_url &&
    JSON.stringify(step1.webhook_headers || {}) === JSON.stringify(step2.webhook_headers || {}) &&
    JSON.stringify(step1.webhook_data_selection || {}) === JSON.stringify(step2.webhook_data_selection || {}) &&
    JSON.stringify(step1.tools || []) === JSON.stringify(step2.tools || []) &&
    step1.tool_choice === step2.tool_choice &&
    JSON.stringify((step1.depends_on || []).sort()) === JSON.stringify((step2.depends_on || []).sort())
    // Note: step_order is intentionally excluded as it changes frequently
  )
}

export function useStepEditor({ step, index, onChange }: UseStepEditorProps) {
  const [localStep, setLocalStep] = useState<WorkflowStep>(step)
  const [webhookHeaders, setWebhookHeaders] = useState<Record<string, string>>(
    step.webhook_headers || {}
  )
  const lastSentStepRef = useRef<WorkflowStep | null>(null)
  const isInternalUpdateRef = useRef(false)
  const localStepRef = useRef<WorkflowStep>(step)

  // Keep ref in sync with state
  useEffect(() => {
    localStepRef.current = localStep
  }, [localStep])

  // Sync localStep when step prop changes (only if values actually changed)
  useEffect(() => {
    // Skip update if this change came from our own handleChange
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false
      // Track what we just sent
      lastSentStepRef.current = step
      // IMPORTANT: Still update localStep immediately for our own changes
      // This ensures UI updates instantly (like step_type changes)
      setLocalStep(step)
      localStepRef.current = step
      if (step.webhook_headers) {
        setWebhookHeaders(step.webhook_headers)
      } else {
        setWebhookHeaders({})
      }
      return
    }
    
    // Check if this is the step we just sent (parent echoing back our change)
    if (lastSentStepRef.current && areStepsEqual(step, lastSentStepRef.current)) {
      // This is our own update being echoed back - ignore it
      return
    }
    
    // Only update if the step actually changed (not just a new object reference)
    // Use ref to get current localStep value without adding to dependencies
    if (!areStepsEqual(step, localStepRef.current)) {
      setLocalStep(step)
      localStepRef.current = step
      // Sync webhook headers
      if (step.webhook_headers) {
        setWebhookHeaders(step.webhook_headers)
      } else {
        setWebhookHeaders({})
      }
    }
  }, [step]) // Only depend on step, not localStep to avoid loops

  const handleChange = (field: keyof WorkflowStep, value: any) => {
    isInternalUpdateRef.current = true
    // Use functional update to always get latest state
    setLocalStep((prev) => {
      const updated = { ...prev, [field]: value }
      localStepRef.current = updated
      lastSentStepRef.current = updated
      // Send update to parent
      onChange(index, updated)
      return updated
    })
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

