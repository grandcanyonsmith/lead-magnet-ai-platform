/**
 * Hooks for user actions (update role, impersonate, copy customer ID)
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@/shared/hooks/useMutation'
import { useAuth } from '@/features/auth/lib/auth/context'
import { UsersClient } from '../lib/users.client'
import { LocalStorageTokenProvider } from '@/shared/lib/api/token-provider'
import { User, UpdateUserRoleRequest, ImpersonateUserRequest } from '../types'
import { userKeys } from './useUsers'
import { toast } from 'react-hot-toast'

const usersClient = new UsersClient(new LocalStorageTokenProvider())

interface UseUpdateUserRoleResult {
  updateRole: (user: User, role: string) => Promise<void>
  isUpdating: boolean
  error: string | null
}

export function useUpdateUserRole(): UseUpdateUserRoleResult {
  const { mutateAsync, isPending, error } = useMutation<void, Error, { userId: string; data: UpdateUserRoleRequest }>(
    ({ userId, data }) => usersClient.updateUserRole(userId, data),
    {
      showSuccessToast: 'User role updated successfully',
      showErrorToast: 'Failed to update user role. Please try again.',
      invalidateQueries: [userKeys.all],
    }
  )

  return {
    updateRole: async (user: User, role: string) => {
      await mutateAsync({ userId: user.user_id, data: { role } })
    },
    isUpdating: isPending,
    error: error instanceof Error ? error.message : error ? String(error) : null,
  }
}

interface UseImpersonateUserResult {
  impersonate: (user: User) => Promise<void>
  isImpersonating: boolean
  impersonatingUserId: string | null
  error: string | null
}

export function useImpersonateUser(): UseImpersonateUserResult {
  const router = useRouter()
  const { refreshAuth, setViewMode } = useAuth()
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null)

  const { mutateAsync, isPending, error } = useMutation<{ session_id: string }, Error, ImpersonateUserRequest>(
    (data) => usersClient.impersonateUser(data),
    {
      showErrorToast: 'Failed to login as this user. Please try again.',
    }
  )

  const impersonate = async (user: User) => {
    setImpersonatingUserId(user.user_id)
    try {
      const response = await mutateAsync({ targetUserId: user.user_id })

      localStorage.setItem('impersonation_session_id', response.session_id)
      await refreshAuth()

      if (user.customer_id) {
        setViewMode('subaccount', user.customer_id)
      } else {
        setViewMode('subaccount')
      }

      router.push('/dashboard')
    } catch (error) {
      console.error('Error starting impersonation from agency table:', error)
      // Error toast is handled by the mutation hook
    } finally {
      setImpersonatingUserId(null)
    }
  }

  return {
    impersonate,
    isImpersonating: isPending,
    impersonatingUserId,
    error: error instanceof Error ? error.message : error ? String(error) : null,
  }
}

interface UseCopyCustomerIdResult {
  copyCustomerId: (customerId: string) => Promise<void>
  copiedCustomerId: string | null
}

export function useCopyCustomerId(): UseCopyCustomerIdResult {
  const [copiedCustomerId, setCopiedCustomerId] = useState<string | null>(null)

  const copyCustomerId = async (customerId: string) => {
    try {
      await navigator.clipboard.writeText(customerId)
      setCopiedCustomerId(customerId)
      setTimeout(() => setCopiedCustomerId(null), 2000)
    } catch (error) {
      console.error('Failed to copy customer ID:', error)
      toast.error('Failed to copy customer ID')
    }
  }

  return {
    copyCustomerId,
    copiedCustomerId,
  }
}

