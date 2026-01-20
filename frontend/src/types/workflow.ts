/**
 * Workflow-related types
 */

import { BaseEntity, Status } from "./common";
import { FormField } from "./form";

export type AIModel =
  | "gpt-5.1"
  | "gpt-5.1-codex"
  | "gpt-5.2"
  | "gpt-5"
  | "gpt-4.1"
  | "gpt-4-turbo"
  | "gpt-3.5-turbo"
  | "computer-use-preview"
  | "o4-mini-deep-research";

export interface AIModelConfig {
  id: string;
  name: string;
  description: string;
  bestFor?: string;
  useWhen?: string;
  cost?: string;
  speed?: string;
}

export type ToolChoice = "auto" | "required" | "none";

export type ReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh";

export type TextVerbosity = "low" | "medium" | "high";

export type ServiceTier = "auto" | "default" | "flex" | "scale" | "priority";

export type OutputFormat =
  | { type: "text" }
  | { type: "json_object" }
  | {
      type: "json_schema";
      name: string;
      description?: string;
      strict?: boolean;
      schema: Record<string, any>;
    };

export type ToolType =
  | "web_search"
  | "image_generation"
  | "computer_use_preview"
  | "file_search"
  | "code_interpreter"
  | "shell";

export type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type HTTPBodyMode = "auto" | "custom";

export interface ComputerUseToolConfig {
  type: "computer_use_preview";
  display_width: number;
  display_height: number;
  environment: "browser" | "mac" | "windows" | "ubuntu";
}

export interface ImageGenerationToolConfig {
  type: "image_generation";
  model?: "gpt-image-1.5" | string;
  size?: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  quality?: "low" | "medium" | "high" | "auto";
  format?: "png" | "jpeg" | "webp";
  compression?: number; // 0-100
  background?: "transparent" | "opaque" | "auto";
  input_fidelity?: "low" | "high";
}

export type Tool = ToolType | ComputerUseToolConfig | ImageGenerationToolConfig;

export type ImageGenerationSettings = Omit<ImageGenerationToolConfig, "type">;

export interface WorkflowStep {
  step_name: string;
  step_description?: string;
  /** @deprecated All steps are now generic steps */
  step_type?: "ai_generation" | "webhook";
  model: AIModel;
  reasoning_effort?: ReasoningEffort;
  service_tier?: ServiceTier;
  text_verbosity?: TextVerbosity;
  max_output_tokens?: number;
  /**
   * Controls the model's output shape. When set to json_schema, this enables
   * OpenAI Structured Outputs (Responses API: text.format).
   */
  output_format?: OutputFormat;
  instructions: string;
  step_order?: number;
  tools?: Tool[];
  tool_choice?: ToolChoice;
  depends_on?: number[]; // Array of step indices this step depends on
  // Webhook step fields
  webhook_url?: string;
  webhook_method?: HTTPMethod;
  webhook_headers?: Record<string, string>;
  webhook_query_params?: Record<string, string>;
  webhook_content_type?: string;
  webhook_body_mode?: HTTPBodyMode;
  webhook_body?: string;
  webhook_save_response?: boolean;
  webhook_data_selection?: {
    include_submission: boolean;
    exclude_step_indices?: number[]; // Steps to exclude (all included by default)
    include_job_info: boolean;
  };

  /**
   * Lead magnet handoff step fields
   * Allows a step to send data to another workflow (lead magnet) as the next workflow's input.
   */
  handoff_workflow_id?: string;
  handoff_payload_mode?: "previous_step_output" | "full_context" | "submission_only";
  handoff_input_field?: string;
  /**
   * When true, the destination lead magnet's "required inputs" should not block execution.
   * (Implementation: the handoff trigger path does not enforce form-required fields.)
   */
  handoff_bypass_required_inputs?: boolean;
  handoff_include_submission_data?: boolean;
  handoff_include_context?: boolean;
}

export type WorkflowTriggerType = "form" | "webhook";

