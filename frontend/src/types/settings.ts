/**
 * Settings-related types
 */

import { BaseEntity } from "./common";
import { ReasoningEffort, ServiceTier, TextVerbosity } from "./workflow";

export interface OnboardingChecklist {
  complete_profile?: boolean;
  create_first_lead_magnet?: boolean;
  view_generated_lead_magnets?: boolean;
}

export interface OnboardingSurveyResponses {
  [key: string]: unknown;
}

export interface Settings extends BaseEntity {
  tenant_id: string;
  onboarding_survey_completed?: boolean;
  onboarding_survey_responses?: OnboardingSurveyResponses;
  onboarding_checklist?: OnboardingChecklist;
  organization_name?: string;
  contact_email?: string;
  website_url?: string;
  default_ai_model?: string;
  default_tool_choice?: "auto" | "required" | "none";
  default_service_tier?: ServiceTier;
  default_text_verbosity?: TextVerbosity | "";
  default_workflow_improvement_user_id?: string;
  default_workflow_improvement_service_tier?: ServiceTier;
  default_workflow_improvement_reasoning_effort?: ReasoningEffort;
  logo_url?: string;
  webhook_url?: string;
  ghl_webhook_url?: string;
  custom_domain?: string;
  lead_phone_field?: string;
  cloudfront_domain?: string;
  cloudflare_api_token?: string;
  cloudflare_connected?: boolean;
  cloudflare_connected_at?: string;
  // Brand information fields
  brand_description?: string;
  brand_voice?: string;
  target_audience?: string;
  company_values?: string;
  industry?: string;
  company_size?: string;
  brand_messaging_guidelines?: string;
  icp_document_url?: string;
  [key: string]: unknown;
}

export interface SettingsUpdateRequest {
  onboarding_survey_completed?: boolean;
  onboarding_survey_responses?: OnboardingSurveyResponses;
  onboarding_checklist?: OnboardingChecklist;
  organization_name?: string;
  contact_email?: string;
  website_url?: string;
  default_ai_model?: string;
  default_tool_choice?: "auto" | "required" | "none";
  default_service_tier?: ServiceTier;
  default_text_verbosity?: TextVerbosity;
  default_workflow_improvement_user_id?: string;
  default_workflow_improvement_service_tier?: ServiceTier;
  default_workflow_improvement_reasoning_effort?: ReasoningEffort;
  logo_url?: string;
  ghl_webhook_url?: string;
  custom_domain?: string;
  lead_phone_field?: string;
  // Brand information fields
  brand_description?: string;
  brand_voice?: string;
  target_audience?: string;
  company_values?: string;
  industry?: string;
  company_size?: string;
  brand_messaging_guidelines?: string;
  icp_document_url?: string;
  [key: string]: unknown;
}

export interface SettingsFormData {
  organization_name: string;
  contact_email: string;
  website_url: string;
  default_ai_model: string;
  default_tool_choice: "auto" | "required" | "none";
  default_service_tier: ServiceTier;
  default_text_verbosity: TextVerbosity | "";
  default_workflow_improvement_user_id: string;
  default_workflow_improvement_service_tier: ServiceTier;
  default_workflow_improvement_reasoning_effort: ReasoningEffort;
  logo_url: string;
  ghl_webhook_url: string;
  custom_domain: string;
  lead_phone_field: string;
  brand_description: string;
  brand_voice: string;
  target_audience: string;
  company_values: string;
  industry: string;
  company_size: string;
  brand_messaging_guidelines: string;
  icp_document_url: string;
}
