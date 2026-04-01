"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { useAIModelOptions } from "@/hooks/useAIModelOptions";
import { api } from "@/lib/api";
import { DEFAULT_AI_MODEL } from "@/constants/models";
import type {
  ArtifactEditStatus,
  ArtifactEditStatusResponse,
} from "@/types/artifact";
import { dispatchArtifactEditCompleted } from "@/utils/jobs/artifactEditEvents";
import { dispatchNotificationsRefresh } from "@/utils/notifications/notificationEvents";

interface ArtifactEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artifactId: string;
  artifactName: string;
  contentType?: string;
  jobId?: string | null;
}

type StatusEvent = {
  id: string;
  status: ArtifactEditStatus;
  message: string;
  updatedAt?: string | null;
};

const STATUS_COPY: Record<
  ArtifactEditStatus,
  {
    label: string;
    badgeClassName: string;
    icon: typeof DocumentTextIcon;
  }
> = {
  pending: {
    label: "Queued",
    badgeClassName:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
    icon: DocumentTextIcon,
  },
  fetching: {
    label: "Loading file",
    badgeClassName:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
    icon: DocumentTextIcon,
  },
  editing: {
    label: "Editing",
    badgeClassName:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200",
    icon: SparklesIcon,
  },
  saving: {
    label: "Saving",
    badgeClassName:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200",
    icon: CloudArrowUpIcon,
  },
  completed: {
    label: "Completed",
    badgeClassName:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
    icon: CheckCircleIcon,
  },
  failed: {
    label: "Failed",
    badgeClassName:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
    icon: ExclamationTriangleIcon,
  },
};

function isTerminalStatus(status?: ArtifactEditStatus | null): boolean {
  return status === "completed" || status === "failed";
}

function defaultMessageForStatus(status: ArtifactEditStatus): string {
  switch (status) {
    case "pending":
      return "Waiting to start";
    case "fetching":
      return "Loading the latest file contents";
    case "editing":
      return "Applying your prompt with the selected model";
    case "saving":
      return "Saving the updated file back to storage";
    case "completed":
      return "The file was updated successfully";
    case "failed":
      return "The file edit did not complete";
    default:
      return "Processing update";
  }
}

function waitWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      const error = new Error("Request aborted");
      (error as Error & { name?: string }).name = "AbortError";
      reject(error);
    };

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort);
    }
  });
}

