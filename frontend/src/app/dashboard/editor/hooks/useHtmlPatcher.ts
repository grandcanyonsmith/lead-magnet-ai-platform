import { useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api/errors";
import type { AIModel, ReasoningEffort } from "@/types/workflow";
import { DEFAULT_AI_MODEL } from "@/constants/models";

export type AISpeed = "normal" | "fast" | "turbo";

interface UseHtmlPatcherProps {
  jobId: string | null;
  onApply: (html: string) => void;
  initialUrl?: string | null;
}

export function useHtmlPatcher({
  jobId,
  onApply,
  initialUrl,
}: UseHtmlPatcherProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [aiModel, setAiModel] = useState<AIModel>(DEFAULT_AI_MODEL);
  const [aiSpeed, setAiSpeed] = useState<AISpeed>("fast");
  const [aiReasoningEffort, setAiReasoningEffort] =
    useState<ReasoningEffort>("high");

  const submitPatch = useCallback(
    async ({
      currentHtml,
      selectedElement,
      selectedOuterHtml,
    }: {
      currentHtml: string;
      selectedElement: string | null;
      selectedOuterHtml: string | null;
    }) => {
      if (!prompt.trim() || !jobId) return;
      setIsProcessing(true);

      try {
        // Submit patch request (returns 202 with patch_id)
        const patchRes = await api.post<{
          patch_id: string;
          status: string;
          message: string;
        }>(`/v1/jobs/${jobId}/html/patch`, {
          // Always send the latest editor HTML (even if unsaved) so sequential AI edits stack correctly.
          html: currentHtml,
          prompt: prompt,
          selector: selectedElement,
          model: aiModel,
          reasoning_effort: aiReasoningEffort,
          selected_outer_html: selectedOuterHtml,
          page_url: initialUrl || undefined,
        });

        const patchId = patchRes.patch_id;
        if (!patchId) {
          throw new Error("No patch ID returned");
        }

        // Poll for completion
        const pollInterval = 1000; // 1 second
        const maxAttempts = 300; // 5 minutes max
        let attempts = 0;

        const pollPatchStatus = (): Promise<void> => {
          return new Promise((resolve, reject) => {
            const doPoll = async () => {
              attempts++;
              if (attempts > maxAttempts) {
                reject(new Error("Patch request timed out"));
                return;
              }

              try {
                const statusRes = await api.get<{
                  patch_id: string;
                  status: "pending" | "processing" | "completed" | "failed";
                  patched_html?: string;
                  summary?: string;
                  error_message?: string;
                  created_at: string;
                  updated_at: string;
                }>(`/v1/jobs/${jobId}/html/patch/${patchId}/status`);

                if (statusRes.status === "completed") {
                  if (statusRes.patched_html) {
                    onApply(statusRes.patched_html);
                    setPrompt("");
                    toast.success("AI changes applied!");
                    resolve();
                  } else {
                    reject(new Error("Patch completed but no HTML returned"));
                  }
                } else if (statusRes.status === "failed") {
                  reject(
                    new Error(
                      statusRes.error_message || "Patch processing failed",
                    ),
                  );
                } else {
                  // Still pending or processing, poll again
                  setTimeout(doPoll, pollInterval);
                }
              } catch (pollErr) {
                // If it's a final error (not a retry), throw it
                if (
                  pollErr instanceof ApiError &&
                  pollErr.statusCode !== 503 &&
                  pollErr.statusCode !== 500
                ) {
                  reject(pollErr);
                  return;
                }
                // For transient errors, retry after a delay
                setTimeout(doPoll, pollInterval * 2);
              }
            };

            // Start polling immediately
            doPoll();
          });
        };

        // Wait for polling to complete
        await pollPatchStatus();
      } catch (err) {
        console.error("AI generation failed:", err);
        const apiErr = err instanceof ApiError ? err : null;
        if (apiErr?.statusCode === 400) {
          toast.error(apiErr.message);
        } else if (apiErr?.statusCode === 503) {
          toast.error(
            "AI editing is temporarily unavailable. Please try again in a moment.",
          );
        } else {
          toast.error(apiErr?.message || "Failed to apply AI changes");
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [
      prompt,
      jobId,
      aiModel,
      aiReasoningEffort,
      initialUrl,
      onApply,
    ],
  );

  return {
    prompt,
    setPrompt,
    isProcessing,
    submitPatch,
    aiModel,
    setAiModel,
    aiSpeed,
    setAiSpeed,
    aiReasoningEffort,
    setAiReasoningEffort,
  };
}
