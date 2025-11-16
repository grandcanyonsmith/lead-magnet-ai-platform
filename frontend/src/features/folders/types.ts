/**
 * Folder-related types
 */

import { BaseEntity } from '@/shared/types/common'

export interface Folder extends BaseEntity {
  folder_id: string
  tenant_id: string
  folder_name: string
}

export interface FolderCreateRequest {
  folder_name: string
}

export interface FolderUpdateRequest {
  folder_name?: string
}

export interface FolderListResponse {
  folders: Folder[]
  count?: number
}


