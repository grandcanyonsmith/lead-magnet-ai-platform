'use client'

import { useAuth } from '@/lib/auth/context'
import { api } from '@/lib/api'
import { useState } from 'react'

export function ImpersonationBanner() {
  const { isImpersonating, actingUser, refreshAuth } = useAuth()
  const [isResetting, setIsResetting] = useState(false)

  if (!isImpersonating || !actingUser) {
    return null
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
    <div className="bg-yellow-500 text-yellow-900 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="font-semibold">Viewing as:</span>
        <span>
          {actingUser.name || actingUser.email} ({actingUser.email})
        </span>
      </div>
      <button
        onClick={handleReturn}
        disabled={isResetting}
        className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-1 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isResetting ? 'Returning...' : 'Return to my account'}
      </button>
    </div>
  )
}

