/**
 * Users API client
 */

import { BaseApiClient, TokenProvider } from '@/shared/lib/api/base.client'
import {
  User,
  UsersListParams,
  UsersListResponse,
  UpdateUserRoleRequest,
  ImpersonateUserRequest,
  ImpersonateUserResponse,
} from '../types'

export class UsersClient extends BaseApiClient {
  constructor(tokenProvider: TokenProvider) {
    super(tokenProvider)
  }

  async getUsers(params?: UsersListParams): Promise<UsersListResponse> {
    const queryParams: Record<string, string> = {}
    if (params?.q) queryParams.q = params.q
    if (params?.limit) queryParams.limit = params.limit.toString()
    
    return this.get<UsersListResponse>('/admin/agency/users', { params: queryParams })
  }

  async updateUserRole(userId: string, data: UpdateUserRoleRequest): Promise<void> {
    return this.put<void>(`/admin/agency/users/${userId}`, data)
  }

  async impersonateUser(data: ImpersonateUserRequest): Promise<ImpersonateUserResponse> {
    return this.post<ImpersonateUserResponse>('/admin/impersonate', data)
  }
}

