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
  [key: string]: unknown
}

export interface SettingsUpdateRequest {
  onboarding_survey_completed?: boolean
  onboarding_survey_responses?: OnboardingSurveyResponses
  onboarding_checklist?: OnboardingChecklist
  [key: string]: unknown
}

