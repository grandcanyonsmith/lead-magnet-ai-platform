'use client'

import { useAuth } from '@/features/auth/lib/auth/context'
import { api } from '@/shared/lib/api'
import { useState } from 'react'

export function ImpersonationBanner() {
  const { isImpersonating, actingUser, refreshAuth } = useAuth()
  const [isResetting, setIsResetting] = useState(false)

  // Always render to prevent layout shift, but hide when not impersonating
  if (!isImpersonating || !actingUser) {
    return <div className="min-h-[44px] sm:min-h-[40px]" aria-hidden="true" />
  }

  const handleReturn = async () => {
    setIsResetting(true)
    try {
      const sessionId = localStorage.getItem('impersonation_session_id')
      if (sessionId) {
        await api.post('/admin/impersonate/reset', { sessionId })
        localStorage.removeItem('impersonation_session_id')
      }
      await refreshAuth()
    } catch (error) {
      console.error('Error resetting impersonation:', error)
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="bg-yellow-500 text-yellow-900 px-3 sm:px-4 py-2.5 sm:py-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 min-h-[44px] sm:min-h-[40px]">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="font-semibold text-sm sm:text-base whitespace-nowrap flex-shrink-0">Viewing as:</span>
        <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <span className="text-sm sm:text-base truncate">
            {actingUser.name || actingUser.email}
          </span>
          <span className="text-xs sm:text-sm text-yellow-800 truncate">
            ({actingUser.email})
          </span>
        </div>
      </div>
      <button
        onClick={handleReturn}
        disabled={isResetting}
        className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-target whitespace-nowrap flex-shrink-0"
      >
        {isResetting ? 'Returning...' : 'Return to my account'}
      </button>
    </div>
  )
}

