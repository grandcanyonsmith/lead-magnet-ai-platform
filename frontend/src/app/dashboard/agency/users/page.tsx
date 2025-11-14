'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { api } from '@/lib/api'
import { FiUsers, FiSearch, FiEdit2, FiShield, FiUser, FiUserCheck, FiLogIn, FiCopy, FiCheck } from 'react-icons/fi'

interface User {
  user_id: string
  email: string
  name: string
  customer_id: string
  role: string
  created_at: string
}

export default function AgencyUsersPage() {
  const { role, viewMode, refreshAuth, setViewMode } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [newRole, setNewRole] = useState<string>('')
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
      <div className="max-w-4xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            This page is only available to Super Admins in Agency View.
          </p>
        </div>
      </div>
    )
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setNewRole(user.role)
  }

  const handleSaveRole = async () => {
    if (!editingUser || !newRole) return

    setIsSaving(true)
    try {
      await api.put(`/admin/agency/users/${editingUser.user_id}`, {
        role: newRole,
      })
      await loadUsers()
      setEditingUser(null)
      setNewRole('')
    } catch (error) {
      console.error('Error updating user role:', error)
      alert('Failed to update user role. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <FiShield className="w-4 h-4 text-purple-600" />
      case 'ADMIN':
        return <FiUserCheck className="w-4 h-4 text-blue-600" />
      default:
        return <FiUser className="w-4 h-4 text-gray-600" />
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-700'
      case 'ADMIN':
        return 'bg-blue-100 text-blue-700'
      default:
        return 'bg-gray-100 text-gray-700'
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
      alert('Failed to login as this user. Please try again.')
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FiUsers className="w-5 h-5 sm:w-6 sm:h-6" />
          User Management
        </h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">Manage users, roles, and permissions across all accounts</p>
      </div>

      {/* Search */}
      <div className="mb-4 sm:mb-6">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
          <input
            type="text"
            placeholder="Search by name or email..."
            className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Mobile Card Layout */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
            No users found
          </div>
        ) : (
          users.map((user) => (
            <div
              key={user.user_id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {user.name || 'Unknown'}
                  </div>
                  <div className="text-sm text-gray-500 truncate mt-0.5">{user.email}</div>
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
              
              <div className="pt-2 border-t border-gray-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Customer ID:</span>
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end ml-2">
                    <span className="text-gray-900 font-mono truncate max-w-[140px]" title={user.customer_id}>
                      {user.customer_id}
                    </span>
                    <button
                      onClick={() => handleCopyCustomerId(user.customer_id)}
                      className="flex-shrink-0 p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors touch-target"
                      title={copiedCustomerId === user.customer_id ? 'Copied!' : 'Copy Customer ID'}
                      aria-label="Copy Customer ID"
                    >
                      {copiedCustomerId === user.customer_id ? (
                        <FiCheck className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <FiCopy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Created:</span>
                  <span className="text-gray-900">
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
                <button
                  onClick={() => handleEditUser(user)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-primary-600 hover:text-primary-900 hover:bg-primary-50 rounded-lg transition-colors touch-target"
                >
                  <FiEdit2 className="w-4 h-4" />
                  Edit Role
                </button>
                <button
                  onClick={() => handleImpersonate(user)}
                  disabled={impersonatingUserId === user.user_id}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-target"
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
      <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.user_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {user.name || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-gray-900 font-mono">{user.customer_id}</div>
                        <button
                          onClick={() => handleCopyCustomerId(user.customer_id)}
                          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors touch-target"
                          title={copiedCustomerId === user.customer_id ? 'Copied!' : 'Copy Customer ID'}
                          aria-label="Copy Customer ID"
                        >
                          {copiedCustomerId === user.customer_id ? (
                            <FiCheck className="w-4 h-4 text-green-600" />
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-4">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="text-primary-600 hover:text-primary-900 flex items-center gap-1 transition-colors"
                        >
                          <FiEdit2 className="w-4 h-4" />
                          Edit Role
                        </button>
                        <button
                          onClick={() => handleImpersonate(user)}
                          disabled={impersonatingUserId === user.user_id}
                          className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

      {/* Edit Role Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full mx-auto shadow-xl">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Edit User Role</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>User:</strong> {editingUser.name || editingUser.email}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Current Role:</strong> {editingUser.role}
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Role
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full px-3 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              </select>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleSaveRole}
                disabled={isSaving || newRole === editingUser.role}
                className="flex-1 bg-primary-600 text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-target font-medium"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setEditingUser(null)
                  setNewRole('')
                }}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2.5 sm:py-2 rounded-lg hover:bg-gray-300 transition-colors touch-target font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
