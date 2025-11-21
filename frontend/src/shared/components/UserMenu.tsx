'use client'

import React, { useState, useEffect, useRef } from 'react'
import { FiUser, FiSettings, FiLogOut, FiChevronDown, FiX, FiUsers, FiFilter } from 'react-icons/fi'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/features/auth/lib/auth/context'
import { signOut } from '@/features/auth/lib'
import { useJobFiltersContext } from '@/features/jobs/contexts/JobFiltersContext'

export const UserMenu: React.FC = () => {
  const router = useRouter()
  const pathname = usePathname()
  const { user, role, isLoading } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const jobFilters = useJobFiltersContext()
  const isJobsPage = pathname === '/dashboard/jobs'

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
        className="flex items-center gap-2 rounded-2xl border border-white/60 bg-white/80 px-2.5 py-1.5 text-sm font-medium text-ink-500 shadow-soft transition hover:text-ink-900"
        aria-label="User menu"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white text-sm font-semibold shadow-soft">
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            initials
          )}
        </div>
        {!isLoading && (
          <span className="hidden sm:block max-w-[120px] truncate text-ink-600">
            {displayName}
          </span>
        )}
        <FiChevronDown
          className={`hidden sm:block h-4 w-4 text-ink-300 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-3 w-72 max-w-[calc(100vw-1rem)] rounded-3xl border border-white/60 bg-white/95 p-1.5 shadow-soft backdrop-blur-xl">
          <div className="rounded-2xl border border-white/60 bg-white/90 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white text-sm font-semibold shadow-soft">
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
            {/* Mobile Filters - Only show on jobs page and mobile */}
            {isJobsPage && jobFilters && (
              <div className="mb-2 border-b border-white/60 pb-2 sm:hidden">
                <div className="px-4 py-2">
                  <div className="flex items-center mb-2">
                    <FiFilter className="mr-2 h-4 w-4 text-ink-300" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Filters</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="mb-1 block text-xs text-ink-500">Status</label>
                      <select
                        value={jobFilters.statusFilter}
                        onChange={(e) => {
                          jobFilters.setStatusFilter(e.target.value)
                        }}
                        className="w-full rounded-xl border border-white/60 bg-white/90 px-2 py-1.5 text-xs text-ink-600 shadow-soft focus:border-brand-200 focus:outline-none focus:ring-2 focus:ring-brand-100/80"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="all">All Statuses</option>
                        <option value="pending">Queued</option>
                        <option value="processing">Generating</option>
                        <option value="completed">Ready</option>
                        <option value="failed">Error</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-ink-500">Lead Magnet</label>
                      <select
                        value={jobFilters.workflowFilter}
                        onChange={(e) => {
                          jobFilters.setWorkflowFilter(e.target.value)
                        }}
                        className="w-full rounded-xl border border-white/60 bg-white/90 px-2 py-1.5 text-xs text-ink-600 shadow-soft focus:border-brand-200 focus:outline-none focus:ring-2 focus:ring-brand-100/80"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="all">All Lead Magnets</option>
                        {jobFilters.workflows.map((wf: any) => (
                          <option key={wf.workflow_id} value={wf.workflow_id}>
                            {wf.workflow_name || wf.workflow_id}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={handleSettingsClick}
              className="flex w-full items-center rounded-2xl px-4 py-2.5 text-sm text-ink-600 transition hover:bg-white/80"
            >
              <FiSettings className="mr-3 h-4 w-4 text-ink-400" />
              <span>Settings</span>
            </button>
            {role === 'SUPER_ADMIN' && (
              <button
                onClick={handleAgencyUsersClick}
                className="flex w-full items-center rounded-2xl px-4 py-2.5 text-sm text-ink-600 transition hover:bg-white/80"
              >
                <FiUsers className="mr-3 h-4 w-4 text-ink-400" />
                <span>Agency Users</span>
              </button>
            )}
          </div>

          <div className="border-t border-white/60 py-2">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center rounded-2xl px-4 py-2.5 text-sm text-red-500 transition hover:bg-red-50/60"
            >
              <FiLogOut className="mr-3 h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

