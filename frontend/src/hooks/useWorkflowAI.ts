import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export interface WorkflowAIEditRequest {
  userPrompt: string;
}

export interface WorkflowAIEditResponse {
  workflow_name?: string;
  workflow_description?: string;
  html_enabled?: boolean;
  steps: any[];
  changes_summary: string;
}

type WorkflowAIEditJobStatus = "pending" | "processing" | "completed" | "failed";

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function useWorkflowAI(workflowId: string) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<WorkflowAIEditResponse | null>(null);
  const requestSeqRef = useRef(0);

  // Cancel any in-flight polling when unmounting
  useEffect(() => {
    return () => {
      requestSeqRef.current += 1;
    };
  }, []);

  const generateWorkflowEdit = async (userPrompt: string, contextJobId?: string) => {
    setIsGenerating(true);
    setError(null);
    setProposal(null);

    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;

    try {
      const start = await api.editWorkflowWithAI(workflowId, {
        userPrompt,
        ...(contextJobId ? { contextJobId } : {}),
      });

      const jobId = start.job_id;
      if (!jobId) {
        throw new Error("Failed to start workflow AI edit job (missing job_id)");
      }

      // Poll until completed/failed
      // Note: we intentionally do NOT enforce a strict timeout here—AI latency can vary.
      while (requestSeqRef.current === requestSeq) {
        const statusRes = await api.getWorkflowAIEditStatus(jobId);
        const status = statusRes.status as WorkflowAIEditJobStatus;

        if (status === "completed") {
          if (!statusRes.result) {
            throw new Error("Workflow AI edit completed but returned no result");
          }
          setProposal(statusRes.result);
          return statusRes.result;
        }

        if (status === "failed") {
          throw new Error(statusRes.error_message || "Workflow AI edit failed");
        }

        await delay(2000);
      }

      throw new Error("Workflow AI edit cancelled");
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error ||
        err.message ||
        "Failed to generate workflow edit";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const clearProposal = () => {
    setProposal(null);
    setError(null);
  };

  return {
    generateWorkflowEdit,
    clearProposal,
    isGenerating,
    error,
    proposal,
  };
}
