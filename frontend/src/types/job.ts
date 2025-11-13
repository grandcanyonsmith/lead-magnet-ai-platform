/**
 * Job-related types
 */

import { BaseEntity, Status } from './common'

export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export type StepType = 'workflow_step' | 'ai_generation' | 'form_submission' | 'html_generation' | 'final_output'

export interface ExecutionStepUsageInfo {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  cost_usd?: number
}

export interface ExecutionStepInput {
  tools?: string[] | unknown[]
  tool_choice?: string
  [key: string]: unknown
}

export interface ExecutionStep {
  step_order: number
  step_type: StepType
  step_name?: string
  model?: string
  tools?: string[] | unknown[]
  tool_choice?: string
  instructions?: string
  input?: ExecutionStepInput
  output?: string | null
  error?: string
  started_at?: string
  completed_at?: string
  duration_ms?: number
  usage_info?: ExecutionStepUsageInfo
  _status?: StepStatus
  artifact_id?: string
  image_urls?: string[]
}

export interface MergedStep extends ExecutionStep {
  _status: StepStatus
}

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
  execution_steps_s3_key?: string
  execution_steps_s3_url?: string
  execution_steps?: ExecutionStep[]
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

