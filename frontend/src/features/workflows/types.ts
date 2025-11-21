/**
 * Workflow-related types
 */

import { BaseEntity } from '@/shared/types/common'
import { FormField } from '@/features/forms/types'

export type AIModel = 
  | 'gpt-5'
  | 'gpt-4.1'
  | 'gpt-4o'
  | 'gpt-4-turbo'
  | 'gpt-3.5-turbo'
  | 'computer-use-preview'

export type ToolChoice = 'auto' | 'required' | 'none'

export type ToolType = 
  | 'web_search'
  | 'web_search_preview'
  | 'image_generation'
  | 'computer_use_preview'
  | 'file_search'
  | 'code_interpreter'

export interface ComputerUseToolConfig {
  type: 'computer_use_preview'
  display_width: number
  display_height: number
  environment: 'browser' | 'mac' | 'windows' | 'ubuntu'
}

export type Tool = ToolType | ComputerUseToolConfig

export interface WorkflowStep {
  step_name: string
  step_description?: string
  step_type?: 'ai_generation' | 'webhook' // Default: 'ai_generation'
  model: AIModel
  instructions: string
  step_order?: number
  tools?: Tool[]
  tool_choice?: ToolChoice
  depends_on?: number[] // Array of step indices this step depends on
  // Webhook step fields
  webhook_url?: string
  webhook_headers?: Record<string, string>
  webhook_data_selection?: {
    include_submission: boolean
    exclude_step_indices?: number[] // Steps to exclude (all included by default)
    include_job_info: boolean
  }
}

export type DeliveryMethod = 'webhook' | 'sms' | 'none'

export interface WorkflowDeliveryConfig {
  delivery_method: DeliveryMethod
  delivery_webhook_url: string
  delivery_webhook_headers: Record<string, string>
  delivery_sms_enabled: boolean
  delivery_sms_message: string
  delivery_sms_ai_generated: boolean
  delivery_sms_ai_instructions: string
}

export interface Workflow extends BaseEntity {
  workflow_id: string
  tenant_id: string
  workflow_name: string
  workflow_description: string
  template_id: string
  template_version: number
  steps?: WorkflowStep[]
  status: 'active' | 'inactive' | 'draft'
  folder_id?: string | null
  form?: {
    form_id: string
    form_name: string
    public_slug: string
    status: string
  }
  // Note: Legacy fields (ai_model, ai_instructions, rewrite_model, research_enabled, html_enabled)
  // may exist in database records but are no longer used. All workflows must use steps format.
}

export interface WorkflowCreateRequest {
  workflow_name: string
  workflow_description: string
  template_id?: string
  template_version?: number
  steps?: WorkflowStep[]
  folder_id?: string | null
  delivery_method?: DeliveryMethod
  delivery_webhook_url?: string
  delivery_webhook_headers?: Record<string, string>
  delivery_sms_enabled?: boolean
  delivery_sms_message?: string
  delivery_sms_ai_generated?: boolean
  delivery_sms_ai_instructions?: string
}

export interface WorkflowUpdateRequest extends Partial<WorkflowCreateRequest> {}

export interface WorkflowListResponse {
  workflows: Workflow[]
  total?: number
  count?: number
  limit?: number
  offset?: number
  has_more?: boolean
}

export interface WorkflowGenerationRequest {
  description: string
  model?: AIModel
  webhook_url?: string
}

export interface WorkflowGenerationResponse {
  job_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  result?: WorkflowGenerationResult
  error_message?: string
}

export interface WorkflowGenerationResult {
  workflow: {
    workflow_name?: string
    workflow_description?: string
    research_instructions?: string
    steps?: WorkflowStep[]
  }
  template: {
    template_name?: string
    template_description?: string
    html_content?: string
    placeholder_tags?: string[]
  }
  form: {
    form_name?: string
    public_slug?: string
    form_fields_schema?: {
      fields: FormField[]
    }
  }
}

export interface WorkflowRefineInstructionsRequest {
  current_instructions: string
  edit_prompt: string
  model?: AIModel
}

export interface WorkflowRefineInstructionsResponse {
  refined_instructions: string
}

