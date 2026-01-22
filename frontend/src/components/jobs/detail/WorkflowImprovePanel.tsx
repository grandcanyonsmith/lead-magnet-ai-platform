"use client";

import {
  Fragment,
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
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { PreviewCard } from "@/components/artifacts/PreviewCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SectionCard } from "@/components/ui/SectionCard";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";

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

const IMPROVEMENT_STATUS_META: Record<
  WorkflowImprovementStatus,
  {
    label: string;
    variant: "warning" | "success" | "destructive";
    description: string;
  }
> = {
  pending: {
    label: "Pending",
    variant: "warning",
    description: "Waiting for review",
  },
  approved: {
    label: "Approved",
    variant: "success",
    description: "Approved by reviewer",
  },
  denied: {
    label: "Denied",
    variant: "destructive",
    description: "Declined by reviewer",
  },
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
  status?: WorkflowImprovementStatus;
  createdAt?: string;
  isCurrent?: boolean;
  improvement?: WorkflowAIImprovement | null;
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

const normalizeSearchText = (value: string) => value.trim().toLowerCase();

const formatTimestamp = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

const getStepKey = (step: StepContextRow) =>
  `${step.step_order}-${step.step_name}-${step.model}`;

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
        console.error("[WorkflowImprovePanel] Failed to review improvement", err);
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
  const activeJobId = isCurrentHistory ? job?.job_id : selectedImprovement?.job_id;
  const contextJobId = isCurrentHistory
    ? job?.job_id
    : selectedImprovement?.context_job_id;
  const improvementStatus = selectedImprovement?.improvement_status || "pending";
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
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-foreground">History</div>
                <div className="text-xs text-muted-foreground">
                  Browse AI improvements and the current run context.
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleRefreshHistory}
                isLoading={improvementsLoading}
                className="h-8"
              >
                {!improvementsLoading && (
                  <ArrowPathIcon className="h-4 w-4 mr-1.5" />
                )}
                Refresh
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-sm font-semibold text-foreground">
                  {statusCounts.total}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-sm font-semibold text-foreground">
                  {statusCounts.pending}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <p className="text-xs text-muted-foreground">Approved</p>
                <p className="text-sm font-semibold text-foreground">
                  {statusCounts.approved}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <p className="text-xs text-muted-foreground">Denied</p>
                <p className="text-sm font-semibold text-foreground">
                  {statusCounts.denied}
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,190px)]">
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                  placeholder="Search improvements..."
                  className="pl-9"
                />
              </div>
              <Select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as "all" | WorkflowImprovementStatus,
                  )
                }
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending review</option>
                <option value="approved">Approved</option>
                <option value="denied">Denied</option>
              </Select>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Showing {filteredHistoryItems.length} of {historyItems.length}{" "}
                entries
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                disabled={!historySearch && statusFilter === "all"}
              >
                Clear filters
              </Button>
            </div>

            {improvementsLoading && improvements.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                Loading improvements...
              </div>
            ) : filteredHistoryItems.length > 0 ? (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {filteredHistoryItems.map((item) => {
                  const isSelected = item.id === activeHistoryId;
                  const statusMeta = item.status
                    ? IMPROVEMENT_STATUS_META[item.status]
                    : null;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedHistoryId(item.id)}
                      className={`group w-full rounded-lg border px-3 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                        isSelected
                          ? "border-primary/40 bg-primary/5 shadow-sm"
                          : "border-border bg-background hover:border-muted-foreground/30 hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p
                            className="text-sm font-semibold text-foreground truncate"
                            title={item.title}
                          >
                            {item.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.subtitle || "No summary available"}
                          </p>
                          {item.improvement?.user_prompt ? (
                            <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
                              Prompt: {item.improvement.user_prompt}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          {item.isCurrent ? (
                            <Badge variant="outline">Current</Badge>
                          ) : null}
                          {statusMeta ? (
                            <Badge
                              variant={statusMeta.variant}
                              title={statusMeta.description}
                            >
                              {statusMeta.label}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      {item.improvement?.result?.changes_summary ? (
                        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                          {item.improvement.result.changes_summary}
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                No improvements match your filters.
              </div>
            )}
          </div>

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

            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {activeHistory?.title || "History"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {activeHistory?.subtitle || "No history entries yet."}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isCurrentHistory ? (
                    <Badge variant="outline">Current run</Badge>
                  ) : null}
                  {improvementStatusMeta ? (
                    <Badge
                      variant={improvementStatusMeta.variant}
                      title={improvementStatusMeta.description}
                    >
                      {improvementStatusMeta.label}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  <p className="text-xs text-muted-foreground">Job ID</p>
                  <p className="text-sm font-mono text-foreground">
                    {activeJobId ? truncate(activeJobId, 22) : "—"}
                  </p>
                  {activeJobId ? (
                    <a
                      href={`/dashboard/jobs/${activeJobId}`}
                      className="text-xs text-primary-600 hover:underline"
                    >
                      Open job
                    </a>
                  ) : null}
                </div>
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  <p className="text-xs text-muted-foreground">Context job</p>
                  {contextJobId ? (
                    <>
                      <p className="text-sm font-mono text-foreground">
                        {truncate(contextJobId, 22)}
                      </p>
                      <a
                        href={`/dashboard/jobs/${contextJobId}`}
                        className="text-xs text-primary-600 hover:underline"
                      >
                        Open job
                      </a>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No context run linked
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm font-medium text-foreground">
                    {formatTimestamp(activeHistory?.createdAt)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  <p className="text-xs text-muted-foreground">Updated</p>
                  <p className="text-sm font-medium text-foreground">
                    {formatTimestamp(selectedImprovement?.updated_at)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  <p className="text-xs text-muted-foreground">Run status</p>
                  <div className="mt-1">
                    {isCurrentHistory ? (
                      <StatusBadge status={job.status} />
                    ) : selectedImprovement ? (
                      <StatusBadge status={selectedImprovement.status} />
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-background px-3 py-2">
                <p className="text-xs text-muted-foreground">Changes summary</p>
                <p className="text-sm text-foreground">
                  {selectedImprovement?.result?.changes_summary ||
                    (isCurrentHistory
                      ? "Current run context does not include an improvement summary yet."
                      : "No changes summary available for this improvement.")}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background px-3 py-2">
                <p className="text-xs text-muted-foreground">Prompt</p>
                <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                  {selectedImprovement?.user_prompt ||
                    (isCurrentHistory
                      ? "No prompt recorded for the current run."
                      : "No prompt available for this improvement.")}
                </p>
              </div>

              {selectedImprovement ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    Reviewed{" "}
                    {selectedImprovement.reviewed_at
                      ? formatTimestamp(selectedImprovement.reviewed_at)
                      : "—"}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedImprovement.improvement_status === "pending" ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => handleReview("approved")}
                          isLoading={
                            isReviewing && reviewState?.status === "approved"
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReview("denied")}
                          isLoading={
                            isReviewing && reviewState?.status === "denied"
                          }
                        >
                          Deny
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {IMPROVEMENT_STATUS_META[improvementStatus].description}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  AI improvements will appear here once generated.
                </div>
              )}
            </div>
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
          contextRows.length > 0 ? (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Steps</p>
                  <p className="text-sm font-semibold text-foreground">
                    {contextSummary.total}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Models</p>
                  <p
                    className="text-sm font-semibold text-foreground truncate"
                    title={contextSummary.models.join(", ")}
                  >
                    {contextSummary.models.length
                      ? truncate(contextSummary.models.join(", "), 32)
                      : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Tools</p>
                  <p
                    className="text-sm font-semibold text-foreground truncate"
                    title={contextSummary.tools.join(", ")}
                  >
                    {contextSummary.tools.length
                      ? truncate(contextSummary.tools.join(", "), 32)
                      : "—"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="relative w-full sm:max-w-[260px]">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={stepSearch}
                    onChange={(event) => setStepSearch(event.target.value)}
                    placeholder="Search steps..."
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={expandAllSteps}
                    disabled={filteredContextRows.length === 0}
                  >
                    Expand all
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={collapseAllSteps}
                    disabled={expandedStepKeys.size === 0}
                  >
                    Collapse
                  </Button>
                </div>
              </div>

              {filteredContextRows.length > 0 ? (
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
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-background">
                      {filteredContextRows.map((step) => {
                        const stepKey = getStepKey(step);
                        const isExpanded = expandedStepKeys.has(stepKey);
                        const toolList =
                          step.tools && step.tools !== "N/A"
                            ? step.tools
                                .split(",")
                                .map((tool) => tool.trim())
                                .filter(Boolean)
                            : [];

                        return (
                          <Fragment key={stepKey}>
                            <tr className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground">
                                {step.step_order}
                              </td>
                              <td className="px-4 py-3 text-sm text-foreground">
                                {step.step_name}
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground max-w-md">
                                <div
                                  className="line-clamp-2"
                                  title={step.instructions}
                                >
                                  {step.instructions}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground max-w-md">
                                <div
                                  className="line-clamp-2"
                                  title={step.description}
                                >
                                  {step.description}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                                {step.model}
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">
                                {step.tools}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => toggleStepExpansion(stepKey)}
                                  aria-expanded={isExpanded}
                                  className="h-8 w-8 p-0"
                                >
                                  {isExpanded ? (
                                    <ChevronUpIcon className="h-4 w-4" />
                                  ) : (
                                    <ChevronDownIcon className="h-4 w-4" />
                                  )}
                                  <span className="sr-only">
                                    {isExpanded
                                      ? "Collapse details"
                                      : "Expand details"}
                                  </span>
                                </Button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-muted/20">
                                <td colSpan={7} className="px-4 py-4">
                                  <div className="grid gap-4 lg:grid-cols-2">
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs font-semibold uppercase text-muted-foreground">
                                          Instructions
                                        </p>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          onClick={() =>
                                            handleCopyText(
                                              "Instructions",
                                              step.instructions,
                                            )
                                          }
                                        >
                                          Copy
                                        </Button>
                                      </div>
                                      <pre className="whitespace-pre-wrap break-words text-sm text-foreground font-sans">
                                        {step.instructions}
                                      </pre>
                                    </div>
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs font-semibold uppercase text-muted-foreground">
                                          Description
                                        </p>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          onClick={() =>
                                            handleCopyText(
                                              "Description",
                                              step.description,
                                            )
                                          }
                                        >
                                          Copy
                                        </Button>
                                      </div>
                                      <pre className="whitespace-pre-wrap break-words text-sm text-foreground font-sans">
                                        {step.description}
                                      </pre>
                                    </div>
                                  </div>
                                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <span className="uppercase text-[10px]">
                                      Model
                                    </span>
                                    <span className="font-medium text-foreground">
                                      {step.model}
                                    </span>
                                    <span className="text-muted-foreground/50">
                                      •
                                    </span>
                                    <span className="uppercase text-[10px]">
                                      Tools
                                    </span>
                                    {toolList.length ? (
                                      <div className="flex flex-wrap gap-1">
                                        {toolList.map((tool) => (
                                          <Badge key={tool} variant="outline">
                                            {tool}
                                          </Badge>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-foreground">N/A</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                  {contextRows.length === 0
                    ? emptyMessage
                    : "No steps match your search."}
                </div>
              )}
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
