/**
 * Data fetching hooks for notifications using React Query
 */

'use client'

import { useMemo } from 'react'
import { useQuery } from '@/hooks/useQuery'
import { useMutation } from '@/hooks/useMutation'
import { api } from '@/lib/api'
import { Notification, NotificationListResponse } from '@/types'
import { normalizeError, extractListData } from './hookHelpers'

// Query keys factory
export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (unreadOnly?: boolean) => [...notificationKeys.lists(), { unreadOnly }] as const,
}

interface UseNotificationsResult {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  error: string | null
  refetch: () => void
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
}

export function useNotifications(unreadOnly?: boolean): UseNotificationsResult {
  const queryKey = useMemo(() => notificationKeys.list(unreadOnly), [unreadOnly])
  
  const { data, isLoading, error, refetch } = useQuery<NotificationListResponse>(
    queryKey,
    () => api.getNotifications(unreadOnly),
    {
      enabled: true,
    }
  )

  const markAsReadMutation = useMutation<void, Error, string>(
    (notificationId: string) => api.markNotificationRead(notificationId),
    {
      showSuccessToast: false,
      showErrorToast: false,
      invalidateQueries: [notificationKeys.all],
    }
  )

  const markAllAsReadMutation = useMutation<void, Error, void>(
    () => api.markAllNotificationsRead(),
    {
      showSuccessToast: 'All notifications marked as read',
      showErrorToast: true,
      invalidateQueries: [notificationKeys.all],
    }
  )

  return {
    notifications: data?.notifications ?? [],
    unreadCount: data?.unread_count || 0,
    loading: isLoading,
    error: normalizeError(error),
    refetch: () => refetch(),
    markAsRead: async (notificationId: string) => {
      await markAsReadMutation.mutateAsync(notificationId)
    },
    markAllAsRead: async () => {
      await markAllAsReadMutation.mutateAsync(undefined)
    },
  }
}

interface UseNotificationsPollingOptions {
  enabled?: boolean
  interval?: number
}

export function useNotificationsPolling(
  unreadOnly?: boolean,
  options: UseNotificationsPollingOptions = {}
): UseNotificationsResult {
  const { enabled = true, interval = 30000 } = options
  const queryKey = useMemo(() => notificationKeys.list(unreadOnly), [unreadOnly])
  
  const { data, isLoading, error, refetch } = useQuery<NotificationListResponse>(
    queryKey,
    () => api.getNotifications(unreadOnly),
    {
      enabled,
      refetchInterval: interval,
    }
  )

  const markAsReadMutation = useMutation<void, Error, string>(
    (notificationId: string) => api.markNotificationRead(notificationId),
    {
      showSuccessToast: false,
      showErrorToast: false,
      invalidateQueries: [notificationKeys.all],
    }
  )

  const markAllAsReadMutation = useMutation<void, Error, void>(
    () => api.markAllNotificationsRead(),
    {
      showSuccessToast: 'All notifications marked as read',
      showErrorToast: true,
      invalidateQueries: [notificationKeys.all],
    }
  )

  return {
    notifications: data?.notifications ?? [],
    unreadCount: data?.unread_count || 0,
    loading: isLoading,
    error: normalizeError(error),
    refetch: () => refetch(),
    markAsRead: async (notificationId: string) => {
      await markAsReadMutation.mutateAsync(notificationId)
    },
    markAllAsRead: async () => {
      await markAllAsReadMutation.mutateAsync(undefined)
    },
  }
}

