/**
 * Users feature exports
 */

// Types
export type { User, RoleOption, UsersListParams, UsersListResponse, UpdateUserRoleRequest, ImpersonateUserRequest, ImpersonateUserResponse } from './types'
export { ROLES } from './types'

// Hooks
export { useUsers, userKeys } from './hooks/useUsers'
export { useUpdateUserRole, useImpersonateUser, useCopyCustomerId } from './hooks/useUserActions'

// Components
export { UserSearchBar } from './components/users/UserSearchBar'
export { UserList } from './components/users/UserList'
export { UserCard } from './components/users/UserCard'
export { UserTable } from './components/users/UserTable'
export { UserTableRow } from './components/users/UserTableRow'
export { EditRoleModal } from './components/users/EditRoleModal'
export { RoleBadge } from './components/users/RoleBadge'
export { CopyCustomerIdButton } from './components/users/CopyCustomerIdButton'

// Utils
export { getRoleIcon, getRoleBadgeColor, formatUserDate, getRoleOption } from './utils/userUtils'

// Client
export { UsersClient } from './lib/users.client'

