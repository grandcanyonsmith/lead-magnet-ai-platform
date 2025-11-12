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
    const queryParams: Record<string, string> = {}
    if (params?.status) queryParams.status = params.status
    if (params?.workflow_id) queryParams.workflow_id = params.workflow_id
    if (params?.limit) queryParams.limit = params.limit.toString()
    if (params?.offset !== undefined) queryParams.offset = params.offset.toString()
    
    return this.get<JobListResponse>('/admin/jobs', { params: queryParams })
  }

  async getJob(id: string): Promise<Job> {
    return this.get<Job>(`/admin/jobs/${id}`)
  }

  async resubmitJob(jobId: string): Promise<JobResubmitResponse> {
    return this.post<JobResubmitResponse>(`/admin/jobs/${jobId}/resubmit`)
  }

  async rerunStep(jobId: string, stepIndex: number): Promise<{ message: string; job_id: string; step_index: number }> {
    return this.post<{ message: string; job_id: string; step_index: number }>(`/admin/jobs/${jobId}/rerun-step`, {
      step_index: stepIndex,
    })
  }

  async quickEditStep(
    jobId: string,
    stepOrder: number,
    userPrompt: string,
    save?: boolean
  ): Promise<{
    original_output: any
    edited_output: any
    changes_summary: string
    saved: boolean
  }> {
    return this.post<{
      original_output: any
      edited_output: any
      changes_summary: string
      saved: boolean
    }>(`/admin/jobs/${jobId}/quick-edit-step`, {
      step_order: stepOrder,
      user_prompt: userPrompt,
      save: save === true,
    })
  }
}

