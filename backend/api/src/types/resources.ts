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
  version?: number;
  trigger?: {
    type: "form" | "webhook";
  };
  status: "draft" | "active" | "archived";
  form_id?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface WorkflowStep {
  step_name: string;
  step_description?: string;
  /** @deprecated All steps are now generic steps */
  step_type?: "ai_generation" | "webhook";
  model: string;
  reasoning_effort?: "none" | "low" | "medium" | "high" | "xhigh";
  service_tier?: "auto" | "default" | "flex" | "scale" | "priority";
  text_verbosity?: "low" | "medium" | "high";
  max_output_tokens?: number;
  output_format?:
    | { type: "text" }
    | { type: "json_object" }
    | {
        type: "json_schema";
        name: string;
        description?: string;
        strict?: boolean;
        schema: Record<string, any>;
      };
  /**
   * When true, this step's output is treated as the final deliverable source.
   */
  is_deliverable?: boolean;
  instructions: string;
  step_order: number;
  depends_on?: number[];
  tools?: (string | ToolConfig)[];
  tool_choice?: "auto" | "required" | "none";
  shell_settings?: ShellSettings;
  // Webhook step fields
  webhook_url?: string;
  webhook_headers?: Record<string, string>;
  webhook_data_selection?: {
    include_submission: boolean;
    exclude_step_indices?: number[]; // Steps to exclude (all included by default)
    include_job_info: boolean;
  };

  // Lead magnet handoff step fields
  handoff_workflow_id?: string;
  handoff_payload_mode?:
    | "previous_step_output"
    | "full_context"
    | "submission_only"
    | "deliverable_output";
  handoff_input_field?: string;
  handoff_bypass_required_inputs?: boolean;
  handoff_include_submission_data?: boolean;
  handoff_include_context?: boolean;
  include_form_data?: boolean;
}

export interface ShellSettings {
  max_iterations?: number;
  max_duration_seconds?: number;
  command_timeout_ms?: number;
  command_max_output_length?: number;
}

export interface ToolConfig {
  type: string;
  display_width?: number;
  display_height?: number;
  environment?: "browser" | "mac" | "windows" | "ubuntu";
  server_label?: string;
  server_url?: string;
  connector_id?: string;
  allowed_tools?: string[];
  authorization?: string;
  require_approval?: "always" | "never";
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
    | "radio"
    | "url"
    | "file";
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
  workflow_version?: number;
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
  improvement_status?: "pending" | "approved" | "denied";
  reviewed_at?: string;
  approved_at?: string;
  denied_at?: string;
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
  default_tool_choice?: "auto" | "required" | "none";
  default_service_tier?: "auto" | "default" | "flex" | "scale" | "priority";
  default_text_verbosity?: "low" | "medium" | "high";
  default_image_settings?: {
    model?: string;
    size?: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
    quality?: "low" | "medium" | "high" | "auto";
    format?: "png" | "jpeg" | "webp";
    compression?: number;
    background?: "transparent" | "opaque" | "auto";
    input_fidelity?: "low" | "high";
  };
  default_workflow_improvement_user_id?: string;
  default_workflow_improvement_service_tier?:
    | "auto"
    | "default"
    | "flex"
    | "scale"
    | "priority";
  default_workflow_improvement_reasoning_effort?:
    | "none"
    | "low"
    | "medium"
    | "high"
    | "xhigh";
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
