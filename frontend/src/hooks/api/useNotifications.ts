/**
 * Data fetching hooks for notifications
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Notification, NotificationListResponse } from '@/types'

interface UseNotificationsResult {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
}

export function useNotifications(unreadOnly?: boolean): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.getNotifications(unreadOnly)
      setNotifications(response.notifications || [])
      setUnreadCount(response.unread_count || 0)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load notifications'
      setError(errorMessage)
      console.error('Failed to load notifications:', err)
    } finally {
      setLoading(false)
    }
  }, [unreadOnly])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await api.markNotificationRead(notificationId)
      await fetchNotifications()
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }, [fetchNotifications])

  const markAllAsRead = useCallback(async () => {
    try {
      await api.markAllNotificationsRead()
      await fetchNotifications()
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err)
    }
  }, [fetchNotifications])

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refetch: fetchNotifications,
    markAsRead,
    markAllAsRead,
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
  const result = useNotifications(unreadOnly)

  useEffect(() => {
    if (!enabled) return

    const pollInterval = setInterval(() => {
      result.refetch()
    }, interval)

    return () => clearInterval(pollInterval)
  }, [enabled, interval, result.refetch])

  return result
}

