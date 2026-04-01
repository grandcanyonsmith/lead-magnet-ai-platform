/**
 * Artifact types
 */

export interface Artifact {
  artifact_id: string;
  job_id?: string;
  artifact_type?: string;
  file_name?: string;
  artifact_name?: string;
  content_type?: string;
  mime_type?: string; // Legacy/Alternative
  size_bytes?: number;
  file_size_bytes?: number;
  s3_bucket?: string;
  s3_key?: string;
  object_url?: string;
  public_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ArtifactListParams {
  limit?: number;
  job_id?: string;
  artifact_type?: string;
}

export interface ArtifactListResponse {
  artifacts: Artifact[];
  count: number;
}

export type ArtifactEditStatus =
  | "pending"
  | "fetching"
  | "editing"
  | "saving"
  | "completed"
  | "failed";

export interface ArtifactEditStatusResponse {
  edit_id: string;
  artifact_id: string;
  job_id?: string | null;
  file_name: string;
  content_type: string;
  model: string;
  status: ArtifactEditStatus;
  message?: string | null;
  output_url?: string | null;
  error_message?: string | null;
  file_size_bytes?: number | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}
