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
