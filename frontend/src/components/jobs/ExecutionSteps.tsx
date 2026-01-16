"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import { MergedStep } from "@/types/job";
import { StepHeader } from "./StepHeader";
import { StepInputOutput } from "./StepInputOutput";
import { StepProgressBar } from "./StepProgressBar";
import { ImagePreview } from "./ImagePreview";
import { getStepStatus } from "./utils";
import { Artifact } from "@/types/artifact";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import type { JobLiveStep } from "@/types/job";

interface ExecutionStepsProps {
  jobId?: string;
  variant?: "compact" | "expanded";
  steps: MergedStep[];
  expandedSteps: Set<number>;
  showExecutionSteps: boolean;
  onToggleShow: () => void;
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
}

export function ExecutionSteps({
  jobId,
  variant = "compact",
  steps,
  expandedSteps,
  showExecutionSteps,
  onToggleShow,
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
}: ExecutionStepsProps) {
  // Sort steps by step_order once (must be before early return)
  const sortedSteps = useMemo(() => {
    if (!steps || steps.length === 0) {
      return [];
    }
    return [...steps].sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0));
  }, [steps]);

  const stepsForTimeline = useMemo(
    () => sortedSteps.filter((step) => step.step_type !== "form_submission"),
    [sortedSteps],
  );

  // Helper function for step status (not memoized - simple computation)
  const getStepStatusForStep = (step: MergedStep) => {
    return getStepStatus(step, sortedSteps, jobStatus);
  };

  if (!steps || steps.length === 0) {
    const emptyStatusCopy =
      jobStatus === "failed"
        ? "This run ended before any execution steps were recorded."
        : jobStatus === "processing"
          ? "Execution steps are still loading. Check back in a moment."
          : "Steps will appear once the workflow starts running.";

    return (
      <div
        id="job-execution-timeline"
        className="mt-4 sm:mt-6 bg-white dark:bg-card rounded-2xl border border-gray-300 dark:border-gray-700 shadow p-4 sm:p-6 ring-1 ring-black/[0.04] dark:ring-white/5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Execution Timeline
          </h2>
        </div>
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4 text-sm text-gray-600 dark:text-gray-300">
          <p className="font-medium text-gray-900 dark:text-gray-100">
            No execution steps available
          </p>
          <p className="mt-1">{emptyStatusCopy}</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div
        id="job-execution-timeline"
        className="mt-4 sm:mt-6 bg-white dark:bg-card rounded-2xl border border-gray-300 dark:border-gray-700 shadow p-4 sm:p-6 ring-1 ring-black/[0.04] dark:ring-white/5"
      >
        <button
          onClick={onToggleShow}
          aria-expanded={showExecutionSteps}
          aria-controls="execution-steps-list"
          className="flex items-center justify-between w-full text-left mb-6 touch-target min-h-[48px] sm:min-h-0 group"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
              Execution Timeline
            </h2>
            <div className="hidden sm:block flex-1 max-w-md">
              <StepProgressBar
                steps={sortedSteps}
                jobStatus={jobStatus}
                getStepStatus={getStepStatusForStep}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="sm:hidden w-24">
              <StepProgressBar
                steps={sortedSteps}
                jobStatus={jobStatus}
                getStepStatus={getStepStatusForStep}
              />
            </div>
            {showExecutionSteps ? (
              <ChevronUpIcon className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors flex-shrink-0" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors flex-shrink-0" />
            )}
          </div>
        </button>

        {showExecutionSteps && (
          <div
            id="execution-steps-list"
            className="relative pl-4 sm:pl-6 space-y-0"
          >
            {/* Vertical timeline line */}
            <div className="absolute left-4 sm:left-6 top-4 bottom-4 w-px bg-gray-200 dark:bg-gray-700" />

            {stepsForTimeline.map((step, index) => {
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
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-[-5px] top-6 h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-gray-900 ${
                      stepStatus === "completed"
                        ? "bg-green-500"
                        : stepStatus === "in_progress"
                          ? "bg-blue-500 animate-pulse"
                          : stepStatus === "failed"
                            ? "bg-red-500"
                            : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  />

                  <div className="ml-6 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-card shadow transition-all hover:shadow-md hover:border-gray-400 dark:hover:border-gray-600">
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
                      <div className="border-t border-gray-100 dark:border-gray-700 px-4 pb-4 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="inline-flex items-center gap-2">
                          {step.step_type.replace(/_/g, " ")}
                        </span>
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
                              className="w-full flex justify-center py-2 border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-xs font-medium text-gray-500 dark:text-gray-400"
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
                                <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                                  <StepInputOutput
                                    step={step}
                                    status={stepStatus}
                                    onCopy={onCopy}
                                    liveOutput={liveOutputForStep}
                                    liveUpdatedAt={liveUpdatedAtForStep}
                                    imageArtifacts={
                                      imageArtifactsByStep.get(stepOrder) || []
                                    }
                                    loadingImageArtifacts={
                                      loadingImageArtifacts
                                    }
                                    onEditStep={onEditStep}
                                    canEdit={canEdit}
                                    variant={variant}
                                  />

                                  {/* Show generated files/images in preview with deduplication */}
                                  {variant === "expanded" &&
                                    (() => {
                                      const stepImageUrls =
                                        step.image_urls &&
                                        Array.isArray(step.image_urls) &&
                                        step.image_urls.length > 0
                                          ? step.image_urls
                                          : [];
                                      const stepImageArtifacts =
                                        imageArtifactsByStep.get(stepOrder) ||
                                        [];
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
                                          return (
                                            parts[parts.length - 1] || url
                                          );
                                        }
                                      };

                                      const normalizeFilename = (
                                        filename: string,
                                      ): string => {
                                        return filename
                                          .split("?")[0]
                                          .toLowerCase();
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
                                        displayedFiles.add(
                                          `artifact:${mainArtifactId}`,
                                        );
                                      }

                                      stepImageArtifacts.forEach(
                                        (artifact: Artifact) => {
                                          const artifactId =
                                            artifact.artifact_id;
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
                                          displayedFiles.add(
                                            `artifact:${artifactId}`,
                                          );
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
                                          <div className="px-3 sm:px-4 pb-3 sm:pb-4 bg-gray-50">
                                            {filesToShow.map((file) => {
                                              if (
                                                file.type === "imageArtifact"
                                              ) {
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
                                              } else if (
                                                file.type === "imageUrl"
                                              ) {
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
        )}
      </div>
    </ErrorBoundary>
  );
}
