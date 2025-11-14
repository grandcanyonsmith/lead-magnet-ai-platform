/**
 * Settings-related types
 */

import { BaseEntity } from './common'

export interface OnboardingChecklist {
  complete_profile?: boolean
  create_first_lead_magnet?: boolean
  view_generated_lead_magnets?: boolean
}

export interface OnboardingSurveyResponses {
  [key: string]: unknown
}

export interface Settings extends BaseEntity {
  tenant_id: string
  onboarding_survey_completed?: boolean
  onboarding_survey_responses?: OnboardingSurveyResponses
  onboarding_checklist?: OnboardingChecklist
  organization_name?: string
  contact_email?: string
  website_url?: string
  default_ai_model?: string
  logo_url?: string
  webhook_url?: string
  ghl_webhook_url?: string
  lead_phone_field?: string
  // Brand information fields
  brand_description?: string
  brand_voice?: string
  target_audience?: string
  company_values?: string
  industry?: string
  company_size?: string
  brand_messaging_guidelines?: string
  icp_document_url?: string
  [key: string]: unknown
}

export interface SettingsUpdateRequest {
  onboarding_survey_completed?: boolean
  onboarding_survey_responses?: OnboardingSurveyResponses
  onboarding_checklist?: OnboardingChecklist
  organization_name?: string
  contact_email?: string
  website_url?: string
  default_ai_model?: string
  logo_url?: string
  ghl_webhook_url?: string
  lead_phone_field?: string
  // Brand information fields
  brand_description?: string
  brand_voice?: string
  target_audience?: string
  company_values?: string
  industry?: string
  company_size?: string
  brand_messaging_guidelines?: string
  icp_document_url?: string
  [key: string]: unknown
}

export interface SettingsFormData {
  organization_name: string
  contact_email: string
  website_url: string
  default_ai_model: string
  logo_url: string
  ghl_webhook_url: string
  lead_phone_field: string
  brand_description: string
  brand_voice: string
  target_audience: string
  company_values: string
  industry: string
  company_size: string
  brand_messaging_guidelines: string
  icp_document_url: string
}

