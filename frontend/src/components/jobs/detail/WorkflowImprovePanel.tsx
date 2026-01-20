"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { api } from "@/lib/api";
import { formatRelativeTime } from "@/utils/date";
import { truncate } from "@/utils/formatting";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { PreviewCard } from "@/components/artifacts/PreviewCard";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";

import type { Artifact } from "@/types/artifact";
import type { Job, MergedStep } from "@/types/job";
import type {
  Workflow,
  WorkflowAIImprovement,
  WorkflowImprovementStatus,
} from "@/types/workflow";

interface WorkflowImprovePanelProps {
  job: Job;
  workflow: Workflow | null;
  mergedSteps: MergedStep[];
  artifacts: Artifact[];
}

const IMPROVEMENT_STATUS_LABELS: Record<WorkflowImprovementStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
};

type StepContextRow = {
  step_order: number;
  step_name: string;
  instructions: string;
  description: string;
  model: string;
  tools: string;
};

type HistoryItem = {
  id: string;
  title: string;
  subtitle?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const getStringValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

const formatToolValue = (tool: unknown): string => {
  if (typeof tool === "string") return tool;
  if (isRecord(tool)) {
    if (typeof tool.type === "string") return tool.type;
    if (typeof tool.name === "string") return tool.name;
  }
  return "unknown";
};

const formatTools = (tools: unknown): string => {
  if (Array.isArray(tools)) {
    return tools.length > 0 ? tools.map(formatToolValue).join(", ") : "N/A";
  }
  if (typeof tools === "string") return tools;
  return "N/A";
};

const isHtmlArtifact = (artifact: Artifact): boolean => {
  const contentType = (artifact.content_type || artifact.mime_type || "")
    .toLowerCase()
    .trim();
  if (contentType.includes("text/html")) return true;
  const fileName = (artifact.file_name || artifact.artifact_name || "")
    .toLowerCase()
    .trim();
  if (fileName.endsWith(".html") || fileName.endsWith(".htm")) return true;
  const artifactType = (artifact.artifact_type || "").toLowerCase();
  return artifactType.includes("html");
};

const filterHtmlArtifacts = (list: Artifact[]) =>
  list.filter((artifact) => isHtmlArtifact(artifact));

const buildContextRows = (steps: unknown[]): StepContextRow[] => {
  if (!Array.isArray(steps)) return [];
  return steps.map((step, index) => {
    const record = isRecord(step) ? step : {};
    const input = isRecord(record.input) ? record.input : null;
    const stepOrder =
      typeof record.step_order === "number" ? record.step_order : index + 1;
    const stepName =
      getStringValue(record.step_name) || `Step ${stepOrder}`;
    const instructions =
      getStringValue(record.instructions) ||
      getStringValue(input?.instructions) ||
      "N/A";
    const description =
      getStringValue(record.step_description) ||
      getStringValue(record.description) ||
      getStringValue(input?.description) ||
      "N/A";
    const model =
      getStringValue(record.model) || getStringValue(input?.model) || "N/A";
    const tools = formatTools(record.tools ?? input?.tools);

    return {
      step_order: stepOrder,
      step_name: stepName,
      instructions,
      description,
      model,
      tools,
    };
  });
};

export function WorkflowImprovePanel({
  job,
  workflow,
  mergedSteps,
  artifacts,
}: WorkflowImprovePanelProps) {
  const workflowId = workflow?.workflow_id || "";
  const currentOptionLabel = job?.job_id
    ? `Current run (${job.job_id.slice(0, 8)})`
    : "Current run";

  const [improvements, setImprovements] = useState<WorkflowAIImprovement[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string>("");
  const [improvementsLoading, setImprovementsLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState<"steps" | "html">("steps");
  const [htmlArtifacts, setHtmlArtifacts] = useState<Artifact[]>([]);
  const [htmlLoading, setHtmlLoading] = useState(false);
  const [htmlError, setHtmlError] = useState<string | null>(null);
  const [htmlArtifactsByJob, setHtmlArtifactsByJob] = useState<
    Record<string, Artifact[]>
  >({});

  const loadImprovements = useCallback(
    async (preferredId?: string) => {
      if (!workflowId) return;
      setImprovementsLoading(true);
      try {
        const response = await api.getWorkflowAIImprovements(workflowId);
        const normalized = (response.improvements || []).map((item) => ({
          ...item,
          improvement_status: item.improvement_status || "pending",
        }));
        const sorted = [...normalized].sort((a, b) => {
          const aTime = new Date(a.created_at).getTime();
          const bTime = new Date(b.created_at).getTime();
          if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
          return bTime - aTime;
        });
        setImprovements(sorted);

        const resolveSelection = () => {
          if (
            preferredId &&
            (preferredId === "current" ||
              sorted.some((item) => item.job_id === preferredId))
          ) {
            return preferredId;
          }
          if (selectedHistoryId === "current") return "current";
          if (
            selectedHistoryId &&
            sorted.some((item) => item.job_id === selectedHistoryId)
          ) {
            return selectedHistoryId;
          }
          return sorted[0]?.job_id ?? "current";
        };

        setSelectedHistoryId(resolveSelection());
      } catch (err) {
        console.error("[WorkflowImprovePanel] Failed to load improvements", err);
        toast.error("Failed to load improvements history");
      } finally {
        setImprovementsLoading(false);
      }
    },
    [workflowId, selectedHistoryId],
  );

  useEffect(() => {
    if (!workflowId) return;
    void loadImprovements();
  }, [workflowId, loadImprovements]);

  const historyItems = useMemo<HistoryItem[]>(() => {
    const items: HistoryItem[] = [
      {
        id: "current",
        title: currentOptionLabel,
        subtitle: "Current run context",
      },
    ];
    improvements.forEach((improvement) => {
      const statusLabel =
        IMPROVEMENT_STATUS_LABELS[improvement.improvement_status || "pending"];
      const summary = improvement.result?.changes_summary
        ? truncate(improvement.result.changes_summary, 80)
        : "AI improvement";
      const createdLabel = formatRelativeTime(improvement.created_at);
      items.push({
        id: improvement.job_id,
        title: `${statusLabel}: ${summary}`,
        subtitle: `Created ${createdLabel}`,
      });
    });
    return items;
  }, [currentOptionLabel, improvements]);

  const activeHistoryId =
    selectedHistoryId || historyItems[0]?.id || "current";
  const activeHistoryIndex = Math.max(
    0,
    historyItems.findIndex((item) => item.id === activeHistoryId),
  );
  const activeHistory = historyItems[activeHistoryIndex];

  const selectedImprovement = useMemo(() => {
    if (!activeHistoryId || activeHistoryId === "current") return null;
    return improvements.find((item) => item.job_id === activeHistoryId) || null;
  }, [activeHistoryId, improvements]);

  const currentHtmlArtifacts = useMemo(
    () => filterHtmlArtifacts(artifacts || []),
    [artifacts],
  );

  const htmlJobId =
    activeHistoryId === "current"
      ? job?.job_id
      : selectedImprovement?.context_job_id || null;

  const contextRows = useMemo(() => {
    if (activeHistoryId === "current") {
      return buildContextRows(mergedSteps);
    }
    const steps = selectedImprovement?.result?.steps;
    if (!Array.isArray(steps)) return [];
    return buildContextRows(steps);
  }, [activeHistoryId, mergedSteps, selectedImprovement]);

  useEffect(() => {
    if (previewMode !== "html") return;
    setHtmlError(null);

    if (!htmlJobId) {
      setHtmlArtifacts([]);
      setHtmlLoading(false);
      return;
    }

    if (activeHistoryId === "current") {
      setHtmlArtifacts(currentHtmlArtifacts);
      setHtmlLoading(false);
      return;
    }

    if (htmlArtifactsByJob[htmlJobId]) {
      setHtmlArtifacts(htmlArtifactsByJob[htmlJobId]);
      setHtmlLoading(false);
      return;
    }

    let isMounted = true;
    setHtmlLoading(true);
    api
      .getArtifacts({ job_id: htmlJobId })
      .then((response) => {
        if (!isMounted) return;
        const filtered = filterHtmlArtifacts(response.artifacts || []);
        setHtmlArtifacts(filtered);
        setHtmlArtifactsByJob((prev) => ({ ...prev, [htmlJobId]: filtered }));
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("[WorkflowImprovePanel] Failed to load HTML artifacts", err);
        setHtmlError("Unable to load HTML outputs for this version.");
        setHtmlArtifacts([]);
      })
      .finally(() => {
        if (!isMounted) return;
        setHtmlLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    activeHistoryId,
    currentHtmlArtifacts,
    htmlArtifactsByJob,
    htmlJobId,
    previewMode,
  ]);

  const emptyMessage =
    activeHistoryId === "current"
      ? "No execution steps available yet."
      : "No context available for this version.";

  const htmlEmptyMessage = htmlJobId
    ? "No HTML outputs available for this version."
    : "No context run is linked to this version yet.";

  const handlePreviousVersion = () => {
    if (!historyItems.length) return;
    const prevIndex = Math.max(0, activeHistoryIndex - 1);
    const prev = historyItems[prevIndex];
    if (prev) setSelectedHistoryId(prev.id);
  };

  const handleNextVersion = () => {
    if (!historyItems.length) return;
    const nextIndex = Math.min(historyItems.length - 1, activeHistoryIndex + 1);
    const next = historyItems[nextIndex];
    if (next) setSelectedHistoryId(next.id);
  };

  return (
    <SectionCard
      title="Workflow history"
      description="Select a version and toggle between steps or HTML outputs."
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-foreground">History</div>
            <div className="text-xs text-muted-foreground">
              Choose a saved improvement and preview its context.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5 shadow-sm">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handlePreviousVersion}
                disabled={activeHistoryIndex === 0}
                aria-label="Previous version"
                className="h-8 w-8 p-0"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
              <div className="min-w-[220px] max-w-[360px] px-2">
                <div className="text-sm font-semibold text-foreground truncate">
                  {activeHistory?.title || "History"}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {activeHistory?.subtitle || "No history entries yet."}
                </div>
                <div className="text-[10px] text-muted-foreground/80">
                  Version {historyItems.length ? activeHistoryIndex + 1 : 0} of{" "}
                  {historyItems.length}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleNextVersion}
                disabled={activeHistoryIndex >= historyItems.length - 1}
                aria-label="Next version"
                className="h-8 w-8 p-0"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </div>
            <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
              <Button
                type="button"
                size="sm"
                variant={previewMode === "steps" ? "secondary" : "ghost"}
                onClick={() => setPreviewMode("steps")}
              >
                Configuration steps
              </Button>
              <Button
                type="button"
                size="sm"
                variant={previewMode === "html" ? "secondary" : "ghost"}
                onClick={() => setPreviewMode("html")}
              >
                Final HTMLs
              </Button>
            </div>
          </div>
        </div>

        {previewMode === "steps" ? (
          improvementsLoading ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
              Loading history…
            </div>
          ) : contextRows.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border bg-background">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Order
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Step Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Instructions
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Model
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Tools
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-background">
                  {contextRows.map((step, idx) => (
                    <tr
                      key={`${step.step_order}-${idx}`}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground">
                        {step.step_order}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {step.step_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground max-w-md">
                        <div className="truncate" title={step.instructions}>
                          {step.instructions}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {step.description}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                        {step.model}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {step.tools}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          )
        ) : htmlLoading ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            Loading HTML outputs…
          </div>
        ) : htmlError ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            {htmlError}
          </div>
        ) : htmlArtifacts.length > 0 ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{htmlArtifacts.length} HTML output(s)</span>
              <span className="text-muted-foreground/70">
                Scroll to view more previews
              </span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-3 pr-1 snap-x snap-mandatory scrollbar-hide-until-hover">
              {htmlArtifacts.map((artifact) => (
                <div
                  key={artifact.artifact_id}
                  className="min-w-[280px] sm:min-w-[340px] lg:min-w-[420px] max-w-[420px] snap-start"
                >
                  <PreviewCard artifact={artifact} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            {htmlEmptyMessage}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
