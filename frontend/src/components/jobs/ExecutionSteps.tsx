"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
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
import { formatLiveOutputText } from "@/utils/jobFormatting";
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
              const stepImageFiles =
                variant === "expanded" && isExpanded
                  ? getStepImageFiles(step, stepImageArtifacts)
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
