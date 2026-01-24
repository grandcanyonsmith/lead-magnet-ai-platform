import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { parseJsonFromText } from "@/utils/jsonParsing";
import type { WorkflowAIEditResponse } from "@/types/workflow";

export interface WorkflowAIEditRequest {
  userPrompt: string;
}

type WorkflowAIEditJobStatus = "pending" | "processing" | "completed" | "failed";

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function useWorkflowAI(
  workflowId: string,
  options?: { enableStreaming?: boolean },
) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<WorkflowAIEditResponse | null>(null);
  const [streamedOutput, setStreamedOutput] = useState<string>("");
  const requestSeqRef = useRef(0);
  const enableStreaming = options?.enableStreaming ?? true;

  // Cancel any in-flight polling when unmounting
  useEffect(() => {
    return () => {
      requestSeqRef.current += 1;
    };
  }, []);

  const pollWorkflowEditJob = async (
    jobId: string,
    requestSeq: number,
  ): Promise<{ jobId: string; result: WorkflowAIEditResponse }> => {
    while (requestSeqRef.current === requestSeq) {
      const statusRes = await api.getWorkflowAIEditStatus(jobId);
      const status = statusRes.status as WorkflowAIEditJobStatus;

      if (status === "completed") {
        if (!statusRes.result) {
          throw new Error("Workflow AI edit completed but returned no result");
        }
        setProposal(statusRes.result);
        return { jobId, result: statusRes.result };
      }

      if (status === "failed") {
        throw new Error(statusRes.error_message || "Workflow AI edit failed");
      }

      await delay(2000);
    }

    throw new Error("Workflow AI edit cancelled");
  };

  const parseStreamedProposal = (raw: string): WorkflowAIEditResponse | null => {
    return parseJsonFromText<WorkflowAIEditResponse>(raw, { preferLast: true });
  };

  const generateWorkflowEdit = async (
    userPrompt: string,
    contextJobId?: string,
  ): Promise<{ jobId: string; result: WorkflowAIEditResponse }> => {
    setIsGenerating(true);
    setError(null);
    setProposal(null);
    setStreamedOutput("");

    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;

    try {
      if (!enableStreaming) {
        const startResult = await api.editWorkflowWithAI(workflowId, {
          userPrompt,
          ...(contextJobId ? { contextJobId } : {}),
        });
        if (!startResult?.job_id) {
          throw new Error(startResult?.message || "Failed to start workflow edit");
        }
        return await pollWorkflowEditJob(startResult.job_id, requestSeq);
      }

      let streamError: string | null = null;
      let streamedText = "";

      const streamResult = await api.streamWorkflowEdit(
        workflowId,
        {
          userPrompt,
          ...(contextJobId ? { contextJobId } : {}),
        },
        {
          onDelta: (text) => {
            if (requestSeqRef.current !== requestSeq) return;
            streamedText += text;
            setStreamedOutput((prev) => prev + text);
          },
          onComplete: (result) => {
            if (requestSeqRef.current !== requestSeq) return;
            if (result) {
              setProposal(result);
            }
          },
          onError: (err) => {
            if (requestSeqRef.current !== requestSeq) return;
            streamError = err;
          },
        },
      );

      if (streamError) {
        throw new Error(streamError);
      }

      if (streamResult.result) {
        return { jobId: streamResult.jobId || "", result: streamResult.result };
      }

      if (streamResult.jobId) {
        return await pollWorkflowEditJob(streamResult.jobId, requestSeq);
      }

      const parsed = parseStreamedProposal(streamedText);
      if (parsed) {
        setProposal(parsed);
        return { jobId: "", result: parsed };
      }

      throw new Error("Workflow AI edit completed but returned no result");
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
    setStreamedOutput("");
  };

  return {
    generateWorkflowEdit,
    clearProposal,
    isGenerating,
    error,
    proposal,
    streamedOutput,
  };
}
