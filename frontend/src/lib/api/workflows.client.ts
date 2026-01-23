/**
 * Workflows API client
 */

import { BaseApiClient, TokenProvider } from "./base.client";
import {
  Workflow,
  WorkflowListResponse,
  WorkflowCreateRequest,
  WorkflowUpdateRequest,
  WorkflowGenerationRequest,
  WorkflowGenerationResponse,
  WorkflowIdeationRequest,
  WorkflowIdeationResponse,
  WorkflowIdeationMockupRequest,
  WorkflowIdeationMockupResponse,
  WorkflowRefineInstructionsRequest,
  WorkflowRefineInstructionsResponse,
  WorkflowVersionListResponse,
  WorkflowVersionRecord,
  Folder,
  FolderListResponse,
  FolderCreateRequest,
  FolderUpdateRequest,
  AIModelConfig,
  WorkflowAIEditResponse,
  WorkflowAIImprovement,
  WorkflowImprovementStatus,
} from "@/types";

export class WorkflowsClient extends BaseApiClient {
  constructor(tokenProvider: TokenProvider) {
    super(tokenProvider);
  }

  async getModels(): Promise<{ models: AIModelConfig[] }> {
    return this.get<{ models: AIModelConfig[] }>("/admin/workflows/models");
  }

  async getWorkflows(
    params?: Record<string, unknown>,
  ): Promise<WorkflowListResponse> {
    return this.get<WorkflowListResponse>("/admin/workflows", { params });
  }

  async getWorkflow(id: string): Promise<Workflow> {
    return this.get<Workflow>(`/admin/workflows/${id}`);
  }

  async createWorkflow(data: WorkflowCreateRequest): Promise<Workflow> {
    return this.post<Workflow>("/admin/workflows", data);
  }

  async updateWorkflow(
    id: string,
    data: WorkflowUpdateRequest,
  ): Promise<Workflow> {
    return this.put<Workflow>(`/admin/workflows/${id}`, data);
  }

  async deleteWorkflow(id: string): Promise<void> {
    return this.delete<void>(`/admin/workflows/${id}`);
  }

  async getWorkflowVersions(
    id: string,
    params?: Record<string, unknown>,
  ): Promise<WorkflowVersionListResponse> {
    return this.get<WorkflowVersionListResponse>(
      `/admin/workflows/${id}/versions`,
      { params },
    );
  }

  async getWorkflowVersion(
    id: string,
    version: number,
  ): Promise<WorkflowVersionRecord> {
    return this.get<WorkflowVersionRecord>(
      `/admin/workflows/${id}/versions/${version}`,
    );
  }

  async restoreWorkflowVersion(
    id: string,
    version: number,
  ): Promise<Workflow> {
    return this.post<Workflow>(
      `/admin/workflows/${id}/versions/${version}/restore`,
      {},
    );
  }

  async generateWorkflowWithAI(
    request: WorkflowGenerationRequest,
  ): Promise<WorkflowGenerationResponse> {
    return this.post<WorkflowGenerationResponse>(
      "/admin/workflows/generate-with-ai",
      {
        description: request.description,
        model: request.model || "gpt-5.2",
        webhook_url: request.webhook_url,
      },
    );
  }

  async ideateWorkflow(
    request: WorkflowIdeationRequest,
  ): Promise<WorkflowIdeationResponse> {
    return this.post<WorkflowIdeationResponse>("/admin/workflows/ideate", {
      messages: request.messages,
      model: request.model || "gpt-5.2",
      mode: request.mode,
      selected_deliverable: request.selected_deliverable,
      image_strategy: request.image_strategy || "preview",
    });
  }

  async generateDeliverableMockups(
    request: WorkflowIdeationMockupRequest,
  ): Promise<WorkflowIdeationMockupResponse> {
    return this.post<WorkflowIdeationMockupResponse>(
      "/admin/workflows/ideate/mockups",
      request,
    );
  }

