/**
 * Analytics API client
 */

import { BaseApiClient, TokenProvider } from './base.client'
import {
  AnalyticsResponse,
} from '@/shared/types'

export class AnalyticsClient extends BaseApiClient {
  constructor(tokenProvider: TokenProvider) {
    super(tokenProvider)
  }

  async getAnalytics(params?: Record<string, unknown>): Promise<AnalyticsResponse> {
    return this.get<AnalyticsResponse>('/admin/analytics', { params })
  }
}

