'use client'

import { useState } from 'react'
import { FiUsers } from 'react-icons/fi'
import { useAuth } from '@/features/auth/lib/auth/context'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useUpdateUserRole, useImpersonateUser, useCopyCustomerId } from '@/features/users/hooks/useUserActions'
import { UserSearchBar } from '@/features/users/components/users/UserSearchBar'
import { UserList } from '@/features/users/components/users/UserList'
import { EditRoleModal } from '@/features/users/components/users/EditRoleModal'
import { User } from '@/features/users/types'

export default function AgencyUsersPage() {
  const { role, viewMode } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [editingUser, setEditingUser] = useState<User | null>(null)

  const { users, loading } = useUsers({ q: searchTerm || undefined, limit: 100 })
  const { updateRole, isUpdating } = useUpdateUserRole()
  const { impersonate, isImpersonating, impersonatingUserId } = useImpersonateUser()
  const { copyCustomerId, copiedCustomerId } = useCopyCustomerId()

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

  const handleEdit = (user: User) => {
    setEditingUser(user)
  }

  const handleSaveRole = async (user: User, newRole: string) => {
    await updateRole(user, newRole)
  }

  const handleCloseModal = () => {
    setEditingUser(null)
  }

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

      <UserSearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />

      <UserList
        users={users}
        isLoading={loading}
        onEdit={handleEdit}
        onImpersonate={impersonate}
        onCopyCustomerId={copyCustomerId}
        copiedCustomerId={copiedCustomerId}
        isImpersonating={isImpersonating}
        impersonatingUserId={impersonatingUserId}
      />

      <EditRoleModal
        isOpen={editingUser !== null}
        user={editingUser}
        onClose={handleCloseModal}
        onSave={handleSaveRole}
        isSaving={isUpdating}
      />
    </div>
  )
}
