'use client'

import React, { useState, useEffect, useRef } from 'react'
import { FiUser, FiSettings, FiLogOut, FiChevronDown, FiX, FiUsers } from 'react-icons/fi'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { signOut } from '@/lib/auth'

export const UserMenu: React.FC = () => {
  const router = useRouter()
  const { user, role, isLoading } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
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

  const handleSignOut = () => {
    signOut()
    router.push('/auth/login')
    setIsOpen(false)
  }

  const handleSettingsClick = () => {
    router.push('/dashboard/settings')
    setIsOpen(false)
  }

  const handleAgencyUsersClick = () => {
    router.push('/dashboard/agency/users')
    setIsOpen(false)
  }

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.split(' ')
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      }
      return name[0].toUpperCase()
    }
    if (email) {
      return email[0].toUpperCase()
    }
    return 'U'
  }

  // Don't show "User" placeholder while loading - wait for actual user data
  const displayName = isLoading ? '' : (user?.name || user?.email || 'User')
  const initials = isLoading ? '' : getInitials(user?.name, user?.email)

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors touch-target"
        aria-label="User menu"
      >
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-sm font-semibold">
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            initials
          )}
        </div>
        {!isLoading && (
          <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[120px] truncate">
            {displayName}
          </span>
        )}
        <FiChevronDown className={`hidden sm:block w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1rem)] bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-sm font-semibold">
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  initials
                )}
              </div>
              <div className="flex-1 min-w-0">
                {isLoading ? (
                  <>
                    <div className="h-4 bg-gray-200 rounded w-24 mb-2 animate-pulse" />
                    <div className="h-3 bg-gray-200 rounded w-32 animate-pulse" />
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {user?.name || 'User'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {user?.email || ''}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="py-2">
            <button
              onClick={handleSettingsClick}
              className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <FiSettings className="w-4 h-4 mr-3 text-gray-400" />
              <span>Settings</span>
            </button>
            {role === 'SUPER_ADMIN' && (
              <button
                onClick={handleAgencyUsersClick}
                className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <FiUsers className="w-4 h-4 mr-3 text-gray-400" />
                <span>Agency Users</span>
              </button>
            )}
          </div>

          <div className="border-t border-gray-200 py-2">
            <button
              onClick={handleSignOut}
              className="flex items-center w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <FiLogOut className="w-4 h-4 mr-3" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

