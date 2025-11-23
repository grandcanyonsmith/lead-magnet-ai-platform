/**
 * Data fetching hooks for users using React Query
 */

'use client'

import { useMemo } from 'react'
import { useQuery } from '@/shared/hooks/useQuery'
import { UsersClient } from '../lib/users.client'
import { LocalStorageTokenProvider } from '@/shared/lib/api/token-provider'
import { User, UsersListParams, UsersListResponse } from '../types'
import { normalizeError } from '@/shared/hooks/hookHelpers'

// Query keys factory
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params?: UsersListParams) => [...userKeys.lists(), params] as const,
}

const usersClient = new UsersClient(new LocalStorageTokenProvider())

interface UseUsersResult {
  users: User[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useUsers(params?: UsersListParams): UseUsersResult {
  const queryKey = useMemo(() => userKeys.list(params), [params])
  
  const { data, isLoading, error, refetch } = useQuery<UsersListResponse>(
    queryKey,
    () => usersClient.getUsers(params),
    {
      enabled: true,
    }
  )

  return {
    users: data?.users || [],
    loading: isLoading,
    error: normalizeError(error),
    refetch: () => refetch(),
  }
}

