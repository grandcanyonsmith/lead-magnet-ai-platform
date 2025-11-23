'use client'

import { FiEdit2, FiLogIn } from 'react-icons/fi'
import { User } from '../../types'
import { RoleBadge } from './RoleBadge'
import { CopyCustomerIdButton } from './CopyCustomerIdButton'
import { formatUserDate } from '../../utils/userUtils'

interface UserCardProps {
  user: User
  onEdit: (user: User) => void
  onImpersonate: (user: User) => void
  onCopyCustomerId: (customerId: string) => void
  copiedCustomerId: string | null
  isImpersonating: boolean
  impersonatingUserId: string | null
}

export function UserCard({
  user,
  onEdit,
  onImpersonate,
  onCopyCustomerId,
  copiedCustomerId,
  isImpersonating,
  impersonatingUserId,
}: UserCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-soft border border-white/60 p-4 space-y-3 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-ink-900 truncate">
            {user.name || 'Unknown'}
          </div>
          <div className="text-sm text-ink-500 truncate mt-0.5">{user.email}</div>
        </div>
        <RoleBadge role={user.role} className="flex-shrink-0 ml-2" />
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
            <CopyCustomerIdButton
              customerId={user.customer_id}
              copied={copiedCustomerId === user.customer_id}
              onCopy={() => onCopyCustomerId(user.customer_id)}
              size="sm"
            />
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-500">Created:</span>
          <span className="text-ink-900">
            {formatUserDate(user.created_at)}
          </span>
        </div>
      </div>

      <div className="pt-2 border-t border-white/60 flex flex-col gap-2">
        <button
          onClick={() => onEdit(user)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50/60 rounded-2xl transition-colors touch-target"
        >
          <FiEdit2 className="w-4 h-4" />
          Edit Role
        </button>
        <button
          onClick={() => onImpersonate(user)}
          disabled={isImpersonating && impersonatingUserId === user.user_id}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50/60 rounded-2xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-target"
        >
          <FiLogIn className="w-4 h-4" />
          {isImpersonating && impersonatingUserId === user.user_id ? 'Logging in...' : 'Log in as'}
        </button>
      </div>
    </div>
  )
}

