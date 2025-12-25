"use client";

import { useMemo } from "react";
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
import { getStepStatus, getPreviousSteps, getFormSubmission } from "./utils";
import { Artifact } from "@/types/artifact";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { SubmissionSummary } from "@/components/jobs/detail/SubmissionSummary";
import type { FormSubmission } from "@/types/form";

interface ExecutionStepsProps {
  steps: MergedStep[];
  expandedSteps: Set<number>;
  showExecutionSteps: boolean;
  onToggleShow: () => void;
  onToggleStep: (stepOrder: number) => void;
  onCopy: (text: string) => void;
  jobStatus?: string;
  submission?: FormSubmission | null;
  onResubmit?: () => void;
  resubmitting?: boolean;
  onRerunStep?: (stepIndex: number) => Promise<void>;
  rerunningStep?: number | null;
  onEditStep?: (stepIndex: number) => void;
  canEdit?: boolean;
  imageArtifactsByStep?: Map<number, Artifact[]>;
  loadingImageArtifacts?: boolean;
  onRerunStepClick?: (stepIndex: number) => void;
}

export function ExecutionSteps({
  steps,
  expandedSteps,
  showExecutionSteps,
  onToggleShow,
  onToggleStep,
  onCopy,
  jobStatus,
  submission,
  onResubmit,
  resubmitting,
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

  // Compute form submission once (must be before early return)
  const formSubmission = useMemo(
    () => submission?.form_data ?? getFormSubmission(sortedSteps),
    [submission?.form_data, sortedSteps],
  );

  const stepsForTimeline = useMemo(
    () => sortedSteps.filter((step) => step.step_type !== "form_submission"),
    [sortedSteps],
  );

  // Helper function for step status (not memoized - simple computation)
  const getStepStatusForStep = (step: MergedStep) => {
    return getStepStatus(step, sortedSteps, jobStatus);
  };

  if (!steps || steps.length === 0) {
    return null;
  }

  return (
    <ErrorBoundary>
      <div className="mt-4 sm:mt-6 bg-white rounded-2xl border border-gray-300 shadow p-4 sm:p-6 ring-1 ring-black/[0.04]">
        <button
          onClick={onToggleShow}
          className="flex items-center justify-between w-full text-left mb-6 touch-target min-h-[48px] sm:min-h-0 group"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
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
          <div className="relative pl-4 sm:pl-6 space-y-0">
            {/* Vertical timeline line */}
            <div className="absolute left-4 sm:left-6 top-4 bottom-4 w-px bg-gray-200" />

            {submission?.form_data &&
              onResubmit &&
              typeof resubmitting === "boolean" && (
                <div key="form-submission" className="relative pb-8">
                  <div className="absolute left-[-5px] top-6 h-2.5 w-2.5 rounded-full ring-4 ring-white bg-green-500" />
                  <div className="ml-6">
                    <SubmissionSummary
                      submission={submission}
                      onResubmit={onResubmit}
                      resubmitting={resubmitting}
                      className="mb-0"
                    />
                  </div>
                </div>
              )}

            {stepsForTimeline.map((step, index) => {
              const stepOrder = step.step_order ?? 0;
              const isExpanded = expandedSteps.has(stepOrder);
              const stepStatus = getStepStatusForStep(step);
              const isLast = index === stepsForTimeline.length - 1;

              return (
                <div key={stepOrder} className="relative pb-8 last:pb-0">
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-[-5px] top-6 h-2.5 w-2.5 rounded-full ring-4 ring-white ${
                      stepStatus === "completed"
                        ? "bg-green-500"
                        : stepStatus === "in_progress"
                          ? "bg-blue-500 animate-pulse"
                          : stepStatus === "failed"
                            ? "bg-red-500"
                            : "bg-gray-300"
                    }`}
                  />

                  <div className="ml-6 rounded-xl border border-gray-300 bg-white shadow transition-all hover:shadow-md hover:border-gray-400">
                    <StepHeader
                      step={step}
                      status={stepStatus}
                      jobStatus={jobStatus}
                      canEdit={canEdit}
                      rerunningStep={rerunningStep}
                      onEditStep={onEditStep}
                      onRerunStep={onRerunStep}
                      onRerunStepClick={onRerunStepClick}
                    />

                    <Disclosure defaultOpen={isExpanded}>
                      {({ open }) => (
                        <>
                          <DisclosureButton
                            className="w-full flex justify-center py-2 border-t border-gray-100 hover:bg-gray-50 transition-colors text-xs font-medium text-gray-500"
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
                              <div className="border-t border-gray-200 bg-gray-50">
                                <StepInputOutput
                                  step={step}
                                  status={stepStatus}
                                  onCopy={onCopy}
                                  previousSteps={getPreviousSteps(
                                    step,
                                    sortedSteps,
                                  )}
                                  formSubmission={formSubmission}
                                  imageArtifacts={
                                    imageArtifactsByStep.get(stepOrder) || []
                                  }
                                  loadingImageArtifacts={loadingImageArtifacts}
                                  onEditStep={onEditStep}
                                  canEdit={canEdit}
                                />

                                {/* Show generated files/images in preview with deduplication */}
                                {(() => {
                                  const stepImageUrls =
                                    step.image_urls &&
                                    Array.isArray(step.image_urls) &&
                                    step.image_urls.length > 0
                                      ? step.image_urls
                                      : [];
                                  const stepImageArtifacts =
                                    imageArtifactsByStep.get(stepOrder) || [];
                                  const mainArtifactId = step.artifact_id;

                                  // Helper to extract filename from URL
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
                                      // If URL parsing fails, try to extract from string
                                      const parts = url.split("/");
                                      return parts[parts.length - 1] || url;
                                    }
                                  };

                                  // Helper to normalize filename for comparison (remove query params, etc.)
                                  const normalizeFilename = (
                                    filename: string,
                                  ): string => {
                                    return filename.split("?")[0].toLowerCase();
                                  };

                                  // Get main artifact filename if it exists (we'll fetch it if needed)
                                  // For now, we'll use a simpler approach: collect all unique files
                                  const displayedFiles = new Set<string>();
                                  const filesToShow: Array<{
                                    type:
                                      | "artifact"
                                      | "imageArtifact"
                                      | "imageUrl";
                                    data: any;
                                    key: string;
                                  }> = [];

                                  // Priority 1: Main artifact (step.artifact_id) - shown in Output section, skip here to avoid duplicates
                                  if (mainArtifactId) {
                                    displayedFiles.add(
                                      `artifact:${mainArtifactId}`,
                                    );
                                  }

                                  // Priority 2: Image artifacts (from imageArtifacts hook)
                                  stepImageArtifacts.forEach(
                                    (artifact: Artifact) => {
                                      const artifactId = artifact.artifact_id;
                                      const fileName =
                                        artifact.file_name ||
                                        artifact.artifact_name ||
                                        "";
                                      const normalizedName =
                                        normalizeFilename(fileName);

                                      // Skip if this is the main artifact
                                      if (artifactId === mainArtifactId) {
                                        return;
                                      }

                                      // Skip if we've already seen this filename from another source
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

                                  // Priority 3: Image URLs (from step.image_urls)
                                  stepImageUrls.forEach(
                                    (imageUrl: string, idx: number) => {
                                      const filename =
                                        getFilenameFromUrl(imageUrl);
                                      const normalizedName =
                                        normalizeFilename(filename);

                                      // Skip if we've already seen this filename
                                      if (
                                        normalizedName &&
                                        displayedFiles.has(
                                          `filename:${normalizedName}`,
                                        )
                                      ) {
                                        return;
                                      }

                                      // Check if this URL matches any artifact we're already showing
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

                                  // Render unique files
                                  if (filesToShow.length > 0) {
                                    return (
                                      <div className="px-3 sm:px-4 pb-3 sm:pb-4 bg-gray-50">
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
