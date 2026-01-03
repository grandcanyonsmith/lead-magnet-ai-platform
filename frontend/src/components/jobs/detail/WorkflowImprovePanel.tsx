"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SparklesIcon, ChevronDownIcon, ChevronUpIcon, ClipboardDocumentIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";

import { api } from "@/lib/api";
import { useWorkflowAI } from "@/hooks/useWorkflowAI";
import { WorkflowDiffPreview } from "@/components/workflows/edit/WorkflowDiffPreview";

import type { Artifact } from "@/types/artifact";
import type { Job, MergedStep } from "@/types/job";
import type { Workflow } from "@/types/workflow";

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
}: WorkflowImprovePanelProps) {
  const router = useRouter();
  const workflowId = workflow?.workflow_id || "";

  const [notes, setNotes] = useState("");
  const [isBuildingPrompt, setIsBuildingPrompt] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [showStepSummary, setShowStepSummary] = useState(false);

  const { generateWorkflowEdit, clearProposal, isGenerating, error, proposal } =
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

  const handleGenerate = async () => {
    if (!workflow || !workflow.workflow_id) {
      toast.error("Workflow not loaded for this job");
      return;
    }

    setIsBuildingPrompt(true);
    try {
      // We pass the job ID so the backend can fetch the full context (artifacts, steps, etc.)
      // securely and without size limits.
      await generateWorkflowEdit(notes, job.job_id);
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
    if (!workflow || !proposal) return;
    setIsApplying(true);
    try {
      await api.updateWorkflow(workflow.workflow_id, {
        ...(proposal.workflow_name
          ? { workflow_name: proposal.workflow_name }
          : {}),
        ...(proposal.workflow_description !== undefined
          ? { workflow_description: proposal.workflow_description }
          : {}),
        steps: proposal.steps,
      });
      toast.success("Workflow updated. Rerun a job to see improved output.");
      clearProposal();
      router.refresh();
    } catch (err: any) {
      console.error("[WorkflowImprovePanel] Failed to apply improvements", err);
      toast.error(err?.message || "Failed to apply improvements");
    } finally {
      setIsApplying(false);
    }
  };

  const handleReject = () => {
    clearProposal();
    toast("AI proposal dismissed", { icon: "✕" });
  };

  const extractedSteps = useMemo(() => {
    return mergedSteps.map((step) => {
      const input = step.input || {};
      const instructions = step.instructions || input.instructions || "N/A";
      const description = input.description || "N/A";
      const model = step.model || input.model || "N/A";
      const tools = step.tools || input.tools || [];
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
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-100 dark:ring-indigo-900/30">
              <SparklesIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Review & improve workflow steps
              </h3>
              <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                AI will review the final deliverable, artifacts, and execution
                results, then propose better step instructions/models/tools for
                future runs.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          title={
            workflowId
              ? "Generate workflow improvements"
              : "Workflow not loaded"
          }
        >
          {isGenerating || isBuildingPrompt
            ? "Generating…"
            : "Generate improvements"}
        </button>
      </div>

      <div className="mt-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          What should be better next time? (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="E.g. better structure, more concise, stronger CTA, avoid hallucinating facts, more on-brand voice…"
          rows={3}
          className="mt-2 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      </div>

      {extractedSteps.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowStepSummary(!showStepSummary)}
            className="flex w-full items-center justify-between rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <span>Execution Steps Summary ({extractedSteps.length} steps)</span>
            {showStepSummary ? (
              <ChevronUpIcon className="h-5 w-5" />
            ) : (
              <ChevronDownIcon className="h-5 w-5" />
            )}
          </button>

          {showStepSummary && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleCopyStepSummary}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <ClipboardDocumentIcon className="h-4 w-4" />
                  Copy JSON
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Order
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Step Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Instructions
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Description
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Model
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Tools
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                    {extractedSteps.map((step, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          {step.step_order}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {step.step_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 max-w-md">
                          <div className="truncate" title={step.instructions}>
                            {step.instructions}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {step.description}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {step.model}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {step.tools}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {proposal ? (
        <div className="mt-5">
          <WorkflowDiffPreview
            currentWorkflow={currentWorkflowForDiff}
            proposal={proposal}
            onAccept={handleApply}
            onReject={handleReject}
            isApplying={isApplying}
          />
        </div>
      ) : null}
    </div>
  );
}
