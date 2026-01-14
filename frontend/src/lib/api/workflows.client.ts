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
  WorkflowRefineInstructionsRequest,
  WorkflowRefineInstructionsResponse,
  Folder,
  FolderListResponse,
  FolderCreateRequest,
  FolderUpdateRequest,
  AIModelConfig,
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

  async getWorkflowAIEditStatus(jobId: string): Promise<{
    job_id: string;
    status: "pending" | "processing" | "completed" | "failed";
    result: {
      workflow_name?: string;
      workflow_description?: string;
      html_enabled?: boolean;
      steps: any[];
      changes_summary: string;
    } | null;
    error_message?: string | null;
    workflow_id?: string | null;
    created_at?: string;
    updated_at?: string;
  }> {
    return this.get(`/admin/workflows/ai-edit-status/${jobId}`);
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
