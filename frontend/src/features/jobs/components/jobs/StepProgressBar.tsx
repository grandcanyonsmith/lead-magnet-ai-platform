/**
 * Step Progress Bar Component
 * Displays progress indicator showing current step / total steps
 */

import { useMemo } from 'react'
import { MergedStep, StepStatus } from '@/features/jobs/types'

interface StepProgressBarProps {
  steps: MergedStep[]
  jobStatus?: string
  getStepStatus: (step: MergedStep) => StepStatus
}

export function StepProgressBar({ steps, jobStatus, getStepStatus }: StepProgressBarProps) {
  const progress = useMemo(() => {
    const totalSteps = steps.length
    if (totalSteps === 0) return null
    
    // Sort steps by order
    const sortedSteps = [...steps].sort((a, b) => {
      const orderA = a.step_order ?? 0
      const orderB = b.step_order ?? 0
      return orderA - orderB
    })
    
    // Find completed and in-progress steps
    let completedCount = 0
    let currentStepNumber = 0
    
    for (const step of sortedSteps) {
      const status = getStepStatus(step)
      if (status === 'completed') {
        completedCount++
      } else if (status === 'in_progress') {
        currentStepNumber = step.step_order || sortedSteps.indexOf(step) + 1
        break
      }
    }
    
    // If no step is in progress, determine current step based on completed count
    if (currentStepNumber === 0) {
      if (jobStatus === 'processing') {
        // Job is processing but no step marked as in_progress yet - use next step
        currentStepNumber = completedCount + 1
      } else if (jobStatus === 'completed') {
        // All steps completed
        currentStepNumber = totalSteps
      } else {
        // Job hasn't started or is pending
        currentStepNumber = completedCount > 0 ? completedCount + 1 : 1
      }
    }
    
    // Only show progress if there's meaningful progress to show
    if (jobStatus === 'processing' || completedCount > 0 || jobStatus === 'completed') {
      return {
        current: currentStepNumber,
        total: totalSteps,
        isProcessing: jobStatus === 'processing',
      }
    }
    
    return null
  }, [steps, jobStatus, getStepStatus])

  if (!progress) return null

  return (
    <span className={`px-3 py-1.5 text-xs font-bold rounded-xl shadow-sm ring-1 transition-all duration-200 ${
      progress.isProcessing 
        ? 'bg-gradient-to-br from-blue-100 to-blue-50 text-blue-800 ring-blue-200/60 animate-pulse' 
        : 'bg-gradient-to-br from-gray-100 to-gray-50 text-gray-800 ring-gray-200/60'
    }`}>
      {progress.current}/{progress.total}
    </span>
  )
}

