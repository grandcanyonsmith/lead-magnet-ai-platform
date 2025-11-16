/**
 * Notification-related types
 */

import { BaseEntity } from '@/shared/types/common'

export type NotificationType = 'workflow_created' | 'job_completed'

export type RelatedResourceType = 'workflow' | 'job'

export interface Notification extends BaseEntity {
  notification_id: string
  tenant_id: string
  type: NotificationType
  title: string
  message: string
  read: boolean
  read_at?: string
  related_resource_id?: string
  related_resource_type?: RelatedResourceType
  created_at: string
}

export interface NotificationListResponse {
  notifications: Notification[]
  unread_count: number
}

