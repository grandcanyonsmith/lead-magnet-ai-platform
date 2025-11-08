/**
 * Jobs API client
 */

import { BaseApiClient, TokenProvider } from './base.client'
import {
  Job,
  JobListResponse,
  JobListParams,
  JobResubmitResponse,
} from '@/types'

export class JobsClient extends BaseApiClient {
  constructor(tokenProvider: TokenProvider) {
    super(tokenProvider)
  }

  async getJobs(params?: JobListParams): Promise<JobListResponse> {
    return this.get<JobListResponse>('/admin/jobs', { params })
  }

  async getJob(id: string): Promise<Job> {
    return this.get<Job>(`/admin/jobs/${id}`)
  }

  async resubmitJob(jobId: string): Promise<JobResubmitResponse> {
    return this.post<JobResubmitResponse>(`/admin/jobs/${jobId}/resubmit`)
  }
}

