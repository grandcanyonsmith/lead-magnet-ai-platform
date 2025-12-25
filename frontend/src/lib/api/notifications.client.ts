/**
 * Notifications API client
 */

import { BaseApiClient, TokenProvider } from "./base.client";
import { NotificationListResponse } from "@/types";

export class NotificationsClient extends BaseApiClient {
  constructor(tokenProvider: TokenProvider) {
    super(tokenProvider);
  }

  async getNotifications(
    unreadOnly?: boolean,
  ): Promise<NotificationListResponse> {
    const params: Record<string, string> = {};
    if (unreadOnly) {
      params.unread_only = "true";
    }
    return this.get<NotificationListResponse>("/admin/notifications", {
      params,
    });
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    return this.put<void>(`/admin/notifications/${notificationId}/read`);
  }

  async markAllNotificationsRead(): Promise<void> {
    return this.put<void>("/admin/notifications/read-all");
  }
}
