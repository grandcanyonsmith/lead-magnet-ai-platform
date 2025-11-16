/**
 * Template-related types
 */

import { BaseEntity } from '@/shared/types/common'

export interface Template extends BaseEntity {
  template_id: string
  tenant_id: string
  template_name: string
  template_description: string
  html_content: string
  placeholder_tags: string[]
  version: number
}

export interface TemplateCreateRequest {
  template_name: string
  template_description: string
  html_content: string
  placeholder_tags?: string[]
  is_published?: boolean
}

export interface TemplateUpdateRequest extends Partial<TemplateCreateRequest> {}

export interface TemplateListResponse {
  templates: Template[]
  total?: number
}

export interface TemplateGenerateRequest {
  description: string
  model?: string
}

export interface TemplateGenerateResponse {
  template_name: string
  template_description: string
  html_content: string
  placeholder_tags: string[]
}

export interface TemplateRefineRequest {
  current_html: string
  edit_prompt: string
  model?: string
}

export interface TemplateRefineResponse {
  html_content: string
}

