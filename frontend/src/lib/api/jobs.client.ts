/**
 * Jobs API client
 */

import { BaseApiClient, TokenProvider } from "./base.client";
import {
  Job,
  JobListResponse,
  JobListParams,
  JobResubmitResponse,
  JobStatusResponse,
  JobAutoUploadsResponse,
} from "@/types";

export class JobsClient extends BaseApiClient {
  constructor(tokenProvider: TokenProvider) {
    super(tokenProvider);
  }

  async getJobs(params?: JobListParams): Promise<JobListResponse> {
    const queryParams: Record<string, string> = {};
    if (params?.status) queryParams.status = params.status;
    if (params?.workflow_id) queryParams.workflow_id = params.workflow_id;
    if (params?.limit) queryParams.limit = params.limit.toString();
    if (params?.offset !== undefined)
      queryParams.offset = params.offset.toString();
    if (params?.all) queryParams.all = "true";

    return this.get<JobListResponse>("/admin/jobs", { params: queryParams });
  }

  async getJob(id: string): Promise<Job> {
    return this.get<Job>(`/admin/jobs/${id}`);
  }

  async getJobStatus(id: string): Promise<JobStatusResponse> {
    return this.get<JobStatusResponse>(`/admin/jobs/${id}/status`);
  }

  async getJobAutoUploads(jobId: string): Promise<JobAutoUploadsResponse> {
    return this.get(`/admin/jobs/${jobId}/auto-uploads`);
  }

  async getJobAutoUploadContent(jobId: string, key: string): Promise<string> {
    const response = await this.client.get(
      `/admin/jobs/${jobId}/auto-uploads/content`,
      {
        params: { key },
        responseType: "text",
      },
    );
    return response.data;
  }

  async resubmitJob(jobId: string): Promise<JobResubmitResponse> {
    return this.post<JobResubmitResponse>(`/admin/jobs/${jobId}/resubmit`);
  }

  async rerunStep(
    jobId: string,
    stepIndex: number,
    continueAfter: boolean = false,
  ): Promise<{ message: string; job_id: string; step_index: number }> {
    return this.post<{ message: string; job_id: string; step_index: number }>(
      `/admin/jobs/${jobId}/rerun-step`,
      {
        step_index: stepIndex,
        continue_after: continueAfter,
      },
    );
  }

  async quickEditStep(
    jobId: string,
    stepOrder: number,
    userPrompt: string,
    save?: boolean,
  ): Promise<{
    original_output: any;
    edited_output: any;
    changes_summary: string;
    saved: boolean;
  }> {
    return this.post<{
      original_output: any;
      edited_output: any;
      changes_summary: string;
      saved: boolean;
    }>(`/admin/jobs/${jobId}/quick-edit-step`, {
      step_order: stepOrder,
      user_prompt: userPrompt,
      save: save === true,
    });
  }

  async getExecutionSteps(jobId: string): Promise<any[]> {
    return this.get<any[]>(`/admin/jobs/${jobId}/execution-steps`);
  }

  async getJobDocument(jobId: string): Promise<string> {
    // Use text() instead of json() since this returns HTML/markdown content
    const response = await this.client.get(`/admin/jobs/${jobId}/document`, {
      responseType: "text",
    });
    return response.data;
  }

  async getJobDocumentBlobUrl(jobId: string): Promise<string> {
    // Fetch document content and create a blob URL for viewing in new tab
    const content = await this.getJobDocument(jobId);
    const blob = new Blob([content], { type: "text/html" });
    return URL.createObjectURL(blob);
  }
}
