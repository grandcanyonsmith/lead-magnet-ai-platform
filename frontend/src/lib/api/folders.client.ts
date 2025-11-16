import { BaseApiClient, TokenProvider } from './base.client'
import { Folder, FolderCreateRequest, FolderUpdateRequest, FolderListResponse } from '@/types/folder'

export class FoldersClient extends BaseApiClient {
  constructor(tokenProvider?: TokenProvider) {
    super(tokenProvider)
  }

  async getFolders(params?: Record<string, unknown>): Promise<FolderListResponse> {
    const queryParams = new URLSearchParams()
    if (params?.limit) {
      queryParams.append('limit', String(params.limit))
    }

    const url = `/admin/folders${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return this.get<FolderListResponse>(url)
  }

  async getFolder(id: string): Promise<Folder> {
    return this.get<Folder>(`/admin/folders/${id}`)
  }

  async createFolder(data: FolderCreateRequest): Promise<Folder> {
    return this.post<Folder>('/admin/folders', data)
  }

  async updateFolder(id: string, data: FolderUpdateRequest): Promise<Folder> {
    return this.put<Folder>(`/admin/folders/${id}`, data)
  }

  async deleteFolder(id: string): Promise<{ message: string }> {
    return this.delete<{ message: string }>(`/admin/folders/${id}`)
  }
}


