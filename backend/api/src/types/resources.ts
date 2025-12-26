/**
 * Resource type definitions for better type safety.
 * Reduces `any` usage throughout the codebase.
 */

export interface Workflow {
  workflow_id: string;
  tenant_id: string;
  workflow_name: string;
  workflow_description?: string;
  steps?: WorkflowStep[];
  status: "draft" | "active" | "archived";
  form_id?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  // Legacy fields (deprecated - kept for backward compatibility with existing database records)
  // All new workflows must use the steps format. These fields are ignored.
  ai_model?: string;
  ai_instructions?: string;
  rewrite_model?: string;
  research_enabled?: boolean;
  html_enabled?: boolean;
  template_id?: string;
  template_version?: number;
  delivery_method?: "webhook" | "sms" | "none";
  delivery_webhook_url?: string;
  delivery_webhook_headers?: Record<string, string>;
  delivery_sms_enabled?: boolean;
  delivery_sms_message?: string;
  delivery_sms_ai_generated?: boolean;
  delivery_sms_ai_instructions?: string;
}

export interface WorkflowStep {
  step_name: string;
  step_description?: string;
  /** @deprecated All steps are now generic steps */
  step_type?: "ai_generation" | "webhook";
  model: string;
  reasoning_effort?: "low" | "medium" | "high";
  instructions: string;
  step_order: number;
  depends_on?: number[];
  tools?: (string | ToolConfig)[];
  tool_choice?: "auto" | "required" | "none";
  // Webhook step fields
  webhook_url?: string;
  webhook_headers?: Record<string, string>;
  webhook_data_selection?: {
    include_submission: boolean;
    exclude_step_indices?: number[]; // Steps to exclude (all included by default)
    include_job_info: boolean;
  };
}

export interface ToolConfig {
  type: string;
  display_width?: number;
  display_height?: number;
  environment?: "browser" | "mac" | "windows" | "ubuntu";
  [key: string]: any;
}

export interface ImageGenerationToolConfig {
  type: "image_generation";
  model?: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  quality?: "low" | "medium" | "high" | "auto";
  format?: "png" | "jpeg" | "webp";
  compression?: number; // 0-100
  background?: "transparent" | "opaque" | "auto";
  input_fidelity?: "low" | "high";
}

export interface Form {
  form_id: string;
  tenant_id: string;
  workflow_id: string;
  form_name: string;
  public_slug: string;
  form_fields_schema: FormFieldsSchema;
  status: "draft" | "active" | "archived";
  captcha_enabled?: boolean;
  custom_css?: string;
  thank_you_message?: string;
  redirect_url?: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface FormFieldsSchema {
  fields: FormField[];
}

export interface FormField {
  field_id: string;
  field_type:
    | "text"
    | "email"
    | "tel"
    | "number"
    | "textarea"
    | "select"
    | "checkbox"
    | "radio";
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  validation?: Record<string, any>;
}

export interface Job {
  job_id: string;
  tenant_id: string;
  workflow_id: string;
  submission_id?: string;
  status: "pending" | "processing" | "completed" | "failed";
  result?: any;
  error_message?: string;
  created_at: string;
  updated_at: string;
  processing_attempted?: boolean;
  description?: string;
  model?: string;
  job_type?: string;
}

export interface Submission {
  submission_id: string;
  tenant_id: string;
  form_id: string;
  workflow_id: string;
  submission_data: Record<string, any>;
  submitter_ip?: string;
  submitter_email?: string;
  submitter_phone?: string;
  submitter_name?: string;
  job_id?: string;
  created_at: string;
  ttl?: number;
}

export interface Template {
  template_id: string;
  tenant_id: string;
  template_name: string;
  template_description?: string;
  html_content: string;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Artifact {
  artifact_id: string;
  tenant_id: string;
  job_id: string;
  artifact_type: string;
  artifact_url?: string;
  s3_key?: string;
  created_at: string;
}

export interface Notification {
  notification_id: string;
  tenant_id: string;
  type: string;
  title: string;
  message: string;
  resource_id?: string;
  resource_type?: string;
  read: boolean;
  created_at: string;
}

export interface UserSettings {
  tenant_id: string;
  logo_url?: string;
  webhook_token?: string;
  webhook_url?: string;
  custom_domain?: string;
  lead_phone_field?: string;
  created_at: string;
  updated_at: string;
}

export interface UsageRecord {
  usage_id: string;
  tenant_id: string;
  job_id?: string | null;
  service_type: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  created_at: string;
}
