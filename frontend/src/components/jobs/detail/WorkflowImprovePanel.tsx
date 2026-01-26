"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";

import { api } from "@/lib/api";
import { formatRelativeTime } from "@/utils/date";
import { truncate } from "@/utils/formatting";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";

import type { Artifact } from "@/types/artifact";
import type { Job, MergedStep } from "@/types/job";
import type {
  Workflow,
  WorkflowAIImprovement,
  WorkflowImprovementStatus,
} from "@/types/workflow";

import {
  buildContextRows,
  filterHtmlArtifacts,
  formatTimestamp,
  getStepKey,
  HistoryItem,
  IMPROVEMENT_STATUS_META,
  normalizeSearchText,
} from "./improve/utils";
import { ImprovementHistoryList } from "./improve/ImprovementHistoryList";
import { ImprovementDetails } from "./improve/ImprovementDetails";
import { ContextStepsTable } from "./improve/ContextStepsTable";
import { HtmlArtifactsGallery } from "./improve/HtmlArtifactsGallery";

interface WorkflowImprovePanelProps {
  job: Job;
  workflow: Workflow | null;
  mergedSteps: MergedStep[];
  artifacts: Artifact[];
}

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
  const selectedHistoryIdRef = useRef(selectedHistoryId);
  const [historySearch, setHistorySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | WorkflowImprovementStatus
  >("all");
  const [stepSearch, setStepSearch] = useState("");
  const [expandedStepKeys, setExpandedStepKeys] = useState<Set<string>>(
    new Set(),
  );
  const [reviewState, setReviewState] = useState<{
    jobId: string;
    status: WorkflowImprovementStatus;
  } | null>(null);
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
          const currentSelection = preferredId ?? selectedHistoryIdRef.current;
          if (
            currentSelection &&
            (currentSelection === "current" ||
              sorted.some((item) => item.job_id === currentSelection))
          ) {
            return currentSelection;
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
    [workflowId],
  );

  useEffect(() => {
    selectedHistoryIdRef.current = selectedHistoryId;
  }, [selectedHistoryId]);

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
        createdAt: job?.created_at,
        isCurrent: true,
        improvement: null,
      },
    ];
    improvements.forEach((improvement) => {
      const summary = improvement.result?.changes_summary
        ? truncate(improvement.result.changes_summary, 80)
        : "AI improvement";
      items.push({
        id: improvement.job_id,
        title: summary,
        subtitle: `Created ${formatRelativeTime(improvement.created_at)}`,
        status: improvement.improvement_status || "pending",
        createdAt: improvement.created_at,
        improvement,
        isCurrent: false,
      });
    });
    return items;
  }, [currentOptionLabel, improvements, job?.created_at]);

  const statusCounts = useMemo(
    () =>
      improvements.reduce(
        (acc, improvement) => {
          const status = improvement.improvement_status || "pending";
          acc.total += 1;
          acc[status] += 1;
          return acc;
        },
        { total: 0, pending: 0, approved: 0, denied: 0 },
      ),
    [improvements],
  );

  const filteredHistoryItems = useMemo(() => {
    const searchValue = normalizeSearchText(historySearch);
    return historyItems.filter((item) => {
      if (item.isCurrent) {
        if (!searchValue) return true;
        const currentHaystack = [item.title, item.subtitle]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return currentHaystack.includes(searchValue);
      }
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      if (!searchValue) return true;
      const haystack = [
        item.title,
        item.subtitle,
        item.improvement?.user_prompt,
        item.improvement?.result?.changes_summary,
        item.improvement?.job_id,
        item.improvement?.context_job_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchValue);
    });
  }, [historyItems, historySearch, statusFilter]);

  useEffect(() => {
    if (!filteredHistoryItems.length) return;
    if (!filteredHistoryItems.some((item) => item.id === selectedHistoryId)) {
      setSelectedHistoryId(filteredHistoryItems[0].id);
    }
  }, [filteredHistoryItems, selectedHistoryId]);

  const activeHistoryId = selectedHistoryId || historyItems[0]?.id || "current";
  const activeHistory =
    historyItems.find((item) => item.id === activeHistoryId) || historyItems[0];
  const navigationItems =
    filteredHistoryItems.length > 0 ? filteredHistoryItems : historyItems;
  const activeHistoryIndex = Math.max(
    0,
    navigationItems.findIndex((item) => item.id === activeHistoryId),
  );

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
    setStepSearch("");
    setExpandedStepKeys(new Set());
  }, [activeHistoryId]);

  const filteredContextRows = useMemo(() => {
    const searchValue = normalizeSearchText(stepSearch);
    if (!searchValue) return contextRows;
    return contextRows.filter((row) => {
      const haystack = [
        row.step_name,
        row.instructions,
        row.description,
        row.model,
        row.tools,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchValue);
    });
  }, [contextRows, stepSearch]);

  const contextSummary = useMemo(() => {
    const models = new Set<string>();
    const tools = new Set<string>();
    contextRows.forEach((row) => {
      if (row.model && row.model !== "N/A") models.add(row.model);
      if (row.tools && row.tools !== "N/A") {
        row.tools.split(",").forEach((tool) => {
          const trimmed = tool.trim();
          if (trimmed) tools.add(trimmed);
        });
      }
    });
    return {
      total: contextRows.length,
      models: Array.from(models),
      tools: Array.from(tools),
    };
  }, [contextRows]);

  const toggleStepExpansion = (stepKey: string) => {
    setExpandedStepKeys((prev) => {
      const next = new Set(prev);
      if (next.has(stepKey)) {
        next.delete(stepKey);
      } else {
        next.add(stepKey);
      }
      return next;
    });
  };

  const expandAllSteps = () => {
    setExpandedStepKeys(new Set(filteredContextRows.map(getStepKey)));
  };

  const collapseAllSteps = () => {
    setExpandedStepKeys(new Set());
  };

  const handleCopyText = useCallback(async (label: string, text: string) => {
    if (!text || text === "N/A") {
      toast.error("Nothing to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch (err) {
      console.error("[WorkflowImprovePanel] Failed to copy text", err);
      toast.error("Failed to copy");
    }
  }, []);

  const handleReview = useCallback(
    async (status: WorkflowImprovementStatus) => {
      if (!selectedImprovement) return;
      if (
        status === "denied" &&
        !confirm("Deny this improvement? You can review again later.")
      ) {
        return;
      }
      setReviewState({ jobId: selectedImprovement.job_id, status });
      try {
        const response = await api.reviewWorkflowAIImprovement(
          selectedImprovement.job_id,
          status,
        );
        const updated = response.improvement || {
          ...selectedImprovement,
          improvement_status: status,
        };
        setImprovements((prev) =>
          prev.map((item) =>
            item.job_id === selectedImprovement.job_id ? updated : item,
          ),
        );
        toast.success(
          `Marked as ${IMPROVEMENT_STATUS_META[status].label.toLowerCase()}`,
        );
      } catch (err) {
        console.error(
          "[WorkflowImprovePanel] Failed to review improvement",
          err,
        );
        toast.error("Failed to update improvement status");
      } finally {
        setReviewState(null);
      }
    },
    [selectedImprovement],
  );

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
        console.error(
          "[WorkflowImprovePanel] Failed to load HTML artifacts",
          err,
        );
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
    if (!navigationItems.length) return;
    const prevIndex = Math.max(0, activeHistoryIndex - 1);
    const prev = navigationItems[prevIndex];
    if (prev) setSelectedHistoryId(prev.id);
  };

  const handleNextVersion = () => {
    if (!navigationItems.length) return;
    const nextIndex = Math.min(
      navigationItems.length - 1,
      activeHistoryIndex + 1,
    );
    const next = navigationItems[nextIndex];
    if (next) setSelectedHistoryId(next.id);
  };

  const handleRefreshHistory = () => {
    void loadImprovements(activeHistoryId);
  };

  const handleClearFilters = () => {
    setHistorySearch("");
    setStatusFilter("all");
  };

  const isCurrentHistory = activeHistoryId === "current";
  const activeJobId = isCurrentHistory
    ? job?.job_id
    : selectedImprovement?.job_id;
  const contextJobId = isCurrentHistory
    ? job?.job_id
    : selectedImprovement?.context_job_id;
  const improvementStatus =
    selectedImprovement?.improvement_status || "pending";
  const improvementStatusMeta = selectedImprovement
    ? IMPROVEMENT_STATUS_META[improvementStatus]
    : null;
  const isReviewing = reviewState?.jobId === selectedImprovement?.job_id;

  return (
    <SectionCard
      title="Workflow improvements"
      description="Review AI improvements, compare context, and preview outputs."
    >
      <div className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
          <ImprovementHistoryList
            historyItems={historyItems}
            statusCounts={statusCounts}
            historySearch={historySearch}
            setHistorySearch={setHistorySearch}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            improvementsLoading={improvementsLoading}
            filteredHistoryItems={filteredHistoryItems}
            activeHistoryId={activeHistoryId}
            setSelectedHistoryId={setSelectedHistoryId}
            handleRefreshHistory={handleRefreshHistory}
            handleClearFilters={handleClearFilters}
          />

          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-foreground">
                  Selected version
                </div>
                <div className="text-xs text-muted-foreground">
                  Review context, status, and AI change summaries.
                </div>
              </div>
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
                <div className="text-[11px] text-muted-foreground">
                  {navigationItems.length
                    ? `Version ${activeHistoryIndex + 1} of ${navigationItems.length}`
                    : "No history"}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleNextVersion}
                  disabled={activeHistoryIndex >= navigationItems.length - 1}
                  aria-label="Next version"
                  className="h-8 w-8 p-0"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ImprovementDetails
              activeHistory={activeHistory}
              isCurrentHistory={isCurrentHistory}
              improvementStatusMeta={improvementStatusMeta}
              activeJobId={activeJobId}
              contextJobId={contextJobId ?? undefined}
              selectedImprovement={selectedImprovement}
              job={job}
              handleReview={handleReview}
              isReviewing={isReviewing}
              reviewState={reviewState}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-foreground">Preview</div>
            <div className="text-xs text-muted-foreground">
              Toggle between workflow steps and HTML outputs.
            </div>
          </div>
          <div className="inline-flex rounded-lg border border-border bg-background p-1">
            <Button
              type="button"
              size="sm"
              variant={previewMode === "steps" ? "secondary" : "ghost"}
              onClick={() => setPreviewMode("steps")}
              aria-pressed={previewMode === "steps"}
            >
              Configuration steps ({contextSummary.total})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={previewMode === "html" ? "secondary" : "ghost"}
              onClick={() => setPreviewMode("html")}
              aria-pressed={previewMode === "html"}
            >
              Final HTMLs ({htmlLoading ? "…" : htmlArtifacts.length})
            </Button>
          </div>
        </div>

        {previewMode === "steps" ? (
          <ContextStepsTable
            contextSummary={contextSummary}
            stepSearch={stepSearch}
            setStepSearch={setStepSearch}
            filteredContextRows={filteredContextRows}
            contextRows={contextRows}
            emptyMessage={emptyMessage}
            expandedStepKeys={expandedStepKeys}
            toggleStepExpansion={toggleStepExpansion}
            expandAllSteps={expandAllSteps}
            collapseAllSteps={collapseAllSteps}
            handleCopyText={handleCopyText}
            truncate={truncate}
          />
        ) : htmlLoading ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            Loading HTML outputs…
          </div>
        ) : htmlError ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            {htmlError}
          </div>
        ) : htmlArtifacts.length > 0 ? (
          <HtmlArtifactsGallery htmlArtifacts={htmlArtifacts} />
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            {htmlEmptyMessage}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
