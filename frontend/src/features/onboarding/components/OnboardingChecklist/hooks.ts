/**
 * Custom hooks for OnboardingChecklist component
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ChecklistItemId, ChecklistItemState, NAVIGATION_CONFIG, ERROR_MESSAGES } from './types'
import { getLocalStorageItem, setLocalStorageItem, waitForCondition, calculateBackoffDelay, removeLocalStorageItem } from './utils'

/**
 * Hook to manage checklist item state (updating, errors, retries)
 */
export function useChecklistItemState() {
  const [state, setState] = useState<ChecklistItemState>({
    updating: null,
    error: null,
    retrying: false,
  })

  const setUpdating = useCallback((itemId: ChecklistItemId | null) => {
    setState((prev) => ({
      ...prev,
      updating: itemId,
      error: null,
      retrying: false,
    }))
  }, [])

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({
      ...prev,
      error,
      updating: null,
    }))
  }, [])

  const setRetrying = useCallback((retrying: boolean) => {
    setState((prev) => ({
      ...prev,
      retrying,
    }))
  }, [])

  const clearState = useCallback(() => {
    setState({
      updating: null,
      error: null,
      retrying: false,
    })
  }, [])

  return {
    state,
    setUpdating,
    setError,
    setRetrying,
    clearState,
  }
}

/**
 * Hook to manage widget visibility and minimized state
 */
export function useWidgetState() {
  const [isOpen, setIsOpen] = useState(() => {
    const dismissed = getLocalStorageItem('onboarding-checklist-dismissed')
    return dismissed !== 'true'
  })

  const [isMinimized, setIsMinimized] = useState(() => {
    const minimized = getLocalStorageItem('onboarding-checklist-minimized')
    return minimized === 'true' ? true : false // Default to false (expanded) if not set
  })

  const handleDismiss = useCallback(() => {
    setIsOpen(false)
    setLocalStorageItem('onboarding-checklist-dismissed', 'true')
  }, [])

  const handleUndoDismiss = useCallback(() => {
    setIsOpen(true)
    removeLocalStorageItem('onboarding-checklist-dismissed')
  }, [])

  const handleToggleMinimize = useCallback(() => {
    setIsMinimized((prev) => {
      const newValue = !prev
      setLocalStorageItem('onboarding-checklist-minimized', String(newValue))
      return newValue
    })
  }, [])

  // Persist minimized state to localStorage when it changes
  useEffect(() => {
    setLocalStorageItem('onboarding-checklist-minimized', String(isMinimized))
  }, [isMinimized])

  return {
    isOpen,
    isMinimized,
    setIsOpen,
    setIsMinimized,
    handleDismiss,
    handleUndoDismiss,
    handleToggleMinimize,
  }
}

/**
 * Hook to handle navigation with proper route change detection
 */
export function useNavigationHandler() {
  const router = useRouter()
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const navigationPromiseRef = useRef<{
    resolve: (value: boolean) => void
    reject: (reason?: any) => void
    route: string
    initialPathname: string
  } | null>(null)

  // Keep pathname ref in sync and check for navigation completion
  useEffect(() => {
    const previousPathname = pathnameRef.current
    pathnameRef.current = pathname

    // Check if we have a pending navigation
    if (navigationPromiseRef.current) {
      const { route, initialPathname, resolve } = navigationPromiseRef.current
      const pathnameChanged = pathname !== initialPathname
      const reachedTarget = pathname === route || pathname?.startsWith(route + '/')

      if (pathnameChanged && reachedTarget) {
        resolve(true)
        navigationPromiseRef.current = null
      }
    }
  }, [pathname])

  const navigateToRoute = useCallback(
    async (route: string): Promise<boolean> => {
      // Clear any existing timeout
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current)
      }

      // Cancel any pending navigation
      if (navigationPromiseRef.current) {
        navigationPromiseRef.current.resolve(false)
        navigationPromiseRef.current = null
      }

      const initialPathname = pathnameRef.current
      router.push(route)

      // Create a promise that resolves when navigation completes
      return new Promise<boolean>((resolve, reject) => {
        navigationPromiseRef.current = {
          resolve,
          reject,
          route,
          initialPathname,
        }

        // Set timeout to reject if navigation takes too long
        navigationTimeoutRef.current = setTimeout(() => {
          if (navigationPromiseRef.current?.route === route) {
            navigationPromiseRef.current.resolve(false)
            navigationPromiseRef.current = null
          }
        }, NAVIGATION_CONFIG.MAX_TOUR_DELAY)
      })
    },
    [router]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current)
      }
      if (navigationPromiseRef.current) {
        navigationPromiseRef.current.resolve(false)
        navigationPromiseRef.current = null
      }
    }
  }, [])

  return { navigateToRoute }
}

/**
 * Hook to handle checklist item clicks with navigation and tour start
 */
export function useChecklistItemHandler(
  onStartTour: (tourId: string | any) => void,
  onError?: (error: string) => void
) {
  const { navigateToRoute } = useNavigationHandler()
  const { state, setUpdating, setError, clearState } = useChecklistItemState()
  const retryCountRef = useRef<number>(0)

  const handleItemClick = useCallback(
    async (item: { id: ChecklistItemId; route: string; tourId: string }) => {
      if (state.updating) {
        return // Prevent multiple simultaneous clicks
      }

      setUpdating(item.id)
      retryCountRef.current = 0

      try {
        // Navigate to the route
        const navigationSucceeded = await navigateToRoute(item.route)

        if (!navigationSucceeded) {
          throw new Error(ERROR_MESSAGES.NAVIGATION_FAILED)
        }

        // Wait a bit for the page to render before starting tour
        await new Promise((resolve) =>
          setTimeout(resolve, NAVIGATION_CONFIG.INITIAL_TOUR_DELAY)
        )

        // Start the tour
        try {
          onStartTour(item.tourId as any)
          clearState()
        } catch (tourError) {
          console.error('Failed to start tour:', tourError)
          setError(ERROR_MESSAGES.TOUR_START_FAILED)
          onError?.(ERROR_MESSAGES.TOUR_START_FAILED)
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : ERROR_MESSAGES.GENERIC
        console.error('Checklist item click error:', error)
        setError(errorMessage)
        onError?.(errorMessage)

        // Retry logic with exponential backoff
        if (retryCountRef.current < NAVIGATION_CONFIG.MAX_RETRIES) {
          retryCountRef.current += 1
          const delay = calculateBackoffDelay(retryCountRef.current - 1)
          setTimeout(() => {
            handleItemClick(item)
          }, delay)
        } else {
          clearState()
        }
      }
    },
    [state.updating, navigateToRoute, onStartTour, setUpdating, setError, clearState, onError]
  )

  return {
    handleItemClick,
    itemState: state,
    clearError: () => setError(null),
  }
}

