"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDownIcon, ChevronUpIcon, ClipboardDocumentIcon, ArrowsPointingOutIcon } from "@heroicons/react/24/outline";
import type { JobLiveStep, MergedStep } from "@/types/job";
import type { FormSubmission } from "@/types/form";
import type {
  AIModel,
  ImageGenerationSettings,
  ReasoningEffort,
  ServiceTier,
  Tool,
} from "@/types/workflow";
import { StepHeader } from "./StepHeader";
import { StepInputOutput } from "./StepInputOutput";
import { StepProgressBar } from "./StepProgressBar";
import { ImagePreview } from "./ImagePreview";
import { getStepStatus } from "./utils";
import { Artifact } from "@/types/artifact";
import { SubmissionSummary } from "@/components/jobs/detail/SubmissionSummary";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PreviewCard } from "@/components/artifacts/PreviewCard";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { formatLiveOutputText, formatStepOutput } from "@/utils/jobFormatting";
import { getStepInput } from "@/utils/stepInput";
import { Button } from "@/components/ui/Button";
import { parseLogs } from "@/utils/logParsing";
import { StreamViewerUI, type LogEntry } from "@/components/ui/StreamViewerUI";

type StepQuickUpdate = {
  model?: AIModel | null;
  service_tier?: ServiceTier | null;
  reasoning_effort?: ReasoningEffort | null;
  image_generation?: ImageGenerationSettings;
  tools?: Tool[] | null;
};

type StepImageFile =
  | { type: "imageArtifact"; data: Artifact; key: string }
  | { type: "imageUrl"; data: string; key: string };

const getFilenameFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split("/").pop() || "";
    return filename;
  } catch {
    const parts = url.split("/");
    return parts[parts.length - 1] || url;
  }
};

const normalizeFilename = (filename: string): string =>
  filename.split("?")[0].toLowerCase();

const getArtifactFileName = (artifact: Artifact): string =>
  artifact.file_name || artifact.artifact_name || "";

const artifactMatchesImageUrl = (artifact: Artifact, imageUrl: string): boolean => {
  const artifactUrl = artifact.object_url || artifact.public_url;
  if (artifactUrl === imageUrl) return true;
  const artifactName = normalizeFilename(getArtifactFileName(artifact));
  const imageName = normalizeFilename(getFilenameFromUrl(imageUrl));
  return artifactName === imageName;
};

const getStepImageFiles = (
  step: MergedStep,
  stepImageArtifacts: Artifact[],
): StepImageFile[] => {
  const stepImageUrls =
    step.image_urls && Array.isArray(step.image_urls) && step.image_urls.length > 0
      ? step.image_urls
      : [];
  const mainArtifactId = step.artifact_id;

  const displayedFiles = new Set<string>();
  const filesToShow: StepImageFile[] = [];

  if (mainArtifactId) {
    displayedFiles.add(`artifact:${mainArtifactId}`);
  }

  stepImageArtifacts.forEach((artifact) => {
    const artifactId = artifact.artifact_id;
    const normalizedName = normalizeFilename(getArtifactFileName(artifact));

    if (artifactId === mainArtifactId) {
      return;
    }

    if (normalizedName && displayedFiles.has(`filename:${normalizedName}`)) {
      return;
    }

    displayedFiles.add(`filename:${normalizedName}`);
    displayedFiles.add(`artifact:${artifactId}`);
    filesToShow.push({
      type: "imageArtifact",
      data: artifact,
      key: `image-artifact-${artifactId}`,
    });
  });

  stepImageUrls.forEach((imageUrl, idx) => {
    const normalizedName = normalizeFilename(getFilenameFromUrl(imageUrl));

    if (normalizedName && displayedFiles.has(`filename:${normalizedName}`)) {
      return;
    }

    const matchesExistingArtifact = stepImageArtifacts.some((artifact) =>
      artifactMatchesImageUrl(artifact, imageUrl),
    );

    if (matchesExistingArtifact) {
      return;
    }

    displayedFiles.add(`filename:${normalizedName}`);
    filesToShow.push({
      type: "imageUrl",
      data: imageUrl,
      key: `image-url-${idx}`,
    });
  });

  return filesToShow;
};

