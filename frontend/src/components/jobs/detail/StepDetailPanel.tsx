"use client";

import { useState, useMemo } from "react";
import {
  FiCheckCircle,
  FiXCircle,
  FiLoader,
  FiClock,
  FiZap,
  FiGlobe,
} from "react-icons/fi";
import type { MergedStep, StepStatus } from "@/types/job";
import type { Artifact } from "@/types/artifact";
import { StepInput } from "@/components/jobs/steps/StepInput";
import { StepOutput } from "@/components/jobs/steps/StepOutput";
import { StepConfiguration } from "@/components/jobs/steps/StepConfiguration";
import { formatDurationMs } from "@/utils/jobFormatting";
import { getStepInput } from "@/utils/stepInput";

interface StepDetailPanelProps {
  step: MergedStep;
  status: StepStatus;
  onCopy: (text: string) => void;
  liveOutput?: string;
  liveUpdatedAt?: string;
  imageArtifacts?: Artifact[];
  fileArtifacts?: Artifact[];
  loadingImageArtifacts?: boolean;
  onEditStep?: (stepIndex: number) => void;
  canEdit?: boolean;
}

type DetailTab = "prompt" | "output";

const STATUS_META: Record<StepStatus, { icon: React.ReactNode; label: string; color: string }> = {
  completed: {
    icon: <FiCheckCircle className="h-4 w-4 text-green-500" />,
    label: "Completed",
    color: "text-green-600 dark:text-green-400",
  },
  failed: {
    icon: <FiXCircle className="h-4 w-4 text-red-500" />,
    label: "Failed",
    color: "text-red-600 dark:text-red-400",
  },
  in_progress: {
    icon: <FiLoader className="h-4 w-4 text-blue-500 animate-spin" />,
    label: "Running",
    color: "text-blue-600 dark:text-blue-400",
  },
  pending: {
    icon: <FiClock className="h-4 w-4 text-muted-foreground/50" />,
    label: "Pending",
    color: "text-muted-foreground",
  },
};

function extractStepTags(step: MergedStep) {
  const tags: { icon: React.ReactNode; label: string }[] = [];
  const input = getStepInput(step.input);
  const inputRecord = input as Record<string, unknown> | undefined;

  const reasoning = inputRecord?.reasoning_effort;
  if (reasoning) {
    const label =
      typeof reasoning === "string"
        ? reasoning.charAt(0).toUpperCase() + reasoning.slice(1)
        : String(reasoning);
    tags.push({ icon: <FiZap className="h-3 w-3" />, label: `Reasoning: ${label}` });
  }

  const tools = input?.tools ?? step.tools ?? [];
  const toolNames = new Set<string>();
  const friendlyNames: Record<string, string> = {
    web_search: "Web Search",
    web_search_preview: "Web Search",
    file_search: "File Search",
    code_interpreter: "Code Interpreter",
    computer_use_preview: "Computer Use",
    image_generation: "Image Generation",
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
    tags.push({ icon: <FiGlobe className="h-3 w-3" />, label: name });
  }

  return tags;
}

export function StepDetailPanel({
  step,
  status,
  onCopy,
  liveOutput,
  liveUpdatedAt,
  imageArtifacts = [],
  fileArtifacts = [],
  loadingImageArtifacts = false,
  onEditStep,
  canEdit = false,
}: StepDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("output");
  const isPending = status === "pending";

  const stepOrder = step.step_order ?? 0;
  const title = step.step_name || `Step ${stepOrder}`;
  const durationLabel =
    step.duration_ms !== undefined ? formatDurationMs(step.duration_ms) : null;
  const costValue = step.usage_info?.cost_usd;
  const costLabel =
    costValue !== undefined
      ? `$${(typeof costValue === "number" ? costValue : parseFloat(String(costValue) || "0")).toFixed(2)}`
      : null;
  const model = step.model || step.usage_info?.model;
  const tags = useMemo(() => extractStepTags(step), [step]);
  const statusMeta = STATUS_META[status];

  const tabs: { id: DetailTab; label: string }[] = isPending
    ? [{ id: "prompt", label: "Configuration" }]
    : [
        { id: "output", label: "Output" },
        { id: "prompt", label: "Prompt" },
      ];

  const effectiveTab = isPending ? "prompt" : activeTab;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 pb-4 border-b border-border">
        <div className="flex items-start gap-3">
          <div className="shrink-0 pt-0.5">{statusMeta.icon}</div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-foreground leading-tight">
              {title}
            </h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
              <span className={statusMeta.color}>{statusMeta.label}</span>
              {durationLabel && <span>{durationLabel}</span>}
              {costLabel && <span className="tabular-nums">{costLabel}</span>}
              {model && (
                <span className="font-mono text-[11px] bg-muted/60 px-1.5 py-0.5 rounded">
                  {model}
                </span>
              )}
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
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
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="shrink-0 flex gap-1 pt-3 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-3 py-1.5 text-sm font-medium rounded-md transition-colors
              ${effectiveTab === tab.id
                ? "bg-primary/10 text-primary dark:bg-primary/15"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto pt-2">
        {isPending && (
          <StepConfiguration
            step={step}
            canEdit={canEdit}
            onEditStep={onEditStep}
          />
        )}

        {!isPending && effectiveTab === "prompt" && (
          <StepInput
            step={step}
            canEdit={canEdit}
            onEditStep={onEditStep}
            onCopy={onCopy}
            contentHeightClass="max-h-[65vh] lg:max-h-none"
          />
        )}

        {!isPending && effectiveTab === "output" && (
          <StepOutput
            step={step}
            status={status}
            onCopy={onCopy}
            liveOutput={liveOutput}
            liveUpdatedAt={liveUpdatedAt}
            imageArtifacts={imageArtifacts}
            fileArtifacts={fileArtifacts}
            loadingImageArtifacts={loadingImageArtifacts}
            contentHeightClass="max-h-none"
            liveOutputHeightClass="max-h-96"
          />
        )}
      </div>
    </div>
  );
}
