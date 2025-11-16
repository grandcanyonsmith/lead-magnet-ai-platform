/**
 * Submissions API client
 */

import { BaseApiClient, TokenProvider } from './base.client'
import { FormSubmission } from '@/shared/types'

export class SubmissionsClient extends BaseApiClient {
  constructor(tokenProvider: TokenProvider) {
    super(tokenProvider)
  }

  async getSubmissions(params?: { form_id?: string; limit?: number }): Promise<{ submissions: FormSubmission[]; count: number }> {
    return this.get<{ submissions: FormSubmission[]; count: number }>('/admin/submissions', { params })
  }

  async getSubmission(id: string): Promise<FormSubmission> {
    return this.get<FormSubmission>(`/admin/submissions/${id}`)
  }
}