const formatLivePreviewText = (value: string, maxLength = 160): string => {
  if (!value) return "";
  const formatted = formatLiveOutputText(value);
  const singleLine = formatted.replace(/\s+/g, " ").trim();
  if (!singleLine) return "";
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, maxLength - 3)}...`;
};

const MAX_OUTPUT_PREVIEW_CHARS = 50000;

const stripHtmlPreview = (value: string): string =>
  value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildOutputPreviewText = (
  step: MergedStep,
): {
  text: string;
  typeLabel: string;
  type: "json" | "markdown" | "text" | "html";
} | null => {
  const formatted = formatStepOutput(step);
  let raw: string;
  if (typeof formatted.content === "string") {
    raw = formatted.content;
  } else if (formatted.content === null || formatted.content === undefined) {
    return null;
  } else {
    raw = JSON.stringify(formatted.content, null, 2);
  }

  if (!raw) return null;
  const normalized =
    formatted.type === "html"
      ? stripHtmlPreview(raw)
      : formatted.type === "markdown"
        ? raw
        : formatLiveOutputText(raw);
  const trimmed = normalized.trim();
  if (!trimmed) return null;
  const text =
    trimmed.length > MAX_OUTPUT_PREVIEW_CHARS
      ? `${trimmed.slice(0, MAX_OUTPUT_PREVIEW_CHARS)}…`
      : trimmed;
  const typeLabel = formatted.type.toUpperCase();
  return { text, typeLabel, type: formatted.type };
};

const JSON_MARKDOWN_SINGLE_KEYS = new Set([
  "markdown",
  "md",
  "content",
  "body",
  "text",
  "output",
  "result",
]);

const extractMarkdownFromJson = (text: string): string | null => {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      // Check for single field with markdown key
      const entries = Object.entries(parsed);
      if (entries.length === 1) {
        const [key, value] = entries[0] ?? [];
        const normalizedKey = String(key || "").toLowerCase();
        if (JSON_MARKDOWN_SINGLE_KEYS.has(normalizedKey) && typeof value === "string") {
          return value;
        }
      }
      // Check for nested markdown fields
      for (const [key, value] of entries) {
        const normalizedKey = String(key || "").toLowerCase();
        if (JSON_MARKDOWN_SINGLE_KEYS.has(normalizedKey) && typeof value === "string") {
          return value;
        }
        // Recursively check nested objects
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          const nested = extractMarkdownFromJson(JSON.stringify(value));
          if (nested) return nested;
        }
      }
    }
  } catch {
    // Not valid JSON or parsing failed
  }
  return null;
};

const CompactTextPreview = ({
  text,
  format,
  onCopy,
  onExpand,
}: {
  text: string;
  format?: "json" | "markdown" | "text" | "html";
  onCopy?: () => void;
  onExpand?: () => void;
}) => {
  // Try to extract markdown from JSON if format is json
  const markdownContent = useMemo(() => {
    if (format === "json") {
      const extracted = extractMarkdownFromJson(text);
      if (extracted) return extracted;
    }
    if (format === "markdown") {
      return text;
    }
    return null;
  }, [text, format]);

  const shouldRenderMarkdown = markdownContent !== null;

  return (
    <div
      className="relative w-full h-full bg-gray-50 dark:bg-gray-900 p-2 group/preview"
      style={{ contain: "layout style paint", minHeight: 0 }}
    >
      <div className="h-full w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-md relative">
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover/preview:opacity-100 bg-white/90 dark:bg-gray-950/90 backdrop-blur-sm rounded-lg p-1 border border-gray-200 dark:border-gray-800 shadow-lg">
          {onCopy && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCopy();
              }}
              className="p-1.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Copy"
            >
              <ClipboardDocumentIcon className="w-3.5 h-3.5" />
            </button>
          )}
          {onExpand && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onExpand();
              }}
              className="p-1.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Expand details"
            >
              <ArrowsPointingOutIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="h-full overflow-y-auto p-3 text-[10px] leading-relaxed text-foreground scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800 hover:scrollbar-thumb-gray-300 dark:hover:scrollbar-thumb-gray-700">
          {shouldRenderMarkdown ? (
            <div className="prose prose-sm max-w-none dark:prose-invert text-[10px] leading-relaxed prose-p:my-2 prose-headings:my-3 prose-headings:font-bold prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-h2:text-base prose-h3:text-sm prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-pre:my-2 prose-table:w-full prose-table:border-collapse prose-th:border prose-th:border-gray-300 dark:prose-th:border-gray-700 prose-th:bg-gray-50 dark:prose-th:bg-gray-900 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:text-gray-900 dark:prose-th:text-gray-100 prose-td:border prose-td:border-gray-200 dark:prose-td:border-gray-800 prose-td:px-3 prose-td:py-2 prose-td:text-gray-700 dark:prose-td:text-gray-300 prose-code:bg-gray-100 dark:prose-code:bg-gray-900 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[9px] prose-code:font-mono prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-strong:font-semibold">
              <MarkdownRenderer
                value={markdownContent}
                fallbackClassName="whitespace-pre-wrap break-words"
              />
            </div>
          ) : (
            <div className="whitespace-pre-wrap break-words text-gray-700 dark:text-gray-300">
              {text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const formatLiveUpdatedAt = (value?: string | null): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

interface ExecutionStepsProps {
  jobId?: string;
  variant?: "compact" | "expanded";
  steps: MergedStep[];
  expandedSteps: Set<number>;
  onToggleStep: (stepOrder: number) => void;
  onExpandAll?: (stepOrders: number[]) => void;
  onCollapseAll?: () => void;
  onVariantChange?: (variant: "compact" | "expanded") => void;
  onCopy: (text: string) => void;
  jobStatus?: string;
  liveStep?: JobLiveStep | null;
  onRerunStep?: (stepIndex: number) => Promise<void>;
  rerunningStep?: number | null;
  onEditStep?: (stepIndex: number) => void;
  canEdit?: boolean;
  onQuickUpdateStep?: (stepIndex: number, update: StepQuickUpdate) => Promise<void>;
  updatingStepIndex?: number | null;
  imageArtifactsByStep?: Map<number, Artifact[]>;
  fileArtifactsByStep?: Map<number, Artifact[]>;
  loadingImageArtifacts?: boolean;
  onRerunStepClick?: (stepIndex: number) => void;
  submission?: FormSubmission | null;
  onResubmit?: () => void;
  resubmitting?: boolean;
}

export function ExecutionSteps({
  jobId,
  variant = "compact",
  steps,
  expandedSteps,
  onToggleStep,
  onExpandAll,
  onCollapseAll,
  onVariantChange,
  onCopy,
  jobStatus,
  liveStep,
  onRerunStep,
  rerunningStep,
  onEditStep,
  canEdit = false,
  onQuickUpdateStep,
  updatingStepIndex,
  imageArtifactsByStep = new Map(),
  fileArtifactsByStep = new Map(),
  loadingImageArtifacts = false,
  onRerunStepClick,
  submission,
  onResubmit,
  resubmitting,
}: ExecutionStepsProps) {

  // Sort steps by step_order once (must be before early return)
  const sortedSteps = useMemo(() => {
    if (!steps || steps.length === 0) {
      return [];
    }
    return [...steps].sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0));
  }, [steps]);

  const liveStepOrder = liveStep?.step_order;
  const liveStepMeta = useMemo(() => {
    if (liveStepOrder === undefined || liveStepOrder === null) return null;
    return (
      sortedSteps.find((step) => (step.step_order ?? 0) === liveStepOrder) ||
      null
    );
  }, [liveStepOrder, sortedSteps]);

  const stepsForTimeline = useMemo(
    () => sortedSteps.filter((step) => step.step_type !== "form_submission"),
    [sortedSteps],
  );
  const showSubmissionSummary =
    Boolean(submission) &&
    typeof onResubmit === "function" &&
    typeof resubmitting === "boolean";
  const hasTimelineSteps = stepsForTimeline.length > 0;
  const showTimelineLine = hasTimelineSteps || showSubmissionSummary;
  const timelineStepOrders = useMemo(
    () =>
      stepsForTimeline
        .map((step) => step.step_order)
        .filter((order): order is number => order !== undefined && order !== null),
    [stepsForTimeline],
  );

  // Helper function for step status (not memoized - simple computation)
  const getStepStatusForStep = (step: MergedStep) => {
    return getStepStatus(step, sortedSteps, jobStatus);
  };

  const liveOutputText =
    typeof liveStep?.output_text === "string" ? liveStep.output_text : "";
  const hasLiveOutput = liveOutputText.length > 0;
  const shouldShowLivePanel =
    jobStatus === "processing" ||
    hasLiveOutput ||
    Boolean(liveStep?.error) ||
    Boolean(liveStep?.status);

  const liveLogs = useMemo(() => {
    return parseLogs(liveOutputText);
  }, [liveOutputText]);

  const liveStepHref =
    jobId && liveStepOrder !== undefined
      ? `/dashboard/jobs/${jobId}/steps/${liveStepOrder}`
      : null;
  const liveStepName =
    liveStepMeta?.step_name ||
    (liveStepOrder !== undefined ? `Step ${liveStepOrder}` : "Live step");
  const liveStepType = liveStepMeta?.step_type
    ? liveStepMeta.step_type.replace(/_/g, " ")
    : null;
  const liveStepStatus = liveStep?.status
    ? liveStep.status.replace(/_/g, " ")
    : null;
  const liveUpdatedAt = formatLiveUpdatedAt(liveStep?.updated_at);


  const headerActions =
    (typeof onVariantChange === "function" ||
      (variant === "expanded" && (onExpandAll || onCollapseAll))) &&
    hasTimelineSteps ? (
      <div className="flex flex-wrap items-center gap-2">
        {typeof onVariantChange === "function" && (
          <div className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-muted/40 p-1 text-xs">
            <button
              type="button"
              onClick={() => onVariantChange("compact")}
              className={`rounded-md px-3 py-1 font-semibold transition-colors ${
                variant === "compact"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={variant === "compact"}
            >
              Compact
            </button>
            <button
              type="button"
              onClick={() => onVariantChange("expanded")}
              className={`rounded-md px-3 py-1 font-semibold transition-colors ${
                variant === "expanded"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={variant === "expanded"}
            >
              Expanded
            </button>
          </div>
        )}
        {variant === "expanded" && (
          <>
            {onExpandAll && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onExpandAll(timelineStepOrders)}
                disabled={timelineStepOrders.length === 0}
              >
                Expand all
              </Button>
            )}
            {onCollapseAll && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onCollapseAll()}
                disabled={expandedSteps.size === 0}
              >
                Collapse all
              </Button>
            )}
          </>
        )}
      </div>
    ) : null;

  if (!steps || steps.length === 0) {
    const emptyStatusCopy =
      jobStatus === "failed"
        ? "This run ended before any execution steps were recorded."
        : jobStatus === "processing"
          ? "Execution steps are still loading. Check back in a moment."
          : "Steps will appear once the workflow starts running.";

    return (
      <div className="space-y-3">
        {/* liveOutputPanel removed */}
        <SectionCard
          title="Execution timeline"
          description="Track step-by-step progress for this run."
          className="mt-2 sm:mt-3"
        >
          <EmptyState
            title="No execution steps available"
            message={emptyStatusCopy}
            className="py-10"
          />
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* liveOutputPanel removed */}
      <SectionCard
        title="Execution timeline"
        description="Track step-by-step progress and outputs."
        className="mt-2 sm:mt-3"
        actions={headerActions}
      >
        <div className="space-y-4">
          {hasTimelineSteps && (
            <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
              <StepProgressBar
                steps={sortedSteps}
                jobStatus={jobStatus}
                getStepStatus={getStepStatusForStep}
              />
            </div>
          )}

          <div
            id="execution-steps-list"
            className="relative pl-4 sm:pl-6 space-y-0"
          >
            {showTimelineLine && (
              <div className="absolute left-4 sm:left-6 top-4 bottom-4 w-px bg-border/70" />
            )}

            {showSubmissionSummary && submission && (
              <div className={`relative ${hasTimelineSteps ? "pb-8" : "pb-0"}`}>
                <div className="absolute left-[-5px] top-6 h-2.5 w-2.5 rounded-full ring-4 ring-background bg-green-500" />
                <div className="ml-6">
                  <SubmissionSummary
                    submission={submission}
                    onResubmit={onResubmit}
                    resubmitting={resubmitting}
                    className="mb-0 sm:mb-0"
                  />
                </div>
              </div>
            )}
            {stepsForTimeline.map((step) => {
              const stepOrder = step.step_order ?? 0;
              const isLiveStep = liveStep?.step_order === stepOrder;
              const isExpanded = expandedSteps.has(stepOrder);
              const stepStatus = getStepStatusForStep(step);
              const liveOutputForStep =
                liveStep && liveStep.step_order === stepOrder
                  ? liveStep.output_text
                  : undefined;
              const liveUpdatedAtForStep =
                liveStep && liveStep.step_order === stepOrder
                  ? liveStep.updated_at
                  : undefined;
              const liveUpdatedAtLabel = formatLiveUpdatedAt(liveUpdatedAtForStep);
              const livePreview =
                typeof liveOutputForStep === "string"
                  ? formatLivePreviewText(liveOutputForStep)
                  : "";
              const showLivePreview = Boolean(livePreview || liveUpdatedAtLabel);

              const detailsHref =
                jobId && step.step_order !== undefined
                  ? `/dashboard/jobs/${jobId}/steps/${step.step_order}`
                  : undefined;
              const stepInput = getStepInput(step.input);
              const stepTools = stepInput?.tools || step.tools;
              const stepToolChoice = stepInput?.tool_choice || step.tool_choice;
              const hasComputerUse =
                Array.isArray(stepTools) &&
                stepTools.some(
                  (tool: any) =>
                    (typeof tool === "string" && tool === "computer_use_preview") ||
                    (tool && typeof tool === "object" && tool.type === "computer_use_preview"),
                );
              const stepImageArtifacts = imageArtifactsByStep.get(stepOrder) || [];
              const stepFileArtifacts = fileArtifactsByStep.get(stepOrder) || [];
              const stepImageFiles =
                variant === "expanded" && isExpanded
                  ? getStepImageFiles(step, stepImageArtifacts)
                  : [];
              const inlineOutputPreview =
                variant === "compact" && stepStatus === "completed"
                  ? buildOutputPreviewText(step)
                  : null;
              const showInlineOutputs = Boolean(inlineOutputPreview);
              const inlineOutputCards = inlineOutputPreview
                ? [
                    <PreviewCard
                      key={`output-${stepOrder}`}
                      title="Output"
                      description={inlineOutputPreview.typeLabel}
                      showDescription
                      preview={
                        <CompactTextPreview
                          text={inlineOutputPreview.text}
                          format={inlineOutputPreview.type}
                          onCopy={() => onCopy(inlineOutputPreview.text)}
                          onExpand={() => onToggleStep(stepOrder)}
                        />
                      }
                      className="group flex w-full flex-col text-left"
                      previewClassName="aspect-[4/3] sm:aspect-[16/9]"
                    />,
                  ]
                : [];
              const imagePreviewProps = {
                imageIndex: 0,
                model: step.model,
                tools: stepTools,
                toolChoice: stepToolChoice,
              };

              return (
                <div
                  key={stepOrder}
                  id={`execution-step-${stepOrder}`}
                  className="relative pb-6 last:pb-0 scroll-mt-24"
                >
                  <div
                    className={`absolute left-[-5px] top-6 h-2.5 w-2.5 rounded-full ring-4 ring-background ${
                      stepStatus === "completed"
                        ? "bg-green-500"
                        : stepStatus === "in_progress"
                          ? "bg-blue-500 animate-pulse"
                          : stepStatus === "failed"
                            ? "bg-red-500"
                            : "bg-muted-foreground/40"
                    }`}
                  />

                  <div className="ml-6 rounded-xl border border-border bg-card shadow-sm transition-all hover:shadow-md">
                    <StepHeader
                      step={step}
                      status={stepStatus}
                      jobStatus={jobStatus}
                      canEdit={canEdit}
                      rerunningStep={rerunningStep}
                      allSteps={sortedSteps}
                      onEditStep={onEditStep}
                      onRerunStep={onRerunStep}
                      onRerunStepClick={onRerunStepClick}
                      onQuickUpdateStep={onQuickUpdateStep}
                      updatingStepIndex={updatingStepIndex}
                      detailsHref={detailsHref}
                    />
                    {isLiveStep && shouldShowLivePanel && (
                      <div className="border-t border-border/60">
                        <StreamViewerUI 
                          logs={liveLogs}
                          status={jobStatus === 'processing' ? 'streaming' : jobStatus === 'completed' ? 'completed' : jobStatus === 'failed' ? 'error' : 'pending'}
                          hasComputerUse={hasComputerUse}
                          className="h-[500px] border-0 rounded-none shadow-none"
                        />
                      </div>
                    )}
                    {showInlineOutputs && inlineOutputCards.length > 0 && (
                      <div className="border-t border-border/60 bg-muted/20 px-4 py-3">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {inlineOutputCards}
                        </div>
                      </div>
                    )}
                    {variant === "compact" ? (
                      <div className="border-t border-border/60 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          {step.step_type !== "workflow_step" && (
                            <span className="inline-flex items-center gap-2">
                              {step.step_type.replace(/_/g, " ")}
                            </span>
                          )}
                          {showLivePreview && (
                            <span className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
                              {liveUpdatedAtLabel && (
                                <span className="shrink-0">
                                  Updated {liveUpdatedAtLabel}
                                </span>
                              )}
                              {livePreview && (
                                <span
                                  className="min-w-0 truncate font-mono"
                                  title={livePreview}
                                >
                                  {livePreview}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        {detailsHref && (
                          <Link
                            href={detailsHref}
                            className="inline-flex items-center gap-2 font-semibold text-primary-600 hover:text-primary-700"
                          >
                            View details
                            <ChevronDownIcon className="h-3.5 w-3.5 rotate-[-90deg]" />
                          </Link>
                        )}
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="w-full flex justify-center py-2 border-t border-border/60 hover:bg-muted/40 transition-colors text-xs font-medium text-muted-foreground"
                          onClick={() => onToggleStep(stepOrder)}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? (
                            <span className="flex items-center gap-1">
                              Hide details <ChevronUpIcon className="w-3 h-3" />
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              Show details <ChevronDownIcon className="w-3 h-3" />
                            </span>
                          )}
                        </button>
                        {isExpanded && (
                          <div className="border-t border-border/60 bg-muted/30">
                            <StepInputOutput
                              step={step}
                              status={stepStatus}
                              onCopy={onCopy}
                              liveOutput={liveOutputForStep}
                              liveUpdatedAt={liveUpdatedAtForStep}
                              imageArtifacts={
                                imageArtifactsByStep.get(stepOrder) || []
                              }
                              fileArtifacts={
                                fileArtifactsByStep.get(stepOrder) || []
                              }
                              loadingImageArtifacts={loadingImageArtifacts}
                              onEditStep={onEditStep}
                              canEdit={canEdit}
                              variant={variant}
                            />

                            {stepImageFiles.length > 0 && (
                              <div className="px-3 sm:px-4 pb-3 sm:pb-4 bg-muted/20">
                                {stepImageFiles.map((file) =>
                                  file.type === "imageArtifact" ? (
                                    <ImagePreview
                                      key={file.key}
                                      artifact={file.data}
                                      {...imagePreviewProps}
                                    />
                                  ) : (
                                    <ImagePreview
                                      key={file.key}
                                      imageUrl={file.data}
                                      {...imagePreviewProps}
                                    />
                                  ),
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
