/**
 * Artifacts API client
 */

import { BaseApiClient, TokenProvider } from '@/shared/lib/api/base.client'
import {
  Artifact,
  ArtifactListResponse,
  ArtifactListParams,
} from '@/shared/types'

export class ArtifactsClient extends BaseApiClient {
  constructor(tokenProvider: TokenProvider) {
    super(tokenProvider)
  }

  async getArtifacts(params?: ArtifactListParams): Promise<ArtifactListResponse> {
    return this.get<ArtifactListResponse>('/admin/artifacts', { params })
  }

  async getArtifact(id: string): Promise<Artifact> {
    return this.get<Artifact>(`/admin/artifacts/${id}`)
  }

  async getArtifactContent(id: string): Promise<string> {
    const response = await this.client.get(`/admin/artifacts/${id}/content`, {
      responseType: 'text',
    })
    return response.data
  }
}

