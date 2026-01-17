"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SparklesIcon,
  ClipboardDocumentIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";

import { api } from "@/lib/api";
import { useWorkflowAI } from "@/hooks/useWorkflowAI";
import { WorkflowDiffPreview } from "@/components/workflows/edit/WorkflowDiffPreview";
import { formatRelativeTime } from "@/utils/date";
import { truncate } from "@/utils/formatting";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

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

const IMPROVEMENT_STATUS_STYLES: Record<
  WorkflowImprovementStatus,
  { label: string; badge: string; chip: string }
> = {
  pending: {
    label: "Pending",
    badge: "bg-amber-100 text-amber-800",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
  },
  approved: {
    label: "Approved",
    badge: "bg-green-100 text-green-800",
    chip: "bg-green-50 text-green-700 border-green-200",
  },
  denied: {
    label: "Denied",
    badge: "bg-red-100 text-red-800",
    chip: "bg-red-50 text-red-700 border-red-200",
  },
};

export function WorkflowImprovePanel({
  job,
  workflow,
  mergedSteps,
}: WorkflowImprovePanelProps) {
  const router = useRouter();
  const workflowId = workflow?.workflow_id || "";

  const [notes, setNotes] = useState("");
  const [isBuildingPrompt, setIsBuildingPrompt] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [showStepSummary, setShowStepSummary] = useState(false);
  const [improvements, setImprovements] = useState<WorkflowAIImprovement[]>([]);
  const [selectedImprovementId, setSelectedImprovementId] = useState<
    string | null
  >(null);
  const [improvementsLoading, setImprovementsLoading] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);

  const { generateWorkflowEdit, isGenerating, error } =
    useWorkflowAI(workflowId);

  const canGenerate = Boolean(workflowId && !isGenerating && !isBuildingPrompt);

  const currentWorkflowForDiff = useMemo(() => {
    return {
      workflow_name: workflow?.workflow_name || "Untitled workflow",
      workflow_description: workflow?.workflow_description || "",
      steps: workflow?.steps || [],
    };
  }, [
    workflow?.workflow_description,
    workflow?.workflow_name,
    workflow?.steps,
  ]);

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
        setImprovements(normalized);

        if (preferredId) {
          setSelectedImprovementId(preferredId);
          return;
        }

        if (
          selectedImprovementId &&
          normalized.some((item) => item.job_id === selectedImprovementId)
        ) {
          return;
        }

        setSelectedImprovementId(normalized[0]?.job_id ?? null);
      } catch (err) {
        console.error("[WorkflowImprovePanel] Failed to load improvements", err);
        toast.error("Failed to load improvements history");
      } finally {
        setImprovementsLoading(false);
      }
    },
    [workflowId, selectedImprovementId],
  );

  useEffect(() => {
    if (!workflowId) return;
    void loadImprovements();
  }, [workflowId, loadImprovements]);

  const selectedImprovement = useMemo(() => {
    if (!selectedImprovementId) return null;
    return (
      improvements.find((item) => item.job_id === selectedImprovementId) || null
    );
  }, [improvements, selectedImprovementId]);

  const selectedStatus = selectedImprovement?.improvement_status || null;
  const selectedStatusMeta = selectedStatus
    ? IMPROVEMENT_STATUS_STYLES[selectedStatus]
    : null;
  const isPendingReview = selectedImprovement?.improvement_status === "pending";

  const handleGenerate = async () => {
    if (!workflow || !workflow.workflow_id) {
      toast.error("Workflow not loaded for this job");
      return;
    }

    setIsBuildingPrompt(true);
    try {
      // We pass the job ID so the backend can fetch the full context (artifacts, steps, etc.)
      // securely and without size limits.
      const result = await generateWorkflowEdit(notes, job.job_id);
      if (result?.jobId) {
        await loadImprovements(result.jobId);
      } else {
        await loadImprovements();
      }
      toast.success("AI improvements generated");
    } catch (err: any) {
      console.error(
        "[WorkflowImprovePanel] Failed to generate improvements",
        err,
      );
      toast.error(err?.message || "Failed to generate AI improvements");
    } finally {
      setIsBuildingPrompt(false);
    }
  };

  const handleApply = async () => {
    if (!workflow || !selectedImprovement?.result) return;
    if (selectedImprovement.improvement_status !== "pending") return;
    setIsApplying(true);
    try {
      const proposal = selectedImprovement.result;
      await api.updateWorkflow(workflow.workflow_id, {
        ...(proposal.workflow_name
          ? { workflow_name: proposal.workflow_name }
          : {}),
        ...(proposal.workflow_description !== undefined
          ? { workflow_description: proposal.workflow_description }
          : {}),
        steps: proposal.steps,
      });
      await api.reviewWorkflowAIImprovement(
        selectedImprovement.job_id,
        "approved",
      );
      toast.success("Workflow updated. Improvement approved.");
      await loadImprovements(selectedImprovement.job_id);
      router.refresh();
    } catch (err: any) {
      console.error("[WorkflowImprovePanel] Failed to apply improvements", err);
      toast.error(err?.message || "Failed to apply improvements");
    } finally {
      setIsApplying(false);
    }
  };

  const handleReject = async () => {
    if (!selectedImprovement) return;
    if (selectedImprovement.improvement_status !== "pending") return;
    setIsReviewing(true);
    try {
      await api.reviewWorkflowAIImprovement(selectedImprovement.job_id, "denied");
      toast("Improvement denied", { icon: "✕" });
      await loadImprovements(selectedImprovement.job_id);
    } catch (err: any) {
      console.error(
        "[WorkflowImprovePanel] Failed to deny improvement",
        err,
      );
      toast.error(err?.message || "Failed to deny improvement");
    } finally {
      setIsReviewing(false);
    }
  };

  const extractedSteps = useMemo(() => {
    return mergedSteps.map((step) => {
      const input = step.input || {};
      const inputInstructions = input["instructions"];
      const instructions =
        typeof step.instructions === "string" && step.instructions.trim()
          ? step.instructions
          : typeof inputInstructions === "string" && inputInstructions.trim()
            ? inputInstructions
            : "N/A";

      const inputDescription = input["description"];
      const description =
        typeof inputDescription === "string" && inputDescription.trim()
          ? inputDescription
          : "N/A";

      const inputModel = input["model"];
      const model =
        typeof step.model === "string" && step.model.trim()
          ? step.model
          : typeof inputModel === "string" && inputModel.trim()
            ? inputModel
            : "N/A";

      const tools = step.tools || input["tools"] || [];
      const toolsStr =
        Array.isArray(tools) && tools.length > 0
          ? tools
              .map((t) => (typeof t === "string" ? t : (t as any)?.type || String(t)))
              .join(", ")
          : "N/A";

      return {
        step_order: step.step_order,
        step_name: step.step_name || "N/A",
        instructions,
        description,
        model,
        tools: toolsStr,
      };
    });
  }, [mergedSteps]);

  const handleCopyStepSummary = async () => {
    try {
      const jsonString = JSON.stringify(extractedSteps, null, 2);
      await navigator.clipboard.writeText(jsonString);
      toast.success("Step summary copied");
    } catch {
      toast.error("Unable to copy step summary");
    }
  };

  return (
    <SectionCard
      title="Review & improve workflow steps"
      description="AI will review the final deliverable, artifacts, and execution results, then propose better step instructions/models/tools for future runs."
      icon={<SparklesIcon className="h-5 w-5" />}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What should be better next time? (optional)
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g. better structure, more concise, stronger CTA, avoid hallucinating facts, more on-brand voice…"
              rows={4}
              className="mt-2"
            />
            {error ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              title={
                workflowId
                  ? "Generate workflow improvements"
                  : "Workflow not loaded"
              }
            >
              {isGenerating || isBuildingPrompt
                ? "Generating…"
                : "Generate improvements"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Uses the current job artifacts and step outputs as context.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {extractedSteps.length > 0 && (
            <SectionCard
              title={`Execution steps summary (${extractedSteps.length})`}
              description="Snapshot of current step instructions."
              padding="sm"
              actions={
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowStepSummary(!showStepSummary)}
                  >
                    {showStepSummary ? "Hide" : "Show"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCopyStepSummary}
                  >
                    <ClipboardDocumentIcon className="h-4 w-4" />
                    Copy JSON
                  </Button>
                </div>
              }
            >
              {showStepSummary ? (
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
                      {extractedSteps.map((step, idx) => (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
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
                  Summary collapsed.
                </div>
              )}
            </SectionCard>
          )}

          <SectionCard
            title={`Improvements history (${improvements.length})`}
            description="Saved AI suggestions ready for review."
            padding="sm"
          >
            {improvementsLoading ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                Loading improvements…
              </div>
            ) : improvements.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                No improvements yet. Generate one to start a review queue.
              </div>
            ) : (
              <div className="space-y-2">
                {improvements.map((improvement) => {
                  const isSelected =
                    improvement.job_id === selectedImprovementId;
                  const statusMeta =
                    IMPROVEMENT_STATUS_STYLES[
                      improvement.improvement_status || "pending"
                    ];
                  const summary =
                    improvement.result?.changes_summary || "AI improvement";
                  const prompt = improvement.user_prompt?.trim();
                  const subtitle = [
                    formatRelativeTime(improvement.created_at),
                    prompt ? `Prompt: ${truncate(prompt, 80)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" • ");

                  return (
                    <button
                      key={improvement.job_id}
                      type="button"
                      onClick={() =>
                        setSelectedImprovementId(improvement.job_id)
                      }
                      className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                        isSelected
                          ? "border-primary/40 bg-primary/5"
                          : "border-border bg-background hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p
                            className="text-sm font-semibold text-foreground truncate"
                            title={summary}
                          >
                            {summary}
                          </p>
                          <p
                            className="mt-1 text-xs text-muted-foreground truncate"
                            title={subtitle}
                          >
                            {subtitle}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusMeta.badge}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {selectedImprovement?.result ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-foreground">
                  Selected improvement
                </h4>
                {selectedStatusMeta ? (
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${selectedStatusMeta.chip}`}
                  >
                    {selectedStatusMeta.label}
                  </span>
                ) : null}
              </div>

              <WorkflowDiffPreview
                currentWorkflow={currentWorkflowForDiff}
                proposal={selectedImprovement.result}
                onAccept={handleApply}
                onReject={handleReject}
                isApplying={isApplying}
                showActions={isPendingReview}
                acceptLabel="Approve & apply"
                rejectLabel={isReviewing ? "Denying..." : "Deny"}
                actionsDisabled={isReviewing}
              />

              {!isPendingReview &&
              selectedImprovement.reviewed_at &&
              selectedStatusMeta ? (
                <p className="text-xs text-muted-foreground">
                  {selectedStatusMeta.label}{" "}
                  {formatRelativeTime(selectedImprovement.reviewed_at)}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}
