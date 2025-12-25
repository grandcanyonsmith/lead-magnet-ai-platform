"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SparklesIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";

import { api } from "@/lib/api";
import { useWorkflowAI } from "@/hooks/useWorkflowAI";
import { WorkflowDiffPreview } from "@/components/workflows/edit/WorkflowDiffPreview";

import type { Artifact } from "@/types/artifact";
import type { Job, MergedStep } from "@/types/job";
import type { Workflow } from "@/types/workflow";

function truncate(text: string, maxChars: number): string {
  const raw = String(text || "");
  if (raw.length <= maxChars) return raw;
  return `${raw.slice(0, maxChars)}\n\n[TRUNCATED: ${raw.length - maxChars} chars omitted]`;
}

function toCompactText(value: unknown, maxChars: number): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return truncate(value, maxChars);
  try {
    return truncate(JSON.stringify(value, null, 2), maxChars);
  } catch {
    return truncate(String(value), maxChars);
  }
}

function stripInjectedBlocksForReview(html: string): string {
  return String(html || "")
    .replace(
      /<!--\s*Lead Magnet Editor Overlay\s*-->[\s\S]*?<\/script>\s*/gi,
      "",
    )
    .replace(
      /<!--\s*Lead Magnet Tracking Script\s*-->[\s\S]*?<\/script>\s*/gi,
      "",
    )
    .trim();
}

