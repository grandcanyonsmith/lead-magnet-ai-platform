/**
 * Hook to detect and warn about unsaved changes
 */

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'

interface UseUnsavedChangesOptions {
  hasUnsavedChanges: boolean
  message?: string
  onBeforeUnload?: () => void
}

interface UseUnsavedChangesReturn {
  confirmNavigation: (onConfirm: () => void) => void
  UnsavedChangesDialog: JSX.Element | null
}

/**
 * Hook to warn users about unsaved changes before navigating away.
 * Use `confirmNavigation` to wrap any navigation action that should be blocked when there are unsaved changes.
 */
export function useUnsavedChanges({
  hasUnsavedChanges,
  message = 'You have unsaved changes. Are you sure you want to leave?',
  onBeforeUnload,
}: UseUnsavedChangesOptions): UseUnsavedChangesReturn {
  const messageRef = useRef(message)
  const pendingActionRef = useRef<(() => void) | null>(null)
  const [showDialog, setShowDialog] = useState(false)

  // Update message ref when it changes
  useEffect(() => {
    messageRef.current = message
  }, [message])

  // Handle browser beforeunload event (page refresh/close)
  useEffect(() => {
    if (!hasUnsavedChanges) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = messageRef.current
      return messageRef.current
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedChanges])

  const confirmNavigation = useCallback(
    (onConfirm: () => void) => {
      if (!hasUnsavedChanges) {
        onConfirm()
        return
      }

      if (onBeforeUnload) {
        onBeforeUnload()
      }

      pendingActionRef.current = onConfirm
      setShowDialog(true)
    },
    [hasUnsavedChanges, onBeforeUnload]
  )

  const handleConfirm = useCallback(() => {
    pendingActionRef.current?.()
    pendingActionRef.current = null
    setShowDialog(false)
  }, [])

  const handleCancel = useCallback(() => {
    pendingActionRef.current = null
    setShowDialog(false)
  }, [])

  const UnsavedChangesDialog = showDialog ? (
    <ConfirmDialog
      open={showDialog}
      title="Discard changes?"
      description={messageRef.current}
      confirmLabel="Leave without saving"
      cancelLabel="Stay"
      tone="danger"
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null

  return {
    confirmNavigation,
    UnsavedChangesDialog,
  }
}
