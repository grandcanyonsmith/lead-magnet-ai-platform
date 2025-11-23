'use client'

import { getRoleIcon, getRoleBadgeColor } from '../../utils/userUtils'

interface RoleBadgeProps {
  role: string
  className?: string
}

export function RoleBadge({ role, className = '' }: RoleBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
        role
      )} ${className}`}
    >
      {getRoleIcon(role)}
      <span className="truncate max-w-[80px] sm:max-w-none">{role}</span>
    </span>
  )
}