  async streamIdeation(
    request: WorkflowIdeationRequest,
    callbacks: {
      onDelta: (text: string) => void;
      onComplete: (result?: WorkflowIdeationResponse) => void;
      onError: (error: string) => void;
    },
    signal?: AbortSignal,
  ): Promise<void> {
    const token = this.tokenProvider.getToken();
    const url = `${this.client.defaults.baseURL}/admin/workflows/ideate/stream`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: request.messages,
          model: request.model || "gpt-5.2",
          mode: request.mode,
          selected_deliverable: request.selected_deliverable,
          image_strategy: request.image_strategy || "preview",
        }),
        signal,
      });

      // Log response metadata for debugging
      if (process.env.NODE_ENV === "development") {
        console.log("[Ideation Stream] Response:", {
          status: response.status,
          contentType: response.headers.get("content-type"),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Ideation Stream] Response not OK:", {
          status: response.status,
          errorText,
        });
        callbacks.onError(`Failed to start ideation: ${response.status} ${errorText}`);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;
      let pendingResult: WorkflowIdeationResponse | undefined;
      let allChunks: string[] = [];

      const handleParsedEvent = (event: any) => {
        if (!event || typeof event !== "object") {
          return;
        }
        if (event.type === "delta" && typeof event.text === "string") {
          callbacks.onDelta(event.text);
          return;
        }
        if (event.type === "done") {
          completed = true;
          callbacks.onComplete(event.result);
          return;
        }
        if (event.type === "error") {
          completed = true;
          callbacks.onError(event.message || "Streaming error");
          return;
        }
        if (
          typeof event.assistant_message === "string" ||
          Array.isArray(event.deliverables)
        ) {
          pendingResult = event;
        }
      };

      const extractJsonCandidates = (text: string): string[] => {
        const candidates: string[] = [];
        let startIndex = -1;
        let depth = 0;
        let inString = false;
        let isEscaped = false;

        for (let i = 0; i < text.length; i += 1) {
          const char = text[i];

          if (inString) {
            if (isEscaped) {
              isEscaped = false;
              continue;
            }
            if (char === "\\") {
              isEscaped = true;
              continue;
            }
            if (char === "\"") {
              inString = false;
            }
            continue;
          }

          if (char === "\"") {
            inString = true;
            continue;
          }

          if (char === "{") {
            if (depth === 0) {
              startIndex = i;
            }
            depth += 1;
            continue;
          }

          if (char === "}") {
            if (depth === 0) {
              continue;
            }
            depth -= 1;
            if (depth === 0 && startIndex !== -1) {
              candidates.push(text.slice(startIndex, i + 1));
              startIndex = -1;
            }
          }
        }

        return candidates;
      };

      const parseNdjsonLine = (rawLine: string): boolean => {
        const trimmed = rawLine.trim();
        if (!trimmed) return false;
        if (trimmed.startsWith(":")) return false;

        let jsonLine = trimmed;
        if (jsonLine.startsWith("data:")) {
          jsonLine = jsonLine.replace(/^data:\s*/, "");
          if (!jsonLine || jsonLine === "[DONE]") {
            return false;
          }
        }

        try {
          const event = JSON.parse(jsonLine);
          handleParsedEvent(event);
          return true;
        } catch (e) {
          const candidates = extractJsonCandidates(jsonLine);
          if (candidates.length > 0) {
            let parsedAny = false;
            for (const candidate of candidates) {
              try {
                const event = JSON.parse(candidate);
                handleParsedEvent(event);
                parsedAny = true;
              } catch {
                // ignore malformed candidate
              }
            }
            return parsedAny;
          }

          console.error("[Ideation Stream] Failed to parse NDJSON line:", {
            error: (e as Error)?.message,
            linePreview: jsonLine.slice(0, 200),
          });
          return false;
        }
      };

      const parseNdjsonText = (text: string): boolean => {
        let parsedSomething = false;
        const lines = text.split("\n");
        for (const line of lines) {
          if (parseNdjsonLine(line)) {
            parsedSomething = true;
            if (completed) {
              return true;
            }
          }
        }

        if (!parsedSomething) {
          const candidates = extractJsonCandidates(text);
          for (const candidate of candidates) {
            try {
              const event = JSON.parse(candidate);
              handleParsedEvent(event);
              parsedSomething = true;
              if (completed) {
                return true;
              }
            } catch {
              // ignore malformed candidate
            }
          }
        }

        return parsedSomething;
      };

      const reader = response.body?.getReader();
      if (!reader) {
        const text = await response.text();
        if (process.env.NODE_ENV === "development") {
          console.log("[Ideation Stream] No reader - Full response:", {
            length: text.length,
            preview: text.slice(0, 200),
          });
        }
        const parsedSomething = parseNdjsonText(text);
        if (completed) return;
        if (pendingResult) {
          callbacks.onComplete(pendingResult);
          return;
        }
        if (!parsedSomething) {
          callbacks.onError("Response body is not readable");
          return;
        }
        callbacks.onComplete();
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (process.env.NODE_ENV === "development") {
            console.log("[Ideation Stream] Stream complete. Total chunks:", allChunks.length);
          }
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        allChunks.push(chunk);
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          if (parseNdjsonLine(line) && completed) {
            return;
          }
        }
      }

      if (buffer.trim()) {
        const parsedSomething = parseNdjsonText(buffer.trim());
        if (completed) return;
        if (parsedSomething) {
          buffer = "";
        }
      }

      if (pendingResult) {
        callbacks.onComplete(pendingResult);
        return;
      }
      if (!completed) {
        callbacks.onComplete();
      }
    } catch (e: any) {
      callbacks.onError(e.message || "Failed to stream ideation");
    }
  }

  async getWorkflowGenerationStatus(
    jobId: string,
  ): Promise<WorkflowGenerationResponse> {
    return this.get<WorkflowGenerationResponse>(
      `/admin/workflows/generation-status/${jobId}`,
    );
  }

  async refineWorkflowInstructions(
    workflowId: string,
    request: WorkflowRefineInstructionsRequest,
  ): Promise<WorkflowRefineInstructionsResponse> {
    return this.post<WorkflowRefineInstructionsResponse>(
      `/admin/workflows/${workflowId}/refine-instructions`,
      {
        current_instructions: request.current_instructions,
        edit_prompt: request.edit_prompt,
        model: request.model || "gpt-5.2",
      },
    );
  }

  async refineInstructions(
    request: WorkflowRefineInstructionsRequest,
  ): Promise<WorkflowRefineInstructionsResponse> {
    return this.post<WorkflowRefineInstructionsResponse>(
      "/admin/workflows/refine-instructions",
      {
        current_instructions: request.current_instructions,
        edit_prompt: request.edit_prompt,
        model: request.model || "gpt-5.2",
      },
    );
  }

  async generateStepWithAI(
    workflowId: string,
    request: {
      userPrompt: string;
      action?: "update" | "add";
      currentStep?: any;
      currentStepIndex?: number;
    },
  ): Promise<{
    action: "update" | "add";
    step_index?: number;
    step: any;
  }> {
    return this.post(`/admin/workflows/${workflowId}/ai-step`, request);
  }

  async editWorkflowWithAI(
    workflowId: string,
    request: {
      userPrompt: string;
      contextJobId?: string;
    },
  ): Promise<{
    job_id: string;
    status: "pending" | "processing" | "completed" | "failed";
    message?: string;
  }> {
    return this.post(`/admin/workflows/${workflowId}/ai-edit`, request);
  }

  async streamWorkflowEdit(
    workflowId: string,
    request: {
      userPrompt: string;
      contextJobId?: string;
    },
    callbacks: {
      onDelta: (text: string) => void;
      onComplete: (result?: WorkflowAIEditResponse) => void;
      onError: (error: string) => void;
    },
    signal?: AbortSignal,
  ): Promise<{
    result?: WorkflowAIEditResponse;
    jobId?: string;
    status?: "pending" | "processing" | "completed" | "failed";
    message?: string;
  }> {
    const token = this.tokenProvider.getToken();
    const url = `${this.client.defaults.baseURL}/admin/workflows/${workflowId}/ai-edit/stream`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(request),
        signal,
      });

      if (response.status === 202) {
        try {
          const json = await response.json();
          return {
            jobId: json.job_id,
            status: json.status,
            message: json.message,
          };
        } catch {
          callbacks.onError("Streaming not available and response was invalid");
          return {};
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        callbacks.onError(`Failed to start streaming: ${response.status} ${errorText}`);
        return {};
      }

      const reader = response.body?.getReader();
      if (!reader) {
        callbacks.onError("Response body is not readable");
        return {};
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult: WorkflowAIEditResponse | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "delta" && typeof event.text === "string") {
              callbacks.onDelta(event.text);
            } else if (event.type === "done") {
              finalResult = event.result;
              callbacks.onComplete(event.result);
            } else if (event.type === "error") {
              callbacks.onError(event.message || "Streaming error");
              return {};
            }
          } catch (e) {
            console.error("Failed to parse NDJSON line:", line);
          }
        }
      }

      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer);
          if (event?.type === "delta" && typeof event.text === "string") {
            callbacks.onDelta(event.text);
          } else if (event?.type === "done") {
            finalResult = event.result;
            callbacks.onComplete(event.result);
          }
        } catch {
          // ignore trailing partial
        }
      }

      if (!finalResult) {
        callbacks.onComplete();
      }

      return { result: finalResult };
    } catch (e: any) {
      callbacks.onError(e.message || "Streaming request failed");
      return {};
    }
  }

  async getWorkflowAIEditStatus(jobId: string): Promise<{
    job_id: string;
    status: "pending" | "processing" | "completed" | "failed";
    result: WorkflowAIEditResponse | null;
    error_message?: string | null;
    workflow_id?: string | null;
    improvement_status?: WorkflowImprovementStatus | null;
    reviewed_at?: string | null;
    created_at?: string;
    updated_at?: string;
  }> {
    return this.get(`/admin/workflows/ai-edit-status/${jobId}`);
  }

  async getWorkflowAIImprovements(
    workflowId: string,
  ): Promise<{ improvements: WorkflowAIImprovement[] }> {
    return this.get(`/admin/workflows/${workflowId}/ai-improvements`);
  }

  async reviewWorkflowAIImprovement(
    jobId: string,
    status: WorkflowImprovementStatus,
  ): Promise<{ improvement: WorkflowAIImprovement }> {
    return this.post(`/admin/workflows/ai-improvements/${jobId}/review`, {
      status,
    });
  }

  async testStep(request: { step: any; input?: any }): Promise<{
    job_id: string;
    status: string;
    message: string;
  }> {
    return this.post("/admin/workflows/test-step", request);
  }

  async testWorkflow(request: { steps: any[]; input?: any }): Promise<{
    job_id: string;
    status: string;
    message: string;
  }> {
    return this.post("/admin/workflows/test-workflow", request);
  }

  async streamTestWorkflow(
    request: { steps: any[]; input?: any },
    callbacks: {
        onLog: (log: string) => void;
        onComplete: (data?: any) => void;
        onError: (error: string) => void;
    },
    signal?: AbortSignal
  ): Promise<void> {
    const token = this.tokenProvider.getToken();
    const url = `${this.client.defaults.baseURL}/admin/workflows/test-workflow`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                // Add common headers from interceptors if needed
            },
            body: JSON.stringify(request),
            signal
        });

        if (!response.ok) {
             const errorText = await response.text();
             // If streaming not supported/handled, it might return regular JSON error or 202
             if (response.status === 202) {
                 // Fallback to polling if backend returns 202 (not streaming)
                 try {
                    const json = JSON.parse(errorText);
                    callbacks.onLog(`[System] Streaming not active, polling job ${json.job_id}...`);
                    // Here we could trigger a poller, but let's just complete for now or handle upstream
                    callbacks.onComplete({ job_id: json.job_id, status: 'pending' });
                 } catch (e) {
                    callbacks.onError(`Started but failed to parse response: ${errorText}`);
                 }
                 return;
             }
             callbacks.onError(`Failed to start workflow test: ${response.status} ${errorText}`);
             return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
             callbacks.onError("Response body is not readable");
             return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6);
                    try {
                        const data = JSON.parse(dataStr);
                        if (data.type === 'log') {
                            callbacks.onLog(data.content);
                        } else if (data.type === 'done') {
                            callbacks.onComplete(data);
                        } else if (data.type === 'init') {
                            callbacks.onLog(`[System] Job started: ${data.job_id}`);
                        }
                    } catch (e) {
                        console.error('Failed to parse SSE data:', dataStr);
                    }
                }
            }
        }
        
        // Final flush if needed, but SSE usually ends with empty line
        callbacks.onComplete();
        
    } catch (e: any) {
        callbacks.onError(e.message);
    }
  }

  async streamTestStep(
    request: { step: any; input?: any },
    callbacks: {
        onLog: (log: string) => void;
        onComplete: (data?: any) => void;
        onError: (error: string) => void;
    },
    signal?: AbortSignal
  ): Promise<void> {
    const token = this.tokenProvider.getToken();
    const url = `${this.client.defaults.baseURL}/admin/workflows/test-step`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(request),
            signal
        });

        if (!response.ok) {
             const errorText = await response.text();
             if (response.status === 202) {
                 try {
                    const json = JSON.parse(errorText);
                    callbacks.onLog(`[System] Streaming not active, polling job ${json.job_id}...`);
                    callbacks.onComplete({ job_id: json.job_id, status: 'pending' });
                 } catch (e) {
                    callbacks.onError(`Started but failed to parse response: ${errorText}`);
                 }
                 return;
             }
             callbacks.onError(`Failed to start step test: ${response.status} ${errorText}`);
             return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
             callbacks.onError("Response body is not readable");
             return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6);
                    try {
                        const data = JSON.parse(dataStr);
                        if (data.type === 'log') {
                            callbacks.onLog(data.content);
                        } else if (data.type === 'done') {
                            callbacks.onComplete(data);
                        } else if (data.type === 'init') {
                            callbacks.onLog(`[System] Job started: ${data.job_id}`);
                        }
                    } catch (e) {
                        console.error('Failed to parse SSE data:', dataStr);
                    }
                }
            }
        }
        callbacks.onComplete();
    } catch (e: any) {
        callbacks.onError(e.message);
    }
  }

  // Folder methods
  async getFolders(): Promise<FolderListResponse> {
    return this.get<FolderListResponse>("/admin/folders");
  }

  async getFolder(id: string): Promise<Folder> {
    return this.get<Folder>(`/admin/folders/${id}`);
  }

  async createFolder(data: FolderCreateRequest): Promise<Folder> {
    return this.post<Folder>("/admin/folders", data);
  }

  async updateFolder(id: string, data: FolderUpdateRequest): Promise<Folder> {
    return this.put<Folder>(`/admin/folders/${id}`, data);
  }

  async deleteFolder(id: string): Promise<void> {
    return this.delete<void>(`/admin/folders/${id}`);
  }

  async moveWorkflowToFolder(
    workflowId: string,
    folderId: string | null,
  ): Promise<Workflow> {
    return this.put<Workflow>(`/admin/workflows/${workflowId}`, {
      folder_id: folderId,
    });
  }
}
