'use client'

import { useState, useRef } from 'react'
import { WorkflowStep } from '@/shared/types'

/**
 * Hook to manage job detail page UI state
 * 
 * Consolidates all modal, panel, and collapsible section state management
 * for the job detail page. Provides convenient open/close handlers and
 * tracks step editing state with a ref for unsaved changes.
 * 
 * State managed:
 * - Resubmit modal visibility
 * - Step edit side panel (index, visibility, unsaved changes)
 * - Rerun confirmation dialog (step index, visibility)
 * - Collapsible sections (details, form submission)
 * 
 * @returns State object with all UI state and handlers
 * 
 * @example
 * ```ts
 * const state = useJobDetailState()
 * state.openEditStep(0)
 * state.openResubmitModal()
 * ```
 */
export function useJobDetailState() {
  const [showResubmitModal, setShowResubmitModal] = useState(false)
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null)
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)
  const [showRerunConfirm, setShowRerunConfirm] = useState(false)
  const [stepIndexForRerun, setStepIndexForRerun] = useState<number | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showFormSubmission, setShowFormSubmission] = useState(false)
  const latestStepUpdateRef = useRef<WorkflowStep | null>(null)

  const openResubmitModal = () => setShowResubmitModal(true)
  const closeResubmitModal = () => setShowResubmitModal(false)

  const openEditStep = (stepIndex: number) => {
    setEditingStepIndex(stepIndex)
    setIsSidePanelOpen(true)
    latestStepUpdateRef.current = null
  }

  const closeEditStep = () => {
    setEditingStepIndex(null)
    setIsSidePanelOpen(false)
  }

  const openRerunConfirm = (stepIndex: number) => {
    setStepIndexForRerun(stepIndex)
    setShowRerunConfirm(true)
  }

  const closeRerunConfirm = () => {
    setShowRerunConfirm(false)
    setStepIndexForRerun(null)
  }

  return {
    // Resubmit modal
    showResubmitModal,
    openResubmitModal,
    closeResubmitModal,
    
    // Edit step panel
    editingStepIndex,
    isSidePanelOpen,
    openEditStep,
    closeEditStep,
    latestStepUpdateRef,
    
    // Rerun confirmation
    showRerunConfirm,
    stepIndexForRerun,
    openRerunConfirm,
    closeRerunConfirm,
    
    // Collapsible sections
    showDetails,
    setShowDetails,
    showFormSubmission,
    setShowFormSubmission,
  }
}

