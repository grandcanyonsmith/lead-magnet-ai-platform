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

interface JobStatusStreamCallbacks {
  onSnapshot?: (data: JobStatusResponse) => void;
  onUpdate?: (data: JobStatusResponse) => void;
  onComplete?: (data?: JobStatusResponse) => void;
  onError?: (error: string) => void;
}

export class JobsClient extends BaseApiClient {
  constructor(tokenProvider: TokenProvider) {
    super(tokenProvider);
  }

  private buildStreamingHeaders(token: string | null): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "text/event-stream",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (typeof window !== "undefined") {
      const sessionId = localStorage.getItem("impersonation_session_id");
      if (sessionId) {
        headers["X-Session-Id"] = sessionId;
      }

      const viewMode = localStorage.getItem("agency_view_mode");
      if (viewMode) {
        headers["X-View-Mode"] = viewMode;
      }

      const selectedCustomerId = localStorage.getItem(
        "agency_selected_customer_id",
      );
      if (selectedCustomerId) {
        headers["X-Selected-Customer-Id"] = selectedCustomerId;
      }
    }

    return headers;
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

  async streamJobStatus(
    id: string,
    callbacks: JobStatusStreamCallbacks,
    signal?: AbortSignal,
  ): Promise<{ fallback: boolean }> {
    const token = this.tokenProvider.getToken();
    const url = `${this.client.defaults.baseURL}/admin/jobs/${id}/status/stream`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: this.buildStreamingHeaders(token),
        signal,
      });

      if (response.status === 202) {
        return { fallback: true };
      }

      if (!response.ok) {
        const errorText = await response.text();
        callbacks.onError?.(
          `Failed to start job stream: ${response.status} ${errorText}`,
        );
        return { fallback: false };
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/event-stream")) {
        return { fallback: true };
      }

      const reader = response.body?.getReader();
      if (!reader) {
        callbacks.onError?.("Response body is not readable");
        return { fallback: false };
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let didReceiveComplete = false;

      const handleSseChunk = (chunk: string) => {
        const lines = chunk.split(/\r?\n/);
        let eventName = "message";
        const dataLines: string[] = [];

        for (const line of lines) {
          if (!line || line.startsWith(":")) {
            continue;
          }
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim() || "message";
            continue;
          }
          if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trimStart());
          }
        }

        if (dataLines.length === 0) {
          return;
        }

        const dataStr = dataLines.join("\n");

        try {
          const payload = JSON.parse(dataStr) as JobStatusResponse & {
            message?: string;
          };

          if (eventName === "snapshot") {
            callbacks.onSnapshot?.(payload);
            return;
          }

          if (eventName === "update") {
            callbacks.onUpdate?.(payload);
            return;
          }

          if (eventName === "complete") {
            didReceiveComplete = true;
            callbacks.onComplete?.(payload);
            return;
          }

          if (eventName === "error") {
            callbacks.onError?.(
              payload.message || "Job stream ended with an error",
            );
          }
        } catch (error) {
          console.error("Failed to parse job SSE data:", dataStr, error);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split(/\r?\n\r?\n/);
        buffer = chunks.pop() || "";

        for (const chunk of chunks) {
          if (chunk.trim()) {
            handleSseChunk(chunk);
          }
        }
      }

      if (buffer.trim()) {
        handleSseChunk(buffer);
      }

      if (!didReceiveComplete) {
        callbacks.onComplete?.();
      }
      return { fallback: false };
    } catch (error: any) {
      if (error?.name === "AbortError") {
        return { fallback: false };
      }
      callbacks.onError?.(error?.message || "Streaming request failed");
      return { fallback: false };
    }
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
