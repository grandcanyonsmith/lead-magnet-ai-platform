'use client'

import { useAuth } from '@/lib/auth/context'
import { api } from '@/lib/api'
import { useState, useEffect } from 'react'
import { AuthUser } from '@/types/auth'
import { UserIcon } from '@heroicons/react/24/outline'
import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react'
import toast from 'react-hot-toast'

interface UserSearchResult {
  users: AuthUser[]
  count: number
}

export function UserImpersonation() {
  const { role, refreshAuth } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [users, setUsers] = useState<AuthUser[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isImpersonating, setIsImpersonating] = useState(false)

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

  const handleImpersonate = async (targetUserId: string, close: () => void) => {
    setIsImpersonating(true)
    try {
      const response = await api.post<{ session_id: string }>('/admin/impersonate', {
        targetUserId,
      })
      
      // Store session ID
      localStorage.setItem('impersonation_session_id', response.session_id)
      
      // Refresh auth to update context
      await refreshAuth()
      
      close()
      setSearchTerm('')
      setUsers([])
    } catch (error) {
      console.error('Error starting impersonation:', error)
      toast.error('Failed to start impersonation')
    } finally {
      setIsImpersonating(false)
    }
  }

  return (
    <Popover className="relative">
      <PopoverButton
        className="px-2 sm:px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md touch-target min-h-[44px] sm:min-h-0 flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
        aria-label="View as user"
      >
        <UserIcon className="w-4 h-4 sm:hidden" />
        <span className="hidden sm:inline">View as user</span>
      </PopoverButton>

      <Transition
        enter="transition duration-100 ease-out"
        enterFrom="transform scale-95 opacity-0"
        enterTo="transform scale-100 opacity-100"
        leave="transition duration-75 ease-out"
        leaveFrom="transform scale-100 opacity-100"
        leaveTo="transform scale-95 opacity-0"
      >
        <PopoverPanel className="absolute left-0 md:right-0 mt-2 w-[calc(100vw-1rem)] max-w-[20rem] sm:w-80 bg-white rounded-md shadow-lg z-50 border border-gray-200 max-h-[calc(100vh-8rem)] flex flex-col focus:outline-none">
          {({ close }) => (
            <>
              <div className="p-3 border-b border-gray-200 flex-shrink-0">
                <input
                  type="text"
                  placeholder="Search users by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div className="max-h-64 overflow-y-auto flex-1">
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
                          onClick={() => handleImpersonate(user.user_id, close)}
                          disabled={isImpersonating}
                          className="w-full text-left px-4 py-3 sm:py-2 hover:bg-gray-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed touch-target transition-colors"
                        >
                          <div className="font-medium truncate">{user.name || user.email}</div>
                          <div className="text-gray-500 text-xs truncate mt-0.5">{user.email}</div>
                          {user.role && (
                            <div className="text-gray-400 text-xs mt-0.5">Role: {user.role}</div>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </PopoverPanel>
      </Transition>
    </Popover>
  )
}

