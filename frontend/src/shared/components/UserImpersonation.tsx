'use client'

import { useAuth } from '@/features/auth/lib/auth/context'
import { api } from '@/shared/lib/api'
import { useState, useEffect, useRef } from 'react'
import { AuthUser } from '@/features/auth/types'
import { FiUser } from 'react-icons/fi'
import { toast } from 'react-hot-toast'

interface UserSearchResult {
  users: AuthUser[]
  count: number
}

export function UserImpersonation() {
  const { role, refreshAuth } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [users, setUsers] = useState<AuthUser[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isImpersonating, setIsImpersonating] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const searchUsers = async () => {
    setIsLoading(true)
    try {
      const response = await api.get<UserSearchResult>('/admin/users', {
        params: { q: searchTerm, limit: 10 },
      })
      setUsers(response.users)
    } catch (error) {
      console.error('Error searching users:', error)
      setUsers([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchUsers()
    } else {
      setUsers([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm])

  // Only show for admins - must be after all hooks
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    return null
  }

  const handleImpersonate = async (targetUserId: string) => {
    setIsImpersonating(true)
    try {
      const response = await api.post<{ session_id: string }>('/admin/impersonate', {
        targetUserId,
      })
      
      // Store session ID
      localStorage.setItem('impersonation_session_id', response.session_id)
      
      // Refresh auth to update context
      await refreshAuth()
      
      setIsOpen(false)
      setSearchTerm('')
      setUsers([])
    } catch (error) {
      console.error('Error starting impersonation:', error)
      toast.error('Failed to start impersonation. Please try again.')
    } finally {
      setIsImpersonating(false)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex min-h-[44px] items-center gap-1.5 rounded-2xl border border-white/60 bg-white/80 px-3 py-2 text-sm font-medium text-ink-500 shadow-soft transition hover:text-ink-900 sm:min-h-0"
        aria-label="View as user"
      >
        <FiUser className="h-4 w-4 sm:hidden" />
        <span className="hidden sm:inline">View as user</span>
      </button>

      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-25 z-40 md:hidden"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 z-50 mt-3 flex max-h-[calc(100vh-8rem)] w-[calc(100vw-1rem)] max-w-[20rem] flex-col rounded-3xl border border-white/60 bg-white/95 shadow-soft backdrop-blur-xl sm:w-80 md:right-0">
            <div className="flex-shrink-0 border-b border-white/60 p-3">
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-2xl border border-white/60 bg-white/90 px-3 py-2 text-sm text-ink-600 shadow-soft focus:border-brand-200 focus:outline-none focus:ring-2 focus:ring-brand-100"
                autoFocus
              />
            </div>

            <div className="max-h-64 flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-sm text-ink-400">Searching...</div>
              ) : users.length === 0 ? (
                <div className="p-4 text-center text-sm text-ink-400">
                  {searchTerm.length < 2
                    ? 'Type at least 2 characters to search'
                    : 'No users found'}
                </div>
              ) : (
                <ul className="py-1">
                  {users.map((user) => (
                    <li key={user.user_id}>
                      <button
                        onClick={() => handleImpersonate(user.user_id)}
                        disabled={isImpersonating}
                        className="w-full rounded-2xl px-4 py-2 text-left text-sm text-ink-600 transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <div className="font-medium text-ink-900">{user.name || user.email}</div>
                        <div className="mt-0.5 text-xs text-ink-400">{user.email}</div>
                        {user.role && (
                          <div className="mt-0.5 text-xs text-ink-400 opacity-80">Role: {user.role}</div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
