/**
 * Form-related types
 */

import { BaseEntity } from '@/shared/types/common'

export type FormFieldType = 'text' | 'textarea' | 'email' | 'tel' | 'number' | 'select' | 'checkbox'

export interface FormField {
  field_id: string
  field_type: FormFieldType
  label: string
  placeholder?: string
  required: boolean
  options?: string[]
  validation_regex?: string
  max_length?: number
}

export interface FormFieldsSchema {
  fields: FormField[]
}

export interface Form extends BaseEntity {
  form_id: string
  tenant_id: string
  workflow_id: string
  form_name: string
  public_slug: string
  form_fields_schema: FormFieldsSchema
  rate_limit_enabled: boolean
  rate_limit_per_hour: number
  captcha_enabled: boolean
  custom_css?: string
  thank_you_message?: string
  redirect_url?: string
  status: 'active' | 'inactive'
}

export interface FormCreateRequest {
  workflow_id: string
  form_name: string
  public_slug: string
  form_fields_schema: FormFieldsSchema
  rate_limit_enabled?: boolean
  rate_limit_per_hour?: number
  captcha_enabled?: boolean
  custom_css?: string
  thank_you_message?: string
  redirect_url?: string
}

export interface FormUpdateRequest extends Partial<FormCreateRequest> {}

export interface FormListResponse {
  forms: Form[]
  total?: number
}

export interface FormGenerateCSSRequest {
  form_fields_schema: FormFieldsSchema
  css_prompt: string
  model?: string
}

export interface FormGenerateCSSResponse {
  css: string
}

export interface FormRefineCSSRequest {
  current_css: string
  css_prompt: string
  model?: string
}

export interface FormRefineCSSResponse {
  css: string
}

export interface FormSubmission {
  submission_id: string
  form_id: string
  workflow_id: string
  form_data: Record<string, unknown>
  created_at: string
}

