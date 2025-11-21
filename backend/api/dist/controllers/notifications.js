"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsController = void 0;
const db_1 = require("../utils/db");
const errors_1 = require("../utils/errors");
const ulid_1 = require("ulid");
const env_1 = require("../utils/env");
const NOTIFICATIONS_TABLE = env_1.env.notificationsTable;
class NotificationsController {
    async list(tenantId, queryParams) {
        if (!NOTIFICATIONS_TABLE) {
            // Return empty notifications instead of error for better UX
            console.warn('NOTIFICATIONS_TABLE environment variable is not configured');
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
            const unreadOnly = queryParams.unread_only === 'true';
            const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;
            let notifications = [];
            if (unreadOnly) {
                // Query for unread notifications (read_at is null or doesn't exist)
                // We'll need to filter client-side since DynamoDB doesn't support null queries easily
                const result = await db_1.db.query(NOTIFICATIONS_TABLE, 'gsi_tenant_created', 'tenant_id = :tenant_id', { ':tenant_id': tenantId }, undefined, limit * 2 // Get more to filter unread
                );
                notifications = result.items;
                // Filter for unread notifications
                notifications = notifications.filter((n) => !n.read && !n.read_at);
            }
            else {
                const result = await db_1.db.query(NOTIFICATIONS_TABLE, 'gsi_tenant_created', 'tenant_id = :tenant_id', { ':tenant_id': tenantId }, undefined, limit);
                notifications = result.items;
            }
            // Sort by created_at DESC (most recent first)
            notifications.sort((a, b) => {
                const dateA = new Date(a.created_at || 0).getTime();
                const dateB = new Date(b.created_at || 0).getTime();
                return dateB - dateA; // DESC order
            });
            // Limit after sorting
            notifications = notifications.slice(0, limit);
            const unreadCount = notifications.filter((n) => !n.read && !n.read_at).length;
            return {
                statusCode: 200,
                body: {
                    notifications,
                    unread_count: unreadCount,
                    count: notifications.length,
                },
            };
        }
        catch (error) {
            console.error('[Notifications] Error fetching notifications', {
                error: error.message,
                errorName: error.name,
                table: NOTIFICATIONS_TABLE,
                tenantId,
            });
            // If table doesn't exist or GSI doesn't exist, return empty list instead of error
            if (error.name === 'ResourceNotFoundException' || error.name === 'ValidationException') {
                console.warn('[Notifications] Table or GSI not found, returning empty list');
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
            throw new errors_1.ApiError(`Failed to fetch notifications: ${error.message}`, 500);
        }
    }
    async create(tenantId, type, title, message, relatedResourceId, relatedResourceType) {
        if (!NOTIFICATIONS_TABLE) {
            throw new errors_1.ApiError('NOTIFICATIONS_TABLE environment variable is not configured', 500);
        }
        const notificationId = `notif_${(0, ulid_1.ulid)()}`;
        const now = new Date().toISOString();
        const ttl = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60; // 90 days
        const notification = {
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
        await db_1.db.put(NOTIFICATIONS_TABLE, notification);
        return notification;
    }
    async markAsRead(tenantId, notificationId) {
        if (!NOTIFICATIONS_TABLE) {
            throw new errors_1.ApiError('NOTIFICATIONS_TABLE environment variable is not configured', 500);
        }
        const notification = await db_1.db.get(NOTIFICATIONS_TABLE, { notification_id: notificationId });
        if (!notification) {
            throw new errors_1.ApiError('Notification not found', 404);
        }
        if (notification.tenant_id !== tenantId) {
            throw new errors_1.ApiError('You don\'t have permission to access this notification', 403);
        }
        const now = new Date().toISOString();
        const updated = await db_1.db.update(NOTIFICATIONS_TABLE, { notification_id: notificationId }, {
            read: true,
            read_at: now,
            updated_at: now,
        });
        return {
            statusCode: 200,
            body: updated,
        };
    }
    async markAllAsRead(tenantId) {
        if (!NOTIFICATIONS_TABLE) {
            throw new errors_1.ApiError('NOTIFICATIONS_TABLE environment variable is not configured', 500);
        }
        try {
            // Get all unread notifications for this tenant
            const result = await db_1.db.query(NOTIFICATIONS_TABLE, 'gsi_tenant_created', 'tenant_id = :tenant_id', { ':tenant_id': tenantId }, undefined, 1000 // Large limit to get all
            );
            const notifications = result.items;
            const unreadNotifications = notifications.filter((n) => !n.read && !n.read_at);
            const now = new Date().toISOString();
            // Update all unread notifications
            await Promise.all(unreadNotifications.map((notification) => db_1.db.update(NOTIFICATIONS_TABLE, { notification_id: notification.notification_id }, {
                read: true,
                read_at: now,
                updated_at: now,
            })));
            return {
                statusCode: 200,
                body: {
                    message: `Marked ${unreadNotifications.length} notifications as read`,
                    count: unreadNotifications.length,
                },
            };
        }
        catch (error) {
            console.error('[Notifications] Error marking all as read', {
                error: error.message,
                errorName: error.name,
                table: NOTIFICATIONS_TABLE,
                tenantId,
            });
            if (error.name === 'ResourceNotFoundException' || error.name === 'ValidationException') {
                // Table doesn't exist, return success with 0 count
                return {
                    statusCode: 200,
                    body: {
                        message: 'Marked 0 notifications as read',
                        count: 0,
                    },
                };
            }
            throw new errors_1.ApiError(`Failed to mark notifications as read: ${error.message}`, 500);
        }
    }
    async getUnreadCount(tenantId) {
        if (!NOTIFICATIONS_TABLE) {
            return 0;
        }
        try {
            const result = await db_1.db.query(NOTIFICATIONS_TABLE, 'gsi_tenant_created', 'tenant_id = :tenant_id', { ':tenant_id': tenantId }, undefined, 1000 // Large limit to count all
            );
            const notifications = result.items;
            return notifications.filter((n) => !n.read && !n.read_at).length;
        }
        catch (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }
    }
}
exports.notificationsController = new NotificationsController();
//# sourceMappingURL=notifications.js.map