export function ArtifactEditModal({
  open,
  onOpenChange,
  artifactId,
  artifactName,
  contentType,
  jobId,
}: ArtifactEditModalProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_AI_MODEL);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<ArtifactEditStatusResponse | null>(null);
  const [events, setEvents] = useState<StatusEvent[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const toastIdRef = useRef<string | number | null>(null);
  const completedEditIdRef = useRef<string | null>(null);
  const latestStatusRef = useRef<ArtifactEditStatusResponse | null>(null);
  const { options: modelOptions, loading: modelsLoading } = useAIModelOptions({
    currentModel: selectedModel,
    fallbackModel: DEFAULT_AI_MODEL,
  });
  const resolveDefaultModel = useCallback(() => {
    if (modelOptions.some((option) => option.value === DEFAULT_AI_MODEL)) {
      return DEFAULT_AI_MODEL;
    }
    return modelOptions[0]?.value || DEFAULT_AI_MODEL;
  }, [modelOptions]);

  useEffect(() => {
    latestStatusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!modelOptions.some((option) => option.value === selectedModel)) {
      setSelectedModel(resolveDefaultModel());
    }
  }, [modelOptions, open, resolveDefaultModel, selectedModel]);

  const resetState = useCallback(() => {
    setPrompt("");
    setStatus(null);
    setEvents([]);
    setStreamError(null);
    setSelectedModel(resolveDefaultModel());
    completedEditIdRef.current = null;
    latestStatusRef.current = null;
    toastIdRef.current = null;
  }, [resolveDefaultModel]);

  useEffect(() => {
    if (!open && !running) {
      resetState();
    }
  }, [open, resetState, running]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const currentStatusCopy = useMemo(() => {
    return status ? STATUS_COPY[status.status] : null;
  }, [status]);
  const CurrentStatusIcon = currentStatusCopy?.icon;

  const appendEvent = useCallback((next: ArtifactEditStatusResponse) => {
    const message = next.message || defaultMessageForStatus(next.status);
    const eventId = `${next.status}:${message}:${next.updated_at}`;

    setEvents((previous) => {
      if (previous.some((entry) => entry.id === eventId)) {
        return previous;
      }
      return [
        ...previous,
        {
          id: eventId,
          status: next.status,
          message,
          updatedAt: next.updated_at,
        },
      ];
    });
  }, []);

  const handleTerminalStatus = useCallback(
    (next: ArtifactEditStatusResponse) => {
      if (completedEditIdRef.current === next.edit_id) {
        return;
      }
      if (!isTerminalStatus(next.status)) {
        return;
      }

      completedEditIdRef.current = next.edit_id;
      dispatchNotificationsRefresh();

      if (next.status === "completed") {
        dispatchArtifactEditCompleted({
          editId: next.edit_id,
          artifactId,
          jobId,
        });
        toast.success(
          `${artifactName || "File"} was updated successfully`,
          {
            id: toastIdRef.current || undefined,
          },
        );
      } else {
        toast.error(
          next.error_message || `Failed to update ${artifactName || "file"}`,
          {
            id: toastIdRef.current || undefined,
          },
        );
      }
    },
    [artifactId, artifactName, jobId],
  );

  const applyStatus = useCallback(
    (next: ArtifactEditStatusResponse) => {
      setStatus(next);
      appendEvent(next);
      if (!isTerminalStatus(next.status) && toastIdRef.current) {
        toast.loading(next.message || defaultMessageForStatus(next.status), {
          id: toastIdRef.current,
        });
      }
      handleTerminalStatus(next);
    },
    [appendEvent, handleTerminalStatus],
  );

  const pollUntilComplete = useCallback(
    async (editId: string, signal?: AbortSignal) => {
      while (true) {
        const next = await api.artifacts.getArtifactEditStatus(editId);
        applyStatus(next);
        if (isTerminalStatus(next.status)) {
          return next;
        }
        await waitWithAbort(1000, signal);
      }
    },
    [applyStatus],
  );

  const handleSubmit = useCallback(async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || running) {
      return;
    }

    setRunning(true);
    setStreamError(null);
    setEvents([]);
    setStatus(null);
    completedEditIdRef.current = null;

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    toastIdRef.current = toast.loading(`Editing ${artifactName || "file"}...`);

    try {
      const started = await api.artifacts.startArtifactEdit(artifactId, {
        prompt: trimmedPrompt,
        model: selectedModel || DEFAULT_AI_MODEL,
      });
      applyStatus(started);

      const streamResult = await api.artifacts.streamArtifactEdit(
        started.edit_id,
        {
          onSnapshot: applyStatus,
          onUpdate: applyStatus,
          onComplete: (result) => {
            if (result) {
              applyStatus(result);
            }
          },
          onError: (error) => {
            setStreamError(error);
          },
        },
        abortController.signal,
      );

      if (streamResult.fallback) {
        await pollUntilComplete(started.edit_id, abortController.signal);
      } else if (
        !isTerminalStatus(latestStatusRef.current?.status) &&
        !abortController.signal.aborted
      ) {
        const finalStatus = await api.artifacts.getArtifactEditStatus(started.edit_id);
        applyStatus(finalStatus);
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        const message = error?.message || "Failed to start file edit";
        setStreamError(message);
        toast.error(message, { id: toastIdRef.current || undefined });
      }
    } finally {
      if (!abortController.signal.aborted) {
        setRunning(false);
      }
    }
  }, [
    applyStatus,
    artifactId,
    artifactName,
    pollUntilComplete,
    prompt,
    running,
    selectedModel,
  ]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && running) {
        return;
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, running],
  );

  const latestMessage =
    status?.message ||
    (status ? defaultMessageForStatus(status.status) : "Describe what you want to change.");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!running}
        className="max-h-[90vh] w-full max-w-2xl overflow-visible p-0"
      >
        <div className="flex max-h-[90vh] flex-col">
          <DialogHeader className="border-b border-border px-6 py-5">
            <DialogTitle className="flex items-center gap-2">
              <SparklesIcon className="h-5 w-5 text-primary" />
              Edit File With AI
            </DialogTitle>
            <DialogDescription className="pt-1">
              Changes will be applied only to <span className="font-medium text-foreground">{artifactName}</span> and saved automatically when the edit completes.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
              <div className="text-sm font-medium text-foreground">{artifactName}</div>
              {contentType ? (
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {contentType}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
              <div className="space-y-2">
                <label
                  htmlFor={`artifact-edit-prompt-${artifactId}`}
                  className="text-sm font-medium text-foreground"
                >
                  Describe the changes you want
                </label>
                <textarea
                  id={`artifact-edit-prompt-${artifactId}`}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={6}
                  disabled={running}
                  placeholder="Example: tighten the copy, fix any grammar issues, and make the CTA more specific."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor={`artifact-edit-model-${artifactId}`}
                  className="text-sm font-medium text-foreground"
                >
                  Model
                </label>
                <Select
                  id={`artifact-edit-model-${artifactId}`}
                  value={selectedModel}
                  onChange={setSelectedModel}
                  placeholder={modelsLoading ? "Loading models..." : "Select model"}
                  disabled={modelsLoading || running}
                  searchable
                  portal={false}
                  searchPlaceholder="Search models..."
                  options={modelOptions}
                />
                <p className="text-xs text-muted-foreground">
                  The selected model edits only this file and saves automatically when finished.
                </p>
              </div>
            </div>

            {(status || streamError) && (
              <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">
                      Live progress
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {streamError || latestMessage}
                    </div>
                  </div>
                  {currentStatusCopy ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${currentStatusCopy.badgeClassName}`}
                    >
                      {CurrentStatusIcon ? (
                        <CurrentStatusIcon
                          className={`h-4 w-4 ${
                            running &&
                            (status?.status === "editing" ||
                              status?.status === "saving")
                              ? "animate-pulse"
                              : ""
                          }`}
                        />
                      ) : null}
                      {currentStatusCopy.label}
                    </span>
                  ) : null}
                </div>

                <div
                  className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-3"
                  aria-live="polite"
                >
                  {events.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      Progress updates will appear here once the edit begins.
                    </div>
                  ) : (
                    events.map((event) => {
                      const statusCopy = STATUS_COPY[event.status];
                      const StatusIcon = statusCopy.icon;
                      return (
                        <div
                          key={event.id}
                          className="flex items-start gap-3 rounded-md bg-background/80 px-3 py-2"
                        >
                          <StatusIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-foreground">
                              {statusCopy.label}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {event.message}
                            </div>
                          </div>
                          {event.updatedAt ? (
                            <div className="shrink-0 text-xs text-muted-foreground">
                              {new Date(event.updatedAt).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={running}
            >
              {isTerminalStatus(status?.status) ? "Close" : "Cancel"}
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!prompt.trim() || !selectedModel || running}
            >
              {running ? (
                <>
                  <ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" />
                  Editing...
                </>
              ) : (
                <>
                  <SparklesIcon className="mr-2 h-4 w-4" />
                  Edit and Save
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
