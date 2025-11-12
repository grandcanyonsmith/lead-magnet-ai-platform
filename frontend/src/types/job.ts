/**
 * Job-related types
 */

import { BaseEntity, Status } from './common'

export interface Job extends BaseEntity {
  job_id: string
  tenant_id: string
  workflow_id: string
  status: Status
  created_at: string
  started_at?: string
  completed_at?: string
  failed_at?: string
  error_message?: string
  output_url?: string
  output_s3_key?: string
  submission_id?: string
  execution_steps_s3_url?: string
  execution_steps?: any[]
}

export interface JobListResponse {
  jobs: Job[]
  count?: number
  total?: number
  offset?: number
  limit?: number
  has_more?: boolean
}

export interface JobListParams {
  status?: Status
  workflow_id?: string
  limit?: number
  offset?: number
}

export interface JobResubmitResponse {
  job_id: string
  status: Status
}

