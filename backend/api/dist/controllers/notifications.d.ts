import { RouteResponse } from '../routes';
export type NotificationType = 'workflow_created' | 'job_completed';
export interface NotificationData {
    notification_id: string;
    tenant_id: string;
    type: NotificationType;
    title: string;
    message: string;
    read: boolean;
    read_at?: string;
    related_resource_id?: string;
    related_resource_type?: 'workflow' | 'job';
    created_at: string;
    ttl?: number;
}
declare class NotificationsController {
    list(tenantId: string, queryParams: Record<string, any>): Promise<RouteResponse>;
    create(tenantId: string, type: NotificationType, title: string, message: string, relatedResourceId?: string, relatedResourceType?: 'workflow' | 'job'): Promise<NotificationData>;
    markAsRead(tenantId: string, notificationId: string): Promise<RouteResponse>;
    markAllAsRead(tenantId: string): Promise<RouteResponse>;
    getUnreadCount(tenantId: string): Promise<number>;
}
export declare const notificationsController: NotificationsController;
export {};
//# sourceMappingURL=notifications.d.ts.map