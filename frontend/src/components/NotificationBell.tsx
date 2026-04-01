"use client";

import React, { useState, useEffect, useCallback } from "react";
import { BellIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/Popover";
import { subscribeToNotificationsRefresh } from "@/utils/notifications/notificationEvents";

interface Notification {
  notification_id: string;
  type:
    | "workflow_created"
    | "job_completed"
    | "artifact_edit_completed"
    | "artifact_edit_failed";
  title: string;
  message: string;
  read: boolean;
  read_at?: string;
  related_resource_id?: string;
  related_resource_type?: "workflow" | "job";
  created_at: string;
}

type NotificationBellLayer = "global" | "account_menu";

interface NotificationBellProps {
  layer?: NotificationBellLayer;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  layer = "global",
}) => {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to load notifications:", error);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();

    const interval = setInterval(() => {
      loadNotifications();
    }, 30000);

    const unsubscribe = subscribeToNotificationsRefresh(() => {
      void loadNotifications();
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [loadNotifications]);

  const handleMarkAsRead = async (
    notificationId: string,
    e?: React.MouseEvent,
  ) => {
    if (e) {
      e.stopPropagation();
    }
    try {
      await api.markNotificationRead(notificationId);
      await loadNotifications();
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to mark notification as read:", error);
      }
    }
  };

  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.markAllNotificationsRead();
      await loadNotifications();
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to mark all notifications as read:", error);
      }
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await handleMarkAsRead(notification.notification_id);
    }

    if (
      notification.related_resource_type === "workflow" &&
      notification.related_resource_id
    ) {
      router.push(`/dashboard/workflows/${notification.related_resource_id}`);
    } else if (
      notification.related_resource_type === "job" &&
      notification.related_resource_id
    ) {
      router.push(`/dashboard/jobs/${notification.related_resource_id}`);
    }

    setOpen(false);
  };

  const formatTimeAgo = (dateString: string) => {
    const normalizeTimestamp = (raw: string) => {
      const s = String(raw || "").trim();
      if (!s) return s;

      const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s);
      const trimmedFraction = s.replace(/(\.\d{3})\d+/, "$1");
      return hasTz ? trimmedFraction : `${trimmedFraction}Z`;
    };

    const date = new Date(normalizeTimestamp(dateString));
    const now = new Date();
    if (Number.isNaN(date.getTime())) return "—";
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800)
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="relative p-2 text-gray-600 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground hover:bg-gray-100 dark:hover:bg-secondary rounded-lg transition-colors touch-target focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary"
        aria-label="Notifications"
      >
        <BellIcon className="w-5 h-5 sm:w-6 sm:h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className={`sm:w-80 md:w-96 p-0 rounded-xl shadow-2xl ${layer === "account_menu" ? "z-[60]" : "z-[101]"} max-h-[70vh] sm:max-h-[min(500px,calc(100vh-8rem))] overflow-hidden flex flex-col`}
      >
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-border">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-foreground">
            Notifications
          </h3>
          <div className="flex items-center space-x-1 sm:space-x-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-primary-600 dark:text-primary hover:text-primary-700 dark:hover:text-primary/80 font-medium py-1.5 sm:py-2 px-1.5 sm:px-2 touch-target"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 dark:text-muted-foreground hover:text-gray-600 dark:hover:text-foreground p-1.5 sm:p-2 rounded-md hover:bg-gray-100 dark:hover:bg-secondary touch-target"
              aria-label="Close notifications"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-4 text-center text-sm sm:text-base text-gray-500 dark:text-muted-foreground">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-6 sm:p-8 text-center text-gray-500 dark:text-muted-foreground">
              <BellIcon className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 text-gray-300 dark:text-muted-foreground/40" />
              <p className="text-sm sm:text-base">No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.notification_id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-3 sm:p-4 cursor-pointer transition-colors ${
                    notification.read
                      ? "bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-secondary/50"
                      : "bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1 gap-2">
                        <h4 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-foreground line-clamp-2 flex-1">
                          {notification.title}
                        </h4>
                        {!notification.read && (
                          <button
                            onClick={(e) =>
                              handleMarkAsRead(
                                notification.notification_id,
                                e,
                              )
                            }
                            className="ml-2 p-1.5 sm:p-2 text-gray-400 dark:text-muted-foreground hover:text-gray-600 dark:hover:text-foreground rounded-md hover:bg-gray-200 dark:hover:bg-secondary flex-shrink-0 touch-target"
                            aria-label="Mark as read"
                          >
                            <CheckIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-muted-foreground mb-1.5 sm:mb-2 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-400 dark:text-muted-foreground/70">
                        {formatTimeAgo(notification.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
