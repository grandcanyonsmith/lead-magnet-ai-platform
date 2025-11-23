import { FiShield, FiUser, FiUserCheck } from 'react-icons/fi'

export interface User {
  user_id: string
  email: string
  name: string
  customer_id: string
  role: string
  created_at: string
}

export interface RoleOption {
  value: string
  label: string
  icon: typeof FiUser
  color: string
}

export const ROLES: RoleOption[] = [
  { value: 'USER', label: 'USER', icon: FiUser, color: 'text-ink-600' },
  { value: 'ADMIN', label: 'ADMIN', icon: FiUserCheck, color: 'text-blue-600' },
  { value: 'SUPER_ADMIN', label: 'SUPER_ADMIN', icon: FiShield, color: 'text-purple-600' },
]

export interface UsersListParams {
  q?: string
  limit?: number
}

export interface UsersListResponse {
  users: User[]
}

export interface UpdateUserRoleRequest {
  role: string
}

export interface ImpersonateUserRequest {
  targetUserId: string
}

export interface ImpersonateUserResponse {
  session_id: string
}