export interface WorkflowTrigger {
  type: WorkflowTriggerType;
}

export interface WorkflowFormData {
  workflow_name: string;
  workflow_description: string;
  template_id: string;
  template_version: number;
  trigger?: WorkflowTrigger;
}

// Folder for organizing workflows
export interface Folder {
  folder_id: string;
  tenant_id: string;
  folder_name: string;
  parent_folder_id?: string | null; // For nested folders (future)
  workflow_count?: number;
  created_at: string;
  updated_at: string;
}

export interface FolderCreateRequest {
  folder_name: string;
  parent_folder_id?: string | null;
}

export interface FolderUpdateRequest {
  folder_name?: string;
  parent_folder_id?: string | null;
}

export interface FolderListResponse {
  folders: Folder[];
}

export interface Workflow extends BaseEntity {
  workflow_id: string;
  tenant_id: string;
  workflow_name: string;
  workflow_description: string;
  template_id: string;
  template_version: number;
  version?: number;
  steps?: WorkflowStep[];
  status: "active" | "inactive" | "draft";
  folder_id?: string | null; // Folder this workflow belongs to
  trigger?: WorkflowTrigger;
  form?: {
    form_id: string;
    form_name: string;
    public_slug: string;
    status: string;
  };
}

export interface WorkflowCreateRequest {
  workflow_name: string;
  workflow_description: string;
  template_id?: string;
  template_version?: number;
  steps?: WorkflowStep[];
  trigger?: WorkflowTrigger;
  folder_id?: string | null;
}

export interface WorkflowUpdateRequest extends Partial<WorkflowCreateRequest> {}

export interface WorkflowListResponse {
  workflows: Workflow[];
  total?: number;
}

export interface WorkflowVersionSummary {
  workflow_id: string;
  version: number;
  created_at: string;
  workflow_name: string;
  workflow_description?: string;
  step_count: number;
  template_id?: string;
  template_version?: number;
}

export interface WorkflowVersionListResponse {
  versions: WorkflowVersionSummary[];
  count: number;
  current_version: number;
}

export interface WorkflowVersionSnapshot extends WorkflowCreateRequest {
  status?: "active" | "inactive" | "draft";
}

export interface WorkflowVersionRecord {
  workflow_id: string;
  tenant_id: string;
  version: number;
  snapshot: WorkflowVersionSnapshot;
  created_at: string;
}

export interface WorkflowGenerationRequest {
  description: string;
  model?: AIModel;
  webhook_url?: string;
}

export interface WorkflowGenerationResponse {
  job_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  workflow_id?: string;
  result?: WorkflowGenerationResult;
  error_message?: string;
}

export interface WorkflowGenerationResult {
  workflow: {
    workflow_name?: string;
    workflow_description?: string;
    research_instructions?: string;
    steps?: WorkflowStep[];
  };
  template: {
    template_name?: string;
    template_description?: string;
    html_content?: string;
    placeholder_tags?: string[];
  };
  form: {
    form_name?: string;
    public_slug?: string;
    form_fields_schema?: {
      fields: FormField[];
    };
  };
}

export interface WorkflowRefineInstructionsRequest {
  current_instructions: string;
  edit_prompt: string;
  model?: AIModel;
}

export interface WorkflowRefineInstructionsResponse {
  refined_instructions: string;
}

export interface WorkflowAIEditResponse {
  workflow_name?: string;
  workflow_description?: string;
  html_enabled?: boolean;
  steps: any[];
  changes_summary: string;
}

export type WorkflowImprovementStatus = "pending" | "approved" | "denied";

export interface WorkflowAIImprovement {
  job_id: string;
  workflow_id: string;
  status: Status;
  improvement_status: WorkflowImprovementStatus;
  created_at: string;
  updated_at?: string;
  reviewed_at?: string;
  approved_at?: string;
  denied_at?: string;
  user_prompt?: string;
  context_job_id?: string | null;
  result?: WorkflowAIEditResponse | null;
}
