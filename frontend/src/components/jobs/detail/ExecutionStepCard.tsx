"use client";

import { useState, useMemo } from "react";
import {
  FiCheckCircle,
  FiXCircle,
  FiLoader,
  FiClock,
  FiChevronRight,
  FiZap,
  FiGlobe,
} from "react-icons/fi";
import type { MergedStep, StepStatus, JobLiveStep } from "@/types/job";
import type { Artifact } from "@/types/artifact";
import { StepInputOutput } from "@/components/jobs/StepInputOutput";
import { formatDurationMs } from "@/utils/jobFormatting";
import { getStepInput } from "@/utils/stepInput";

interface ExecutionStepCardProps {
  step: MergedStep;
  status: StepStatus;
  jobId?: string;
  jobStatus?: string;
  liveStep?: JobLiveStep | null;
  onCopy: (text: string) => void;
  imageArtifacts?: Artifact[];
  fileArtifacts?: Artifact[];
  loadingImageArtifacts?: boolean;
  onEditStep?: (stepIndex: number) => void;
  canEdit?: boolean;
}

const STATUS_ICONS: Record<StepStatus, React.ReactNode> = {
  completed: (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
      <FiCheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
    </span>
  ),
  failed: (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
      <FiXCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
    </span>
  ),
  in_progress: (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
      <FiLoader className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
    </span>
  ),
  pending: (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
      <FiClock className="h-5 w-5 text-gray-400" />
    </span>
  ),
};

const CARD_BG: Record<StepStatus, string> = {
  completed: "bg-green-50/50 dark:bg-green-950/10 border-green-200/60 dark:border-green-900/40",
  failed: "bg-red-50/50 dark:bg-red-950/10 border-red-200/60 dark:border-red-900/40",
  in_progress: "bg-blue-50/50 dark:bg-blue-950/10 border-blue-200/60 dark:border-blue-900/40",
  pending: "bg-card border-border",
};

function getStatusLine(status: StepStatus, durationLabel: string | null): string {
  if (status === "completed") return durationLabel ? `Completed in ${durationLabel}` : "Completed";
  if (status === "in_progress") return durationLabel ? `Running ${durationLabel}` : "Running...";
  if (status === "failed") return durationLabel ? `Failed after ${durationLabel}` : "Failed";
  return "Not started";
}

interface StepTag {
  icon: React.ReactNode;
  label: string;
}

function extractStepTags(step: MergedStep): StepTag[] {
  const tags: StepTag[] = [];
  const input = getStepInput(step.input);
  const inputRecord = input as Record<string, unknown> | undefined;

  const reasoning = inputRecord?.reasoning_effort;
  if (reasoning) {
    const label =
      typeof reasoning === "string"
        ? reasoning.charAt(0).toUpperCase() + reasoning.slice(1)
        : String(reasoning);
    tags.push({
      icon: <FiZap className="h-3 w-3" />,
      label: `Reasoning: ${label}`,
    });
  }

  const tools = input?.tools ?? step.tools ?? [];
  const toolNames = new Set<string>();
  const friendlyNames: Record<string, string> = {
    web_search: "web_search",
    web_search_preview: "web_search",
    file_search: "file_search",
    code_interpreter: "code_interpreter",
    computer_use_preview: "computer_use",
    image_generation: "image_generation",
  };
  for (const tool of tools) {
    const name =
      typeof tool === "string"
        ? tool
        : tool && typeof tool === "object" && "type" in tool
          ? String((tool as unknown as Record<string, unknown>).type)
          : null;
    if (name) toolNames.add(friendlyNames[name] ?? name);
  }
  for (const name of toolNames) {
    tags.push({
      icon: <FiGlobe className="h-3 w-3" />,
      label: name,
    });
  }

  return tags;
}

function getOutputPreview(output: unknown): string | null {
  if (!output) return null;
  let text: string;
  if (typeof output === "string") {
    text = output;
  } else {
    try {
      text = JSON.stringify(output);
    } catch {
      return null;
    }
  }
  text = text.replace(/^["']|["']$/g, "").replace(/\\n/g, " ").trim();
  if (text.length === 0) return null;
  return text.length > 240 ? text.slice(0, 240) + "\u2026" : text;
}

export function ExecutionStepCard({
  step,
  status,
  jobId,
  jobStatus,
  liveStep,
  onCopy,
  imageArtifacts = [],
  fileArtifacts = [],
  loadingImageArtifacts = false,
  onEditStep,
  canEdit = false,
}: ExecutionStepCardProps) {
  const [showWork, setShowWork] = useState(false);

  const stepOrder = step.step_order ?? 0;
  const title = step.step_name || `Step ${stepOrder}`;

  const durationLabel =
    step.duration_ms !== undefined ? formatDurationMs(step.duration_ms) : null;
  const costValue = step.usage_info?.cost_usd;
  const costLabel =
    costValue !== undefined
      ? `$${typeof costValue === "number" ? costValue.toFixed(2) : parseFloat(String(costValue) || "0").toFixed(2)}`
      : null;

  const statusLine = getStatusLine(status, durationLabel);
  const tags = useMemo(() => extractStepTags(step), [step]);
  const outputPreview =
    status === "completed" || status === "failed" || status === "in_progress"
      ? getOutputPreview(step.output)
      : null;

  const liveOutput =
    liveStep && liveStep.step_order === stepOrder
      ? liveStep.output_text
      : undefined;
  const liveUpdatedAt =
    liveStep && liveStep.step_order === stepOrder
      ? liveStep.updated_at
      : undefined;

  const cardBg = CARD_BG[status];

  return (
    <div
      id={`execution-step-${stepOrder}`}
      className={`rounded-xl border shadow-sm scroll-mt-24 ${cardBg}`}
    >
      <div className="flex gap-4 p-5">
        <div className="shrink-0">{STATUS_ICONS[status]}</div>

        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>

          <p className="mt-0.5 text-xs text-muted-foreground">
            {statusLine}
            {costLabel && (
              <>
                <span className="mx-1.5 text-muted-foreground/40">&middot;</span>
                <span className="tabular-nums">{costLabel}</span>
              </>
            )}
          </p>

          {tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  {tag.icon}
                  {tag.label}
                </span>
              ))}
            </div>
          )}

          {outputPreview && (
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground line-clamp-3">
              {outputPreview}
            </p>
          )}

          {(status === "completed" || status === "failed" || status === "in_progress") && (
            <button
              type="button"
              onClick={() => setShowWork((v) => !v)}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {showWork ? "Hide Work" : "Show Work"}
              <FiChevronRight
                className={`h-3 w-3 transition-transform ${showWork ? "rotate-90" : ""}`}
              />
            </button>
          )}
        </div>
      </div>

      {showWork && (
        <div className="border-t border-border/60">
          <StepInputOutput
            step={step}
            status={status}
            onCopy={onCopy}
            liveOutput={liveOutput}
            liveUpdatedAt={liveUpdatedAt}
            imageArtifacts={imageArtifacts}
            fileArtifacts={fileArtifacts}
            loadingImageArtifacts={loadingImageArtifacts}
            onEditStep={onEditStep}
            canEdit={canEdit}
            variant="expanded"
          />
        </div>
      )}
    </div>
  );
}
