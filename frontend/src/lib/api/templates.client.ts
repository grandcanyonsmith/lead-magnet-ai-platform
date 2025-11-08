/**
 * Templates API client
 */

import { BaseApiClient, TokenProvider } from './base.client'
import {
  Template,
  TemplateListResponse,
  TemplateCreateRequest,
  TemplateUpdateRequest,
  TemplateGenerateRequest,
  TemplateGenerateResponse,
  TemplateRefineRequest,
  TemplateRefineResponse,
} from '@/types'

export class TemplatesClient extends BaseApiClient {
  constructor(tokenProvider: TokenProvider) {
    super(tokenProvider)
  }

  async getTemplates(params?: Record<string, unknown>): Promise<TemplateListResponse> {
    return this.get<TemplateListResponse>('/admin/templates', { params })
  }

  async getTemplate(id: string): Promise<Template> {
    return this.get<Template>(`/admin/templates/${id}`)
  }

  async createTemplate(data: TemplateCreateRequest): Promise<Template> {
    return this.post<Template>('/admin/templates', data)
  }

  async updateTemplate(id: string, data: TemplateUpdateRequest): Promise<Template> {
    return this.put<Template>(`/admin/templates/${id}`, data)
  }

  async deleteTemplate(id: string): Promise<void> {
    return this.delete<void>(`/admin/templates/${id}`)
  }

  async generateTemplateWithAI(request: TemplateGenerateRequest): Promise<TemplateGenerateResponse> {
    return this.post<TemplateGenerateResponse>('/admin/templates/generate', {
      description: request.description,
      model: request.model || 'gpt-4o',
    })
  }

  async refineTemplateWithAI(request: TemplateRefineRequest): Promise<TemplateRefineResponse> {
    return this.post<TemplateRefineResponse>('/admin/templates/refine', {
      current_html: request.current_html,
      edit_prompt: request.edit_prompt,
      model: request.model || 'gpt-4o',
    })
  }
}

