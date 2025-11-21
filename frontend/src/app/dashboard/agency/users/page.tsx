'use client'

import { useState, useEffect, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, Transition, Listbox } from '@headlessui/react'
import { useAuth } from '@/features/auth/lib/auth/context'
import { api } from '@/shared/lib/api'
import { FiUsers, FiSearch, FiEdit2, FiShield, FiUser, FiUserCheck, FiLogIn, FiCopy, FiCheck, FiChevronDown } from 'react-icons/fi'
import { toast } from 'react-hot-toast'

interface User {
  user_id: string
  email: string
  name: string
  customer_id: string
  role: string
  created_at: string
}

const roles = [
  { value: 'USER', label: 'USER', icon: FiUser, color: 'text-ink-600' },
  { value: 'ADMIN', label: 'ADMIN', icon: FiUserCheck, color: 'text-blue-600' },
  { value: 'SUPER_ADMIN', label: 'SUPER_ADMIN', icon: FiShield, color: 'text-purple-600' },
]

export default function AgencyUsersPage() {
  const { role, viewMode, refreshAuth, setViewMode } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [selectedRole, setSelectedRole] = useState<typeof roles[0] | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null)
  const [copiedCustomerId, setCopiedCustomerId] = useState<string | null>(null)

  const loadUsers = async () => {
    setIsLoading(true)
    try {
      const response = await api.get<{ users: User[] }>('/admin/agency/users', {
        params: {
          q: searchTerm || undefined,
          limit: 100,
        },
      })
      setUsers(response.users || [])
    } catch (error) {
      console.error('Error loading users:', error)
      setUsers([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm])

  // Only show for SUPER_ADMIN in agency view
  if (role !== 'SUPER_ADMIN' || viewMode !== 'agency') {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-yellow-50/80 border border-yellow-200 rounded-2xl p-4">
          <p className="text-yellow-800">
            This page is only available to Super Admins in Agency View.
          </p>
        </div>
      </div>
    )
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    const roleOption = roles.find(r => r.value === user.role) || roles[0]
    setSelectedRole(roleOption)
  }

  const handleSaveRole = async () => {
    if (!editingUser || !selectedRole) return

    setIsSaving(true)
    try {
      await api.put(`/admin/agency/users/${editingUser.user_id}`, {
        role: selectedRole.value,
      })
      await loadUsers()
      setEditingUser(null)
      setSelectedRole(null)
    } catch (error) {
      console.error('Error updating user role:', error)
      toast.error('Failed to update user role. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const getRoleIcon = (role: string) => {
    const roleOption = roles.find(r => r.value === role)
    if (!roleOption) return <FiUser className="w-4 h-4 text-ink-600" />
    const Icon = roleOption.icon
    return <Icon className={`w-4 h-4 ${roleOption.color}`} />
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-700'
      case 'ADMIN':
        return 'bg-blue-100 text-blue-700'
      default:
        return 'bg-surface-50 text-ink-700'
    }
  }

  const handleImpersonate = async (user: User) => {
    setImpersonatingUserId(user.user_id)
    try {
      const response = await api.post<{ session_id: string }>('/admin/impersonate', {
        targetUserId: user.user_id,
      })

      localStorage.setItem('impersonation_session_id', response.session_id)
      await refreshAuth()

      if (user.customer_id) {
        setViewMode('subaccount', user.customer_id)
      } else {
        setViewMode('subaccount')
      }

      router.push('/dashboard')
    } catch (error) {
      console.error('Error starting impersonation from agency table:', error)
      toast.error('Failed to login as this user. Please try again.')
    } finally {
      setImpersonatingUserId(null)
    }
  }

  const handleCopyCustomerId = async (customerId: string) => {
    try {
      await navigator.clipboard.writeText(customerId)
      setCopiedCustomerId(customerId)
      setTimeout(() => setCopiedCustomerId(null), 2000)
    } catch (error) {
      console.error('Failed to copy customer ID:', error)
    }
  }

  const isOpen = editingUser !== null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-ink-900 flex items-center gap-2">
          <FiUsers className="w-5 h-5 sm:w-6 sm:h-6" />
          User Management
        </h1>
        <p className="text-sm sm:text-base text-ink-600 mt-1">
          Manage users, roles, and permissions across all accounts
        </p>
      </div>

      {/* Search */}
      <div className="mb-4 sm:mb-6">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 w-4 h-4 sm:w-5 sm:h-5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or email..."
            className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-2 text-base sm:text-sm border border-white/60 rounded-2xl bg-white/90 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 shadow-soft outline-none transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Mobile Card Layout */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="bg-white rounded-2xl shadow-soft border border-white/60 p-8 text-center text-ink-500">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
            <p className="mt-2">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-soft border border-white/60 p-8 text-center text-ink-500">
            <FiUsers className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No users found</p>
          </div>
        ) : (
          users.map((user) => (
            <div
              key={user.user_id}
              className="bg-white rounded-2xl shadow-soft border border-white/60 p-4 space-y-3 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-900 truncate">
                    {user.name || 'Unknown'}
                  </div>
                  <div className="text-sm text-ink-500 truncate mt-0.5">{user.email}</div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${getRoleBadgeColor(
                    user.role
                  )}`}
                >
                  {getRoleIcon(user.role)}
                  <span className="truncate max-w-[80px] sm:max-w-none">{user.role}</span>
                </span>
              </div>

              <div className="pt-2 border-t border-white/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-500">Customer ID:</span>
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end ml-2">
                    <span
                      className="text-ink-900 font-mono truncate max-w-[140px]"
                      title={user.customer_id}
                    >
                      {user.customer_id}
                    </span>
                    <button
                      onClick={() => handleCopyCustomerId(user.customer_id)}
                      className="flex-shrink-0 p-1.5 text-ink-500 hover:text-ink-700 hover:bg-white/80 rounded-2xl transition-colors touch-target"
                      title={copiedCustomerId === user.customer_id ? 'Copied!' : 'Copy Customer ID'}
                      aria-label="Copy Customer ID"
                    >
                      {copiedCustomerId === user.customer_id ? (
                        <FiCheck className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <FiCopy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-500">Created:</span>
                  <span className="text-ink-900">
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/60 flex flex-col gap-2">
                <button
                  onClick={() => handleEditUser(user)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50/60 rounded-2xl transition-colors touch-target"
                >
                  <FiEdit2 className="w-4 h-4" />
                  Edit Role
                </button>
                <button
                  onClick={() => handleImpersonate(user)}
                  disabled={impersonatingUserId === user.user_id}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50/60 rounded-2xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-target"
                >
                  <FiLogIn className="w-4 h-4" />
                  {impersonatingUserId === user.user_id ? 'Logging in...' : 'Log in as'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden md:block bg-white rounded-2xl shadow-soft border border-white/60 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-ink-500">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
            <p className="mt-2">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-ink-500">
            <FiUsers className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/60">
              <thead className="bg-white/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">
                    Customer ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-ink-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-white/60">
                {users.map((user) => (
                  <tr
                    key={user.user_id}
                    className="hover:bg-white/80 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-ink-900">
                          {user.name || 'Unknown'}
                        </div>
                        <div className="text-sm text-ink-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-ink-900 font-mono">{user.customer_id}</div>
                        <button
                          onClick={() => handleCopyCustomerId(user.customer_id)}
                          className="p-1.5 text-ink-500 hover:text-ink-700 hover:bg-white/80 rounded-2xl transition-colors touch-target"
                          title={copiedCustomerId === user.customer_id ? 'Copied!' : 'Copy Customer ID'}
                          aria-label="Copy Customer ID"
                        >
                          {copiedCustomerId === user.customer_id ? (
                            <FiCheck className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <FiCopy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                          user.role
                        )}`}
                      >
                        {getRoleIcon(user.role)}
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-4">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors"
                        >
                          <FiEdit2 className="w-4 h-4" />
                          Edit Role
                        </button>
                        <button
                          onClick={() => handleImpersonate(user)}
                          disabled={impersonatingUserId === user.user_id}
                          className="text-brand-600 hover:text-brand-700 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <FiLogIn className="w-4 h-4" />
                          {impersonatingUserId === user.user_id ? 'Logging in...' : 'Log in as'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Role Modal with Headless UI Dialog */}
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => {
          setEditingUser(null)
          setSelectedRole(null)
        }}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-4 sm:p-6 shadow-soft border border-white/60 transition-all">
                  <Dialog.Title
                    as="h2"
                    className="text-lg sm:text-xl font-bold text-ink-900 mb-4"
                  >
                    Edit User Role
                  </Dialog.Title>

                  {editingUser && (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-ink-600 mb-2">
                          <strong>User:</strong> {editingUser.name || editingUser.email}
                        </p>
                        <p className="text-sm text-ink-600">
                          <strong>Current Role:</strong> {editingUser.role}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-ink-700 mb-2">
                          New Role
                        </label>
                        <Listbox value={selectedRole} onChange={setSelectedRole}>
                          <div className="relative">
                            <Listbox.Button className="relative w-full cursor-default rounded-2xl bg-white/90 py-2.5 sm:py-2 pl-3 pr-10 text-left text-base sm:text-sm border border-white/60 shadow-soft focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors">
                              <span className="block truncate flex items-center gap-2">
                                {selectedRole && (
                                  <>
                                    {(() => {
                                      const Icon = selectedRole.icon
                                      return <Icon className={`w-4 h-4 ${selectedRole.color}`} />
                                    })()}
                                    <span>{selectedRole.label}</span>
                                  </>
                                )}
                              </span>
                              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                <FiChevronDown
                                  className="h-4 w-4 text-ink-400"
                                  aria-hidden="true"
                                />
                              </span>
                            </Listbox.Button>
                            <Transition
                              as={Fragment}
                              leave="transition ease-in duration-100"
                              leaveFrom="opacity-100"
                              leaveTo="opacity-0"
                            >
                              <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-2xl bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm border border-white/60">
                                {roles.map((roleOption) => (
                                  <Listbox.Option
                                    key={roleOption.value}
                                    className={({ active }) =>
                                      `relative cursor-default select-none py-2 pl-3 pr-9 ${
                                        active ? 'bg-brand-50 text-brand-900' : 'text-ink-900'
                                      }`
                                    }
                                    value={roleOption}
                                  >
                                    {({ selected }) => (
                                      <>
                                        <span
                                          className={`block truncate flex items-center gap-2 ${
                                            selected ? 'font-medium' : 'font-normal'
                                          }`}
                                        >
                                          {(() => {
                                            const Icon = roleOption.icon
                                            return <Icon className={`w-4 h-4 ${roleOption.color}`} />
                                          })()}
                                          <span>{roleOption.label}</span>
                                        </span>
                                        {selected ? (
                                          <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-brand-600">
                                            <FiCheck className="h-4 w-4" aria-hidden="true" />
                                          </span>
                                        ) : null}
                                      </>
                                    )}
                                  </Listbox.Option>
                                ))}
                              </Listbox.Options>
                            </Transition>
                          </div>
                        </Listbox>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                          onClick={handleSaveRole}
                          disabled={isSaving || !selectedRole || selectedRole.value === editingUser.role}
                          className="flex-1 bg-brand-600 text-white px-4 py-2.5 sm:py-2 rounded-2xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-soft touch-target font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingUser(null)
                            setSelectedRole(null)
                          }}
                          className="flex-1 bg-white border border-white/60 text-ink-700 px-4 py-2.5 sm:py-2 rounded-2xl hover:bg-white/90 transition-colors shadow-soft touch-target font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  )
}
