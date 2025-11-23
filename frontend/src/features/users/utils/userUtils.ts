import { FiUser } from 'react-icons/fi'
import { ROLES, RoleOption } from '../types'

export function getRoleOption(role: string): RoleOption {
  return ROLES.find(r => r.value === role) || ROLES[0]
}

export function getRoleIcon(role: string) {
  const roleOption = getRoleOption(role)
  const Icon = roleOption.icon
  return <Icon className={`w-4 h-4 ${roleOption.color}`} />
}

export function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'bg-purple-100 text-purple-700'
    case 'ADMIN':
      return 'bg-blue-100 text-blue-700'
    default:
      return 'bg-surface-50 text-ink-700'
  }
}

export function formatUserDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString()
}

