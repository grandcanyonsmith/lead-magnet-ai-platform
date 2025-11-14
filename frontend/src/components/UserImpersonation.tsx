'use client'

import { useAuth } from '@/lib/auth/context'
import { api } from '@/lib/api'
import { useState, useEffect, useRef } from 'react'
import { AuthUser } from '@/types/auth'

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

  // Only show for admins
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    return null
  }

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

  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchUsers()
    } else {
      setUsers([])
    }
  }, [searchTerm])

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
      alert('Failed to start impersonation. Please try again.')
    } finally {
      setIsImpersonating(false)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md"
      >
        View as user
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg z-50 border border-gray-200">
          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500 text-sm">Searching...</div>
            ) : users.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
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
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="font-medium">{user.name || user.email}</div>
                      <div className="text-gray-500 text-xs">{user.email}</div>
                      {user.role && (
                        <div className="text-gray-400 text-xs">Role: {user.role}</div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

