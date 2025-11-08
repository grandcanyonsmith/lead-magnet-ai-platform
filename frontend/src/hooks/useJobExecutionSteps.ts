'use client'

import { useState } from 'react'

/**
 * Hook to manage execution steps state and formatting
 */
export function useJobExecutionSteps() {
  const [showExecutionSteps, setShowExecutionSteps] = useState(true)
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())

  const toggleStep = (stepOrder: number) => {
    const newExpanded = new Set(expandedSteps)
    if (newExpanded.has(stepOrder)) {
      newExpanded.delete(stepOrder)
    } else {
      newExpanded.add(stepOrder)
    }
    setExpandedSteps(newExpanded)
  }

  return {
    showExecutionSteps,
    setShowExecutionSteps,
    expandedSteps,
    toggleStep,
  }
}

