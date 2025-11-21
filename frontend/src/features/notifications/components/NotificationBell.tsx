'use client'

import React, { useState, useEffect, useRef } from 'react'
import { FiBell, FiCheck, FiX } from 'react-icons/fi'
import { useRouter } from 'next/navigation'
import { api } from '@/shared/lib/api'

interface Notification {
  notification_id: string
  type: 'workflow_created' | 'job_completed'
  title: string
  message: string
  read: boolean
  read_at?: string
  related_resource_id?: string
  related_resource_type?: 'workflow' | 'job'
  created_at: string
}

export const NotificationBell: React.FC = () => {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadNotifications()
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      loadNotifications()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const loadNotifications = async () => {
    try {
      const data = await api.getNotifications()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unread_count || 0)
    } catch (error) {
      console.error('Failed to load notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (notificationId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    try {
      await api.markNotificationRead(notificationId)
      await loadNotifications()
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await api.markAllNotificationsRead()
      await loadNotifications()
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if unread
    if (!notification.read) {
      await handleMarkAsRead(notification.notification_id)
    }
    
    // Navigate to related resource
    if (notification.related_resource_type === 'workflow' && notification.related_resource_id) {
      router.push(`/dashboard/workflows/${notification.related_resource_id}`)
    } else if (notification.related_resource_type === 'job' && notification.related_resource_id) {
      router.push(`/dashboard/jobs/${notification.related_resource_id}`)
    }
    
    setIsOpen(false)
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/60 bg-white/80 text-ink-500 shadow-soft transition hover:text-ink-900"
        aria-label="Notifications"
      >
        <FiBell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/70 bg-brand-500 text-xs font-semibold text-white shadow-soft">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-3 flex max-h-[26rem] w-[calc(100vw-1rem)] max-w-md flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/95 shadow-soft backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/60 px-4 py-3">
            <h3 className="text-base font-semibold text-ink-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs font-semibold text-brand-600 transition hover:text-brand-700"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-2xl border border-white/60 bg-white/70 p-2 text-ink-300 transition hover:text-ink-500"
                aria-label="Close notifications"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-ink-400">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center text-ink-400">
                <FiBell className="h-10 w-10 text-ink-200" />
                <p>No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-white/70">
                {notifications.map((notification) => (
                  <div
                    key={notification.notification_id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`cursor-pointer px-4 py-3 transition ${
                      notification.read
                        ? 'bg-white/70 hover:bg-white/90'
                        : 'bg-brand-50/80 hover:bg-brand-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <h4 className="text-sm font-semibold text-ink-900 truncate">
                            {notification.title}
                          </h4>
                          {!notification.read && (
                            <button
                              onClick={(e) => handleMarkAsRead(notification.notification_id, e)}
                              className="ml-2 flex-shrink-0 rounded-2xl border border-white/60 bg-white/80 p-1.5 text-ink-300 shadow-soft transition hover:text-brand-600"
                              aria-label="Mark as read"
                            >
                              <FiCheck className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <p className="mb-2 line-clamp-2 text-sm text-ink-500">
                          {notification.message}
                        </p>
                        <p className="text-xs text-ink-400">
                          {formatTimeAgo(notification.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

