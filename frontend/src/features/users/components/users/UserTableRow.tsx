'use client'

import { FiEdit2, FiLogIn } from 'react-icons/fi'
import { User } from '../../types'
import { RoleBadge } from './RoleBadge'
import { CopyCustomerIdButton } from './CopyCustomerIdButton'
import { formatUserDate } from '../../utils/userUtils'

interface UserTableRowProps {
  user: User
  onEdit: (user: User) => void
  onImpersonate: (user: User) => void
  onCopyCustomerId: (customerId: string) => void
  copiedCustomerId: string | null
  isImpersonating: boolean
  impersonatingUserId: string | null
}

export function UserTableRow({
  user,
  onEdit,
  onImpersonate,
  onCopyCustomerId,
  copiedCustomerId,
  isImpersonating,
  impersonatingUserId,
}: UserTableRowProps) {
  return (
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
          <CopyCustomerIdButton
            customerId={user.customer_id}
            copied={copiedCustomerId === user.customer_id}
            onCopy={() => onCopyCustomerId(user.customer_id)}
            size="md"
          />
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <RoleBadge role={user.role} />
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-500">
        {formatUserDate(user.created_at)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex items-center justify-end gap-4">
          <button
            onClick={() => onEdit(user)}
            className="text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors"
          >
            <FiEdit2 className="w-4 h-4" />
            Edit Role
          </button>
          <button
            onClick={() => onImpersonate(user)}
            disabled={isImpersonating && impersonatingUserId === user.user_id}
            className="text-brand-600 hover:text-brand-700 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FiLogIn className="w-4 h-4" />
            {isImpersonating && impersonatingUserId === user.user_id ? 'Logging in...' : 'Log in as'}
          </button>
        </div>
      </td>
    </tr>
  )
}

