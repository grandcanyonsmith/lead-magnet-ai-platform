import { db } from "../utils/db";
import { ApiError } from "../utils/errors";
import { RouteResponse } from "../routes";
import { ulid } from "ulid";
import { env } from "../utils/env";

const NOTIFICATIONS_TABLE = env.notificationsTable;

export type NotificationType = "workflow_created" | "job_completed";

export interface NotificationData {
  notification_id: string;
  tenant_id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  read_at?: string;
  related_resource_id?: string; // workflow_id or job_id
  related_resource_type?: "workflow" | "job";
  created_at: string;
  ttl?: number; // TTL for auto-deletion (90 days)
}

class NotificationsController {
  async list(
    tenantId: string,
    queryParams: Record<string, any>,
  ): Promise<RouteResponse> {
    if (!NOTIFICATIONS_TABLE) {
      // Return empty notifications instead of error for better UX
      console.warn(
        "NOTIFICATIONS_TABLE environment variable is not configured",
      );
      return {
        statusCode: 200,
        body: {
          notifications: [],
          unread_count: 0,
          count: 0,
        },
      };
    }

    try {
      const unreadOnly = queryParams.unread_only === "true";
      const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;

      let notifications: any[] = [];

      if (unreadOnly) {
        // Query for unread notifications (read_at is null or doesn't exist)
        // We'll need to filter client-side since DynamoDB doesn't support null queries easily
        const result = await db.query(
          NOTIFICATIONS_TABLE,
          "gsi_tenant_created",
          "tenant_id = :tenant_id",
          { ":tenant_id": tenantId },
          undefined,
          limit * 2, // Get more to filter unread
        );
        notifications = result.items;
        // Filter for unread notifications
        notifications = notifications.filter((n: any) => !n.read && !n.read_at);
      } else {
        const result = await db.query(
          NOTIFICATIONS_TABLE,
          "gsi_tenant_created",
          "tenant_id = :tenant_id",
          { ":tenant_id": tenantId },
          undefined,
          limit,
        );
        notifications = result.items;
      }

      // Sort by created_at DESC (most recent first)
      notifications.sort((a: any, b: any) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA; // DESC order
      });

      // Limit after sorting
      notifications = notifications.slice(0, limit);

      const unreadCount = notifications.filter(
        (n: any) => !n.read && !n.read_at,
      ).length;

      return {
        statusCode: 200,
        body: {
          notifications,
          unread_count: unreadCount,
          count: notifications.length,
        },
      };
    } catch (error: any) {
      console.error("[Notifications] Error fetching notifications", {
        error: error.message,
        errorName: error.name,
        table: NOTIFICATIONS_TABLE,
        tenantId,
      });

      // If table doesn't exist or GSI doesn't exist, return empty list instead of error
      if (
        error.name === "ResourceNotFoundException" ||
        error.name === "ValidationException"
      ) {
        console.warn(
          "[Notifications] Table or GSI not found, returning empty list",
        );
        return {
          statusCode: 200,
          body: {
            notifications: [],
            unread_count: 0,
            count: 0,
          },
        };
      }

      // Re-throw other errors
      throw new ApiError(
        `Failed to fetch notifications: ${error.message}`,
        500,
      );
    }
  }

  async create(
    tenantId: string,
    type: NotificationType,
    title: string,
    message: string,
    relatedResourceId?: string,
    relatedResourceType?: "workflow" | "job",
  ): Promise<NotificationData> {
    if (!NOTIFICATIONS_TABLE) {
      throw new ApiError(
        "NOTIFICATIONS_TABLE environment variable is not configured",
        500,
      );
    }

    const notificationId = `notif_${ulid()}`;
    const now = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60; // 90 days

    const notification: NotificationData = {
      notification_id: notificationId,
      tenant_id: tenantId,
      type,
      title,
      message,
      read: false,
      related_resource_id: relatedResourceId,
      related_resource_type: relatedResourceType,
      created_at: now,
      ttl,
    };

    await db.put(NOTIFICATIONS_TABLE, notification);

    return notification;
  }

  async markAsRead(
    tenantId: string,
    notificationId: string,
  ): Promise<RouteResponse> {
    if (!NOTIFICATIONS_TABLE) {
      throw new ApiError(
        "NOTIFICATIONS_TABLE environment variable is not configured",
        500,
      );
    }

    const notification = await db.get(NOTIFICATIONS_TABLE, {
      notification_id: notificationId,
    });

    if (!notification) {
      throw new ApiError("Notification not found", 404);
    }

    if (notification.tenant_id !== tenantId) {
      throw new ApiError(
        "You don't have permission to access this notification",
        403,
      );
    }

    const now = new Date().toISOString();
    const updated = await db.update(
      NOTIFICATIONS_TABLE,
      { notification_id: notificationId },
      {
        read: true,
        read_at: now,
        updated_at: now,
      },
    );

    return {
      statusCode: 200,
      body: updated,
    };
  }

  async markAllAsRead(tenantId: string): Promise<RouteResponse> {
    if (!NOTIFICATIONS_TABLE) {
      throw new ApiError(
        "NOTIFICATIONS_TABLE environment variable is not configured",
        500,
      );
    }

    try {
      // Get all unread notifications for this tenant
      const result = await db.query(
        NOTIFICATIONS_TABLE,
        "gsi_tenant_created",
        "tenant_id = :tenant_id",
        { ":tenant_id": tenantId },
        undefined,
        1000, // Large limit to get all
      );

      const notifications = result.items;
      const unreadNotifications = notifications.filter(
        (n: any) => !n.read && !n.read_at,
      );
      const now = new Date().toISOString();

      // Update all unread notifications
      await Promise.all(
        unreadNotifications.map((notification: any) =>
          db.update(
            NOTIFICATIONS_TABLE,
            { notification_id: notification.notification_id },
            {
              read: true,
              read_at: now,
              updated_at: now,
            },
          ),
        ),
      );

      return {
        statusCode: 200,
        body: {
          message: `Marked ${unreadNotifications.length} notifications as read`,
          count: unreadNotifications.length,
        },
      };
    } catch (error: any) {
      console.error("[Notifications] Error marking all as read", {
        error: error.message,
        errorName: error.name,
        table: NOTIFICATIONS_TABLE,
        tenantId,
      });

      if (
        error.name === "ResourceNotFoundException" ||
        error.name === "ValidationException"
      ) {
        // Table doesn't exist, return success with 0 count
        return {
          statusCode: 200,
          body: {
            message: "Marked 0 notifications as read",
            count: 0,
          },
        };
      }

      throw new ApiError(
        `Failed to mark notifications as read: ${error.message}`,
        500,
      );
    }
  }

  async getUnreadCount(tenantId: string): Promise<number> {
    if (!NOTIFICATIONS_TABLE) {
      return 0;
    }

    try {
      const result = await db.query(
        NOTIFICATIONS_TABLE,
        "gsi_tenant_created",
        "tenant_id = :tenant_id",
        { ":tenant_id": tenantId },
        undefined,
        1000, // Large limit to count all
      );

      const notifications = result.items;
      return notifications.filter((n: any) => !n.read && !n.read_at).length;
    } catch (error) {
      console.error("Error getting unread count:", error);
      return 0;
    }
  }
}

export const notificationsController = new NotificationsController();
