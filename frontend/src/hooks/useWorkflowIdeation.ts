import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import {
  WorkflowIdeationMessage,
  WorkflowIdeationResponse,
  AIModel,
} from "@/types";
import { logger } from "@/utils/logger";

export function useWorkflowIdeation() {
  const [isIdeating, setIsIdeating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WorkflowIdeationResponse | null>(null);

  const ideate = useCallback(
    async (messages: WorkflowIdeationMessage[], model?: AIModel) => {
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

  return {
    ideate,
    isIdeating,
    error,
    result,
    reset,
  };
}
