/**
 * Settings-related types
 */

import { BaseEntity } from "./common";
import {
  ImageGenerationSettings,
  ReasoningEffort,
  ServiceTier,
  TextVerbosity,
} from "./workflow";

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
  tool_secrets?: Record<string, string>;
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
  default_image_settings?: ImageGenerationSettings;
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
  icp_profiles?: ICPProfile[];
  prompt_overrides?: PromptOverrides;
  [key: string]: unknown;
}

export interface ICPProfile {
  id: string;
  name: string;
  icp?: string;
  pain?: string;
  outcome?: string;
  offer?: string;
  constraints?: string;
  examples?: string;
  research_status?: "pending" | "completed" | "failed";
  research_model?: string;
  research_requested_at?: string;
  research_completed_at?: string;
  research_error?: string;
  research_report?: IcpResearchReport;
  created_at?: string;
  updated_at?: string;
}

export interface IcpResearchReport {
  summary?: string;
  pains?: string[];
  desires?: string[];
  wants?: string[];
  goals?: string[];
  objections?: string[];
  triggers?: string[];
  buying_criteria?: string[];
  channels?: string[];
  language?: string[];
  opportunities?: string[];
  risks?: string[];
  sources?: Array<{
    title?: string;
    url: string;
  }>;
}

export interface PromptOverride {
  enabled?: boolean;
  instructions?: string;
  prompt?: string;
}

export type PromptOverrides = Record<string, PromptOverride>;

export interface PromptDefault {
  instructions?: string;
  prompt?: string;
}

export type PromptDefaults = Record<string, PromptDefault>;

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
  default_image_settings?: ImageGenerationSettings;
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
  icp_profiles?: ICPProfile[];
  prompt_overrides?: PromptOverrides;
  tool_secrets?: Record<string, string>;
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
  default_image_settings?: ImageGenerationSettings;
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
  icp_profiles?: ICPProfile[];
}
