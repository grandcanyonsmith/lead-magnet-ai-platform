"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import { MergedStep } from "@/types/job";
import type { FormSubmission } from "@/types/form";
import { StepHeader } from "./StepHeader";
import { StepInputOutput } from "./StepInputOutput";
import { StepProgressBar } from "./StepProgressBar";
import { ImagePreview } from "./ImagePreview";
import { getStepStatus } from "./utils";
import { Artifact } from "@/types/artifact";
import { SubmissionSummary } from "@/components/jobs/detail/SubmissionSummary";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { JobLiveStep } from "@/types/job";

interface ExecutionStepsProps {
  jobId?: string;
  variant?: "compact" | "expanded";
  steps: MergedStep[];
  expandedSteps: Set<number>;
  onToggleStep: (stepOrder: number) => void;
  onCopy: (text: string) => void;
  jobStatus?: string;
  liveStep?: JobLiveStep | null;
  onRerunStep?: (stepIndex: number) => Promise<void>;
  rerunningStep?: number | null;
  onEditStep?: (stepIndex: number) => void;
  canEdit?: boolean;
  imageArtifactsByStep?: Map<number, Artifact[]>;
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
  onCopy,
  jobStatus,
  liveStep,
  onRerunStep,
  rerunningStep,
  onEditStep,
  canEdit = false,
  imageArtifactsByStep = new Map(),
  loadingImageArtifacts = false,
  onRerunStepClick,
  submission,
  onResubmit,
  resubmitting,
}: ExecutionStepsProps) {
  const liveOutputRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!liveOutputRef.current) return;
    liveOutputRef.current.scrollTop = liveOutputRef.current.scrollHeight;
  }, [liveStep?.output_text, liveStep?.updated_at]);

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
  const liveUpdatedAt = liveStep?.updated_at
    ? new Date(liveStep.updated_at).toLocaleTimeString([], {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  const liveOutputPanel = shouldShowLivePanel ? (
    <SectionCard
      title="Live execution log"
      description="Streaming output from the active step while the job runs."
      actions={
        liveStepHref ? (
          <Link
            href={liveStepHref}
            className="inline-flex items-center gap-2 text-xs font-semibold text-primary-600 hover:text-primary-700"
          >
            View step details
            <ChevronDownIcon className="h-3.5 w-3.5 rotate-[-90deg]" />
          </Link>
        ) : null
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {liveStepOrder !== undefined && (
          <span className="rounded-full border border-border/70 bg-muted/60 px-2 py-0.5 text-xs font-semibold text-foreground">
            Step {liveStepOrder}
          </span>
        )}
        <span className="font-medium text-foreground">{liveStepName}</span>
        {liveStepType && <span className="capitalize">{liveStepType}</span>}
        {liveStepStatus && (
          <span className="rounded-full border border-border/70 bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {liveStepStatus}
          </span>
        )}
        {liveStep?.truncated && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            Output truncated
          </span>
        )}
        {liveUpdatedAt && <span>Updated {liveUpdatedAt}</span>}
      </div>
      <div className="mt-3 rounded-lg border border-border/60 bg-muted/40">
        <div
          ref={liveOutputRef}
          className="max-h-64 overflow-y-auto p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap scrollbar-hide-until-hover"
          aria-live="polite"
        >
          {hasLiveOutput
            ? liveOutputText
            : jobStatus === "processing"
              ? "Waiting for live output..."
              : "No live output available for this job."}
        </div>
      </div>
      {liveStep?.error && (
        <p className="mt-3 text-xs text-red-600">{liveStep.error}</p>
      )}
    </SectionCard>
  ) : null;

  if (!steps || steps.length === 0) {
    const emptyStatusCopy =
      jobStatus === "failed"
        ? "This run ended before any execution steps were recorded."
        : jobStatus === "processing"
          ? "Execution steps are still loading. Check back in a moment."
          : "Steps will appear once the workflow starts running.";

    return (
      <div className="space-y-4">
        {liveOutputPanel}
        <SectionCard
          title="Execution timeline"
          description="Track step-by-step progress for this run."
          className="mt-4 sm:mt-6"
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
    <div className="space-y-4">
      {liveOutputPanel}
      <SectionCard
          title="Execution timeline"
          description="Track step-by-step progress and outputs."
          className="mt-4 sm:mt-6"
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
              <StepProgressBar
                steps={sortedSteps}
                jobStatus={jobStatus}
                getStepStatus={getStepStatusForStep}
              />
            </div>

            <div
              id="execution-steps-list"
              className="relative pl-4 sm:pl-6 space-y-0"
            >
              <div className="absolute left-4 sm:left-6 top-4 bottom-4 w-px bg-border/70" />

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

                const detailsHref =
                  jobId && step.step_order !== undefined
                    ? `/dashboard/jobs/${jobId}/steps/${step.step_order}`
                    : undefined;

                return (
                  <div key={stepOrder} className="relative pb-8 last:pb-0">
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
                        onEditStep={onEditStep}
                        onRerunStep={onRerunStep}
                        onRerunStepClick={onRerunStepClick}
                        detailsHref={detailsHref}
                      />
                      {variant === "compact" ? (
                        <div className="border-t border-border/60 px-4 pb-4 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          {step.step_type !== "workflow_step" && (
                            <span className="inline-flex items-center gap-2">
                              {step.step_type.replace(/_/g, " ")}
                            </span>
                          )}
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
                        <Disclosure defaultOpen={isExpanded}>
                          {({ open }) => (
                            <>
                              <DisclosureButton
                                className="w-full flex justify-center py-2 border-t border-border/60 hover:bg-muted/40 transition-colors text-xs font-medium text-muted-foreground"
                                onClick={() => onToggleStep(stepOrder)}
                              >
                                {open ? (
                                  <span className="flex items-center gap-1">
                                    Hide details{" "}
                                    <ChevronUpIcon className="w-3 h-3" />
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    Show details{" "}
                                    <ChevronDownIcon className="w-3 h-3" />
                                  </span>
                                )}
                              </DisclosureButton>
                              <DisclosurePanel static>
                                {open && (
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
                                      loadingImageArtifacts={loadingImageArtifacts}
                                      onEditStep={onEditStep}
                                      canEdit={canEdit}
                                      variant={variant}
                                    />

                                    {variant === "expanded" &&
                                      (() => {
                                        const stepImageUrls =
                                          step.image_urls &&
                                          Array.isArray(step.image_urls) &&
                                          step.image_urls.length > 0
                                            ? step.image_urls
                                            : [];
                                        const stepImageArtifacts =
                                          imageArtifactsByStep.get(stepOrder) || [];
                                        const mainArtifactId = step.artifact_id;

                                        const getFilenameFromUrl = (
                                          url: string,
                                        ): string => {
                                          try {
                                            const urlObj = new URL(url);
                                            const pathname = urlObj.pathname;
                                            const filename =
                                              pathname.split("/").pop() || "";
                                            return filename;
                                          } catch {
                                            const parts = url.split("/");
                                            return parts[parts.length - 1] || url;
                                          }
                                        };

                                        const normalizeFilename = (
                                          filename: string,
                                        ): string => {
                                          return filename.split("?")[0].toLowerCase();
                                        };

                                        const displayedFiles = new Set<string>();
                                        const filesToShow: Array<{
                                          type:
                                            | "artifact"
                                            | "imageArtifact"
                                            | "imageUrl";
                                          data: any;
                                          key: string;
                                        }> = [];

                                        if (mainArtifactId) {
                                          displayedFiles.add(`artifact:${mainArtifactId}`);
                                        }

                                        stepImageArtifacts.forEach(
                                          (artifact: Artifact) => {
                                            const artifactId = artifact.artifact_id;
                                            const fileName =
                                              artifact.file_name ||
                                              artifact.artifact_name ||
                                              "";
                                            const normalizedName =
                                              normalizeFilename(fileName);

                                            if (artifactId === mainArtifactId) {
                                              return;
                                            }

                                            if (
                                              normalizedName &&
                                              displayedFiles.has(
                                                `filename:${normalizedName}`,
                                              )
                                            ) {
                                              return;
                                            }

                                            displayedFiles.add(
                                              `filename:${normalizedName}`,
                                            );
                                            displayedFiles.add(`artifact:${artifactId}`);
                                            filesToShow.push({
                                              type: "imageArtifact",
                                              data: artifact,
                                              key: `image-artifact-${artifactId}`,
                                            });
                                          },
                                        );

                                        stepImageUrls.forEach(
                                          (imageUrl: string, idx: number) => {
                                            const filename =
                                              getFilenameFromUrl(imageUrl);
                                            const normalizedName =
                                              normalizeFilename(filename);

                                            if (
                                              normalizedName &&
                                              displayedFiles.has(
                                                `filename:${normalizedName}`,
                                              )
                                            ) {
                                              return;
                                            }

                                            const matchesExistingArtifact =
                                              stepImageArtifacts.some(
                                                (artifact: Artifact) => {
                                                  const artifactUrl =
                                                    artifact.object_url ||
                                                    artifact.public_url;
                                                  return (
                                                    artifactUrl === imageUrl ||
                                                    normalizeFilename(
                                                      artifact.file_name ||
                                                        artifact.artifact_name ||
                                                        "",
                                                    ) === normalizedName
                                                  );
                                                },
                                              );

                                            if (matchesExistingArtifact) {
                                              return;
                                            }

                                            displayedFiles.add(
                                              `filename:${normalizedName}`,
                                            );
                                            filesToShow.push({
                                              type: "imageUrl",
                                              data: imageUrl,
                                              key: `image-url-${idx}`,
                                            });
                                          },
                                        );

                                        if (filesToShow.length > 0) {
                                          return (
                                            <div className="px-3 sm:px-4 pb-3 sm:pb-4 bg-muted/20">
                                              {filesToShow.map((file) => {
                                                if (file.type === "imageArtifact") {
                                                  return (
                                                    <ImagePreview
                                                      key={file.key}
                                                      artifact={file.data}
                                                      imageIndex={0}
                                                      model={step.model}
                                                      tools={
                                                        step.input?.tools ||
                                                        step.tools
                                                      }
                                                      toolChoice={
                                                        step.input?.tool_choice ||
                                                        step.tool_choice
                                                      }
                                                    />
                                                  );
                                                } else if (file.type === "imageUrl") {
                                                  return (
                                                    <ImagePreview
                                                      key={file.key}
                                                      imageUrl={file.data}
                                                      imageIndex={0}
                                                      model={step.model}
                                                      tools={
                                                        step.input?.tools ||
                                                        step.tools
                                                      }
                                                      toolChoice={
                                                        step.input?.tool_choice ||
                                                        step.tool_choice
                                                      }
                                                    />
                                                  );
                                                }
                                                return null;
                                              })}
                                            </div>
                                          );
                                        }

                                        return null;
                                      })()}
                                  </div>
                                )}
                              </DisclosurePanel>
                            </>
                          )}
                        </Disclosure>
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
