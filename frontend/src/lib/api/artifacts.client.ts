/**
 * Artifacts API client
 */

import { BaseApiClient, TokenProvider } from "./base.client";
import {
  Artifact,
  ArtifactEditStatusResponse,
  ArtifactListResponse,
  ArtifactListParams,
} from "@/types";

interface ArtifactEditStreamCallbacks {
  onSnapshot?: (data: ArtifactEditStatusResponse) => void;
  onUpdate?: (data: ArtifactEditStatusResponse) => void;
  onComplete?: (data?: ArtifactEditStatusResponse) => void;
  onError?: (error: string) => void;
}

export class ArtifactsClient extends BaseApiClient {
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

  async getArtifacts(
    params?: ArtifactListParams,
  ): Promise<ArtifactListResponse> {
    return this.get<ArtifactListResponse>("/admin/artifacts", { params });
  }

  async getArtifact(id: string): Promise<Artifact> {
    return this.get<Artifact>(`/admin/artifacts/${id}`);
  }

  async getArtifactContent(id: string): Promise<string> {
    const response = await this.client.get(`/admin/artifacts/${id}/content`, {
      responseType: "text",
    });
    return response.data;
  }

  async startArtifactEdit(
    artifactId: string,
    payload: { prompt: string; model: string },
  ): Promise<ArtifactEditStatusResponse> {
    return this.post<ArtifactEditStatusResponse>(
      `/admin/artifacts/${artifactId}/edit`,
      payload,
    );
  }

  async getArtifactEditStatus(
    editId: string,
  ): Promise<ArtifactEditStatusResponse> {
    return this.get<ArtifactEditStatusResponse>(`/admin/artifact-edits/${editId}`);
  }

  async streamArtifactEdit(
    editId: string,
    callbacks: ArtifactEditStreamCallbacks,
    signal?: AbortSignal,
  ): Promise<{ fallback: boolean }> {
    const token = this.tokenProvider.getToken();
    const url = `${this.client.defaults.baseURL}/admin/artifact-edits/${editId}/stream`;

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
          `Failed to start artifact edit stream: ${response.status} ${errorText}`,
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
          const payload = JSON.parse(dataStr) as ArtifactEditStatusResponse & {
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
              payload.message || "Artifact edit stream ended with an error",
            );
          }
        } catch (error) {
          console.error("Failed to parse artifact edit SSE data:", dataStr, error);
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
}
