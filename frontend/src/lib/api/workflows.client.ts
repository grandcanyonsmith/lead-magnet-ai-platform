/**
 * Workflows API client
 */

import { BaseApiClient, TokenProvider } from './base.client'
import {
  Workflow,
  WorkflowListResponse,
  WorkflowCreateRequest,
  WorkflowUpdateRequest,
  WorkflowGenerationRequest,
  WorkflowGenerationResponse,
  WorkflowRefineInstructionsRequest,
  WorkflowRefineInstructionsResponse,
} from '@/types'

export class WorkflowsClient extends BaseApiClient {
  constructor(tokenProvider: TokenProvider) {
    super(tokenProvider)
  }

  async getWorkflows(params?: Record<string, unknown>): Promise<WorkflowListResponse> {
    return this.get<WorkflowListResponse>('/admin/workflows', { params })
  }

  async getWorkflow(id: string): Promise<Workflow> {
    return this.get<Workflow>(`/admin/workflows/${id}`)
  }

  async createWorkflow(data: WorkflowCreateRequest): Promise<Workflow> {
    return this.post<Workflow>('/admin/workflows', data)
  }

  async updateWorkflow(id: string, data: WorkflowUpdateRequest): Promise<Workflow> {
    return this.put<Workflow>(`/admin/workflows/${id}`, data)
  }

  async deleteWorkflow(id: string): Promise<void> {
    return this.delete<void>(`/admin/workflows/${id}`)
  }

  async generateWorkflowWithAI(request: WorkflowGenerationRequest): Promise<WorkflowGenerationResponse> {
    return this.post<WorkflowGenerationResponse>('/admin/workflows/generate-with-ai', {
      description: request.description,
      model: request.model || 'gpt-4o',
      webhook_url: request.webhook_url,
    })
  }

  async getWorkflowGenerationStatus(jobId: string): Promise<WorkflowGenerationResponse> {
    return this.get<WorkflowGenerationResponse>(`/admin/workflows/generation-status/${jobId}`)
  }

  async refineWorkflowInstructions(
    workflowId: string,
    request: WorkflowRefineInstructionsRequest
  ): Promise<WorkflowRefineInstructionsResponse> {
    return this.post<WorkflowRefineInstructionsResponse>(
      `/admin/workflows/${workflowId}/refine-instructions`,
      {
        current_instructions: request.current_instructions,
        edit_prompt: request.edit_prompt,
        model: request.model || 'gpt-4o',
      }
    )
  }

  async refineInstructions(request: WorkflowRefineInstructionsRequest): Promise<WorkflowRefineInstructionsResponse> {
    return this.post<WorkflowRefineInstructionsResponse>('/admin/workflows/refine-instructions', {
      current_instructions: request.current_instructions,
      edit_prompt: request.edit_prompt,
      model: request.model || 'gpt-4o',
    })
  }

  async generateStepWithAI(
    workflowId: string,
    request: {
      userPrompt: string
      action?: 'update' | 'add'
      currentStep?: any
      currentStepIndex?: number
    }
  ): Promise<{
    action: 'update' | 'add'
    step_index?: number
    step: any
  }> {
    return this.post(`/admin/workflows/${workflowId}/ai-step`, request)
  }

  async editWorkflowWithAI(
    workflowId: string,
    request: {
      userPrompt: string
    }
  ): Promise<{
    workflow_name?: string
    workflow_description?: string
    html_enabled?: boolean
    steps: any[]
    changes_summary: string
  }> {
    return this.post(`/admin/workflows/${workflowId}/ai-edit`, request)
  }
}