function buildWorkflowImprovementPrompt(args: {
  job: Job;
  workflow: Workflow;
  mergedSteps: MergedStep[];
  artifacts: Artifact[];
  finalDocument: string;
  notes: string;
}): string {
  const { job, workflow, mergedSteps, artifacts, finalDocument, notes } = args;

  const cleanedDoc = stripInjectedBlocksForReview(finalDocument);
  const finalDocSnippet = truncate(cleanedDoc, 20_000);

  const artifactsSorted = [...(artifacts || [])].sort((a, b) => {
    const at = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bt - at;
  });

  const artifactLines = artifactsSorted.slice(0, 35).map((a, idx) => {
    const name = a.file_name || a.artifact_name || a.artifact_id;
    const url = a.public_url || a.object_url;
    const type = a.artifact_type || a.content_type || "unknown";
    return `${idx + 1}. ${name} (type=${type})${url ? ` url=${url}` : ""}`;
  });

  const workflowSteps = workflow.steps || [];
  const stepLines = workflowSteps.slice(0, 12).map((step, idx) => {
    const exec = mergedSteps.find((s) => s.step_order === idx + 1);
    const tools =
      Array.isArray(step.tools) && step.tools.length > 0
        ? step.tools
            .map((t: any) => (typeof t === "string" ? t : t?.type || "unknown"))
            .join(", ")
        : "(none)";

    const outputExcerpt = toCompactText(exec?.output, 1_600);
    const errorExcerpt = exec?.error ? truncate(String(exec.error), 600) : "";

    const usage = exec?.usage_info;
    const usageLine =
      usage &&
      (usage.total_tokens ||
        usage.input_tokens ||
        usage.output_tokens ||
        usage.cost_usd)
        ? `usage: tokens=${usage.total_tokens ?? "n/a"} input=${usage.input_tokens ?? "n/a"} output=${usage.output_tokens ?? "n/a"} cost_usd=${usage.cost_usd ?? "n/a"}`
        : null;

    return [
      `Step ${idx + 1}: ${step.step_name} (model=${step.model}${
        step.reasoning_effort ? ` effort=${step.reasoning_effort}` : ""
      })`,
      step.step_description ? `Description: ${step.step_description}` : null,
      `Tools: ${tools} (tool_choice=${step.tool_choice || "auto"})`,
      step.depends_on && step.depends_on.length > 0
        ? `Depends on: ${step.depends_on.map((d) => d + 1).join(", ")}`
        : null,
      `Instructions:\n${truncate(step.instructions || "", 2_200)}`,
      exec
        ? `Run result: status=${exec._status} duration_ms=${exec.duration_ms ?? "n/a"} artifact_id=${
            exec.artifact_id ?? "n/a"
          } images=${exec.image_urls?.length ?? 0}`
        : "Run result: (no execution data found for this step)",
      usageLine,
      errorExcerpt ? `Error:\n${errorExcerpt}` : null,
      outputExcerpt ? `Output excerpt:\n${outputExcerpt}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  const nonWorkflowExecSteps = mergedSteps.filter(
    (s) => s.step_type !== "workflow_step",
  );
  const extraExecLines = nonWorkflowExecSteps.slice(0, 8).map((s) => {
    return `- step_order=${s.step_order} type=${s.step_type} name=${s.step_name || "(none)"} status=${s._status}`;
  });

  const artifactCount = artifacts?.length || 0;
  const stepCount = workflowSteps.length || 0;

  return `You are an expert workflow engineer for an AI-powered lead magnet generation platform.

Your task: improve the WORKFLOW STEPS so future runs produce higher-quality, more reliable lead magnets.

Constraints:
- Keep the lead magnet's intent the same.
- Do NOT change delivery behavior (webhook/sms) unless explicitly requested.
- Prefer improving existing steps over adding new steps. If you add/remove/reorder steps, explain why.
- Make step instructions explicit and deterministic: specify the exact output format, quality checks, and failure handling.
- Use only these models: gpt-5, gpt-5.1, gpt-5.2, gpt-4o, gpt-4o-mini, o4-mini-deep-research.
- Tools must be from: web_search, code_interpreter, computer_use_preview, image_generation, shell.

If you use gpt-5* models for steps that require deeper reasoning, set reasoning_effort to low/medium/high appropriately.

What to optimize for:
- Better final deliverable quality (clarity, structure, completeness, correctness, formatting)
- Fewer fragile steps and less drift
- Clearer intermediate outputs that downstream steps can reliably consume

Job context:
- job_id: ${job.job_id}
- job_status: ${job.status}
- workflow: ${workflow.workflow_name} (${workflow.workflow_id})
- step_count: ${stepCount}
- artifact_count: ${artifactCount}
${notes.trim() ? `\nAdditional improvement goals from the user:\n${notes.trim()}\n` : ""}

Artifacts (most recent first; list may be truncated):
${artifactLines.length ? artifactLines.join("\n") : "(none)"}
${artifactCount > artifactLines.length ? `\n[${artifactCount - artifactLines.length} more artifacts omitted]\n` : ""}

Final deliverable (cleaned; may be truncated):
${finalDocSnippet}

Execution steps observed (workflow steps; may be truncated):
${stepLines.length ? stepLines.join("\n\n---\n\n") : "(no workflow steps found)"}
${workflowSteps.length > stepLines.length ? `\n\n[${workflowSteps.length - stepLines.length} more steps omitted]\n` : ""}

Other execution steps (non-workflow; for context only):
${extraExecLines.length ? extraExecLines.join("\n") : "(none)"}

Now return a JSON object per the system schema with an improved steps array and a short changes_summary.`;
}

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
  const router = useRouter();
  const workflowId = workflow?.workflow_id || "";

  const [notes, setNotes] = useState("");
  const [isBuildingPrompt, setIsBuildingPrompt] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

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
      const finalDoc = await api.jobs.getJobDocument(job.job_id);
      const prompt = buildWorkflowImprovementPrompt({
        job,
        workflow,
        mergedSteps,
        artifacts,
        finalDocument: finalDoc,
        notes,
      });

      await generateWorkflowEdit(prompt);
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

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
              <SparklesIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900">
                Review & improve workflow steps
              </h3>
              <p className="mt-0.5 text-sm text-gray-600">
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
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
          What should be better next time? (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="E.g. better structure, more concise, stronger CTA, avoid hallucinating facts, more on-brand voice…"
          rows={3}
          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>

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
