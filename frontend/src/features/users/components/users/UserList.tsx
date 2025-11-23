'use client'

import { FiUsers } from 'react-icons/fi'
import { User } from '../../types'
import { UserCard } from './UserCard'
import { UserTable } from './UserTable'

interface UserListProps {
  users: User[]
  isLoading: boolean
  onEdit: (user: User) => void
  onImpersonate: (user: User) => void
  onCopyCustomerId: (customerId: string) => void
  copiedCustomerId: string | null
  isImpersonating: boolean
  impersonatingUserId: string | null
}

export function UserList({
  users,
  isLoading,
  onEdit,
  onImpersonate,
  onCopyCustomerId,
  copiedCustomerId,
  isImpersonating,
  impersonatingUserId,
}: UserListProps) {
  // Mobile card layout
  const mobileView = (
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
          <UserCard
            key={user.user_id}
            user={user}
            onEdit={onEdit}
            onImpersonate={onImpersonate}
            onCopyCustomerId={onCopyCustomerId}
            copiedCustomerId={copiedCustomerId}
            isImpersonating={isImpersonating}
            impersonatingUserId={impersonatingUserId}
          />
        ))
      )}
    </div>
  )

  return (
    <>
      {mobileView}
      <UserTable
        users={users}
        isLoading={isLoading}
        onEdit={onEdit}
        onImpersonate={onImpersonate}
        onCopyCustomerId={onCopyCustomerId}
        copiedCustomerId={copiedCustomerId}
        isImpersonating={isImpersonating}
        impersonatingUserId={impersonatingUserId}
      />
    </>
  )
}

