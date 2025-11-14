/**
 * Hook to detect and warn about unsaved changes
 */

'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface UseUnsavedChangesOptions {
  hasUnsavedChanges: boolean
  message?: string
  onBeforeUnload?: () => void
}

/**
 * Hook to warn users about unsaved changes before navigating away
 */
export function useUnsavedChanges({
  hasUnsavedChanges,
  message = 'You have unsaved changes. Are you sure you want to leave?',
  onBeforeUnload,
}: UseUnsavedChangesOptions): void {
  const router = useRouter()
  const messageRef = useRef(message)

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

  // Handle Next.js route changes
  useEffect(() => {
    if (!hasUnsavedChanges) return

    const handleRouteChange = () => {
      if (onBeforeUnload) {
        onBeforeUnload()
      }
      if (!confirm(messageRef.current)) {
        throw new Error('Route change cancelled by user')
      }
    }

    // Note: Next.js 13+ App Router doesn't have a built-in way to intercept route changes
    // This is a limitation - we'll rely on beforeunload for now
    // For better support, we'd need to use a custom solution or wait for Next.js to add this feature
  }, [hasUnsavedChanges, onBeforeUnload])
}

