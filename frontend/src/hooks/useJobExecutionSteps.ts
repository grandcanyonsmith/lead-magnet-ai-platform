'use client'

import { useState, useEffect } from 'react'

interface UseJobExecutionStepsParams {
  jobId?: string
}

/**
 * Hook to manage execution steps state and formatting
 * 
 * Features:
 * - Resets expanded steps when job changes (Bug 1.1 fix)
 */
export function useJobExecutionSteps(params?: UseJobExecutionStepsParams) {
  const [showExecutionSteps, setShowExecutionSteps] = useState(true)
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())

  // Reset expanded steps when jobId changes (Bug 1.1 fix)
  useEffect(() => {
    if (params?.jobId) {
      setExpandedSteps(new Set())
    }
  }, [params?.jobId])

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

