/**
 * Job-related types
 */

import { BaseEntity, Status } from "./common";
import type { Artifact } from "./artifact";

export type StepStatus = "pending" | "in_progress" | "completed" | "failed";

export type StepType =
  | "workflow_step"
  | "ai_generation"
  | "form_submission"
  | "html_generation"
  | "final_output"
  | "webhook"
  | "workflow_handoff";

export interface ExecutionStepUsageInfo {
  prompt_tokens?: number;
  completion_tokens?: number;
  input_tokens?: number; // Backend uses input_tokens
  output_tokens?: number; // Backend uses output_tokens
  total_tokens?: number;
  cost_usd?: number | string; // Can be number or string from DynamoDB Decimal
  model?: string;
  service_type?: string;
}

export interface ExecutionStepInput {
  tools?: string[] | unknown[];
  tool_choice?: string;
  [key: string]: unknown;
}

export interface ExecutionStep {
  step_order: number;
  step_type: StepType;
  step_name?: string;
  success?: boolean;
  model?: string;
  tools?: string[] | unknown[];
  tool_choice?: string;
  instructions?: string;
  input?: ExecutionStepInput;
  output?: string | null;
  error?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  usage_info?: ExecutionStepUsageInfo;
  _status?: StepStatus;
  artifact_id?: string;
  image_urls?: string[];
}

export interface MergedStep extends ExecutionStep {
  _status: StepStatus;
  depends_on?: number[];
  dependency_labels?: string[];
}

export interface JobLiveStep {
  step_order: number;
  output_text: string;
  updated_at?: string;
  status?: string;
  truncated?: boolean;
  error?: string;
}

export interface JobStatusResponse {
  job_id: string;
  status: Status;
  updated_at?: string;
  completed_at?: string | null;
  failed_at?: string | null;
  live_step?: JobLiveStep | null;
}

export interface JobSubmissionPreview {
  submitter_name?: string | null;
  submitter_email?: string | null;
  submitter_phone?: string | null;
  form_data_preview?: Record<string, unknown> | null;
}

export interface Job extends BaseEntity {
  job_id: string;
  tenant_id: string;
  workflow_id: string;
  status: Status;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
  error_message?: string;
  output_url?: string;
  output_s3_key?: string;
  submission_id?: string;
  execution_steps_s3_key?: string;
  execution_steps_s3_url?: string;
  execution_steps?: ExecutionStep[];
  submission_preview?: JobSubmissionPreview;
  /**
   * Best-effort live output preview for the currently running step.
   * Populated by the worker while streaming output and cleared when the step completes.
   */
  live_step?: JobLiveStep | null;
}

export interface JobListResponse {
  jobs: Job[];
  count?: number;
  total?: number;
  offset?: number;
  limit?: number;
  has_more?: boolean;
}

export interface JobListParams {
  status?: Status;
  workflow_id?: string;
  limit?: number;
  offset?: number;
  all?: boolean;
}

export interface JobResubmitResponse {
  job_id: string;
  status: Status;
}

export interface JobStepSummary {
  total: number;
  completed: number;
  failed: number;
  running: number;
  pending: number;
}

export interface JobDurationInfo {
  seconds: number;
  label: string;
  isLive: boolean;
}

export type ArtifactGalleryItemKind =
  | "jobOutput"
  | "artifact"
  | "imageArtifact"
  | "imageUrl";

export interface ArtifactGalleryItem {
  id: string;
  kind: ArtifactGalleryItemKind;
  artifact?: Artifact;
  url?: string;
  jobId?: string;
  stepOrder?: number;
  stepName?: string;
  stepType?: string;
  label: string;
  description?: string;
  sortOrder: number;
}
