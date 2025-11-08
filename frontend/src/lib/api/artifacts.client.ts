/**
 * Artifacts API client
 */

import { BaseApiClient, TokenProvider } from './base.client'
import {
  Artifact,
  ArtifactListResponse,
  ArtifactListParams,
} from '@/types'

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
}

