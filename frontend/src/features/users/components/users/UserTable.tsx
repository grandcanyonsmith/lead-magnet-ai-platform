'use client'

import { FiUsers } from 'react-icons/fi'
import { User } from '../../types'
import { UserTableRow } from './UserTableRow'

interface UserTableProps {
  users: User[]
  isLoading: boolean
  onEdit: (user: User) => void
  onImpersonate: (user: User) => void
  onCopyCustomerId: (customerId: string) => void
  copiedCustomerId: string | null
  isImpersonating: boolean
  impersonatingUserId: string | null
}

export function UserTable({
  users,
  isLoading,
  onEdit,
  onImpersonate,
  onCopyCustomerId,
  copiedCustomerId,
  isImpersonating,
  impersonatingUserId,
}: UserTableProps) {
  if (isLoading) {
    return (
      <div className="hidden md:block bg-white rounded-2xl shadow-soft border border-white/60 overflow-hidden">
        <div className="p-8 text-center text-ink-500">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
          <p className="mt-2">Loading users...</p>
        </div>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="hidden md:block bg-white rounded-2xl shadow-soft border border-white/60 overflow-hidden">
        <div className="p-8 text-center text-ink-500">
          <FiUsers className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No users found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="hidden md:block bg-white rounded-2xl shadow-soft border border-white/60 overflow-hidden">
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
              <UserTableRow
                key={user.user_id}
                user={user}
                onEdit={onEdit}
                onImpersonate={onImpersonate}
                onCopyCustomerId={onCopyCustomerId}
                copiedCustomerId={copiedCustomerId}
                isImpersonating={isImpersonating}
                impersonatingUserId={impersonatingUserId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

