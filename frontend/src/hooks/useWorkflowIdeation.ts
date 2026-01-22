import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import {
  WorkflowIdeationMessage,
  WorkflowIdeationResponse,
  WorkflowIdeationSelectedDeliverable,
  AIModel,
} from "@/types";
import { logger } from "@/utils/logger";

export function useWorkflowIdeation() {
  const [isIdeating, setIsIdeating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WorkflowIdeationResponse | null>(null);

  const ideate = useCallback(
    async (
      messages: WorkflowIdeationMessage[],
      model?: AIModel,
      options?: {
        mode?: "ideation" | "followup";
        selectedDeliverable?: WorkflowIdeationSelectedDeliverable;
      },
    ) => {
      if (!messages || messages.length === 0) {
        setError("Please enter a message to start the chat");
        return null;
      }

      setIsIdeating(true);
      setError(null);
      setResult(null);

      try {
        const response = await api.ideateWorkflow({
          messages,
          model,
          mode: options?.mode,
          selected_deliverable: options?.selectedDeliverable,
        });
        setResult(response);
        return response;
      } catch (err: any) {
        logger.debug("Ideation failed", { error: err });
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to generate ideas",
        );
        return null;
      } finally {
        setIsIdeating(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setIsIdeating(false);
    setError(null);
    setResult(null);
  }, []);

  const ideateStream = useCallback(
    async (
      messages: WorkflowIdeationMessage[],
      model?: AIModel,
      options?: {
        mode?: "ideation" | "followup";
        selectedDeliverable?: WorkflowIdeationSelectedDeliverable;
      },
      callbacks?: {
        onDelta?: (text: string) => void;
        onComplete?: (response?: WorkflowIdeationResponse) => void;
        onError?: (error: string) => void;
      },
      signal?: AbortSignal,
    ) => {
      if (!messages || messages.length === 0) {
        setError("Please enter a message to start the chat");
        return null;
      }

      setIsIdeating(true);
      setError(null);
      setResult(null);

      try {
        await api.streamIdeation(
          {
            messages,
            model,
            mode: options?.mode,
            selected_deliverable: options?.selectedDeliverable,
          },
          {
            onDelta: (text) => callbacks?.onDelta?.(text),
            onComplete: (response) => {
              if (response) {
                setResult(response);
              }
              callbacks?.onComplete?.(response);
            },
            onError: (err) => {
              setError(err);
              callbacks?.onError?.(err);
            },
          },
          signal,
        );
      } catch (err: any) {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          "Failed to generate ideas";
        setError(message);
        callbacks?.onError?.(message);
        return null;
      } finally {
        setIsIdeating(false);
      }

      return null;
    },
    [],
  );

  return {
    ideate,
    ideateStream,
    isIdeating,
    error,
    result,
    reset,
  };
}
