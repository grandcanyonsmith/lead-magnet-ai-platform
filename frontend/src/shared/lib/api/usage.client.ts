/**
 * Usage/Billing API client
 */

import { BaseApiClient, TokenProvider } from './base.client'
import {
  UsageResponse,
} from '@/shared/types'

export class UsageClient extends BaseApiClient {
  constructor(tokenProvider: TokenProvider) {
    super(tokenProvider)
  }

  async getUsage(startDate?: string, endDate?: string): Promise<UsageResponse> {
    const params: Record<string, string> = {}
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate
    return this.get<UsageResponse>('/admin/billing/usage', { params })
  }
}

