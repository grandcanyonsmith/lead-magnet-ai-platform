"use client";

import { useState, useMemo } from "react";
import { ExecutionConfigCard } from "@/components/jobs/detail/ExecutionConfigCard";
import { SubmissionSummary } from "@/components/jobs/detail/SubmissionSummary";
import { ExecutionTimeline, ExecutionTimelineMobile } from "@/components/jobs/detail/ExecutionTimeline";
import { StepDetailPanel } from "@/components/jobs/detail/StepDetailPanel";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { getStepStatus } from "@/components/jobs/utils";
import type { Artifact } from "@/types/artifact";
import type { FormSubmission } from "@/types/form";
import type { ArtifactGalleryItem, Job, MergedStep } from "@/types/job";

interface JobExecutionTabProps {
  job: Job;
  mergedSteps: MergedStep[];
  expandedSteps: Set<number>;
  onToggleStep: (stepOrder: number) => void;
  onExpandAllSteps: (stepOrders: number[]) => void;
  onCollapseAllSteps: () => void;
  onQuickUpdateStep?: (stepIndex: number, update: {
    model?: import("@/types/workflow").AIModel | null;
    service_tier?: import("@/types/workflow").ServiceTier | null;
    reasoning_effort?: import("@/types/workflow").ReasoningEffort | null;
    image_generation?: import("@/types/workflow").ImageGenerationSettings;
    tools?: import("@/types/workflow").Tool[] | null;
  }) => Promise<void>;
  updatingStepIndex?: number | null;
  executionStepsError: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  onCopy: (text: string) => void;
  imageArtifactsByStep: Map<number, Artifact[]>;
  fileArtifactsByStep?: Map<number, Artifact[]>;
  loadingArtifacts: boolean;
  submission?: FormSubmission | null;
  onResubmit?: () => void;
  resubmitting?: boolean;
  onEditStep: (stepIndex: number) => void;
  onRerunStepClick: (stepIndex: number) => void;
  rerunningStep: number | null;
  artifactGalleryItems: ArtifactGalleryItem[];
  onPreview: (item: ArtifactGalleryItem) => void;
}

export function JobExecutionTab({
  job,
  mergedSteps,
  executionStepsError,
  onRefresh,
  refreshing,
  onCopy,
  imageArtifactsByStep,
  fileArtifactsByStep,
  loadingArtifacts,
  submission,
  onEditStep,
}: JobExecutionTabProps) {
  const canRetryExecution = Boolean(onRefresh) && !refreshing;
  const showSubmission = Boolean(submission);
  const hasSteps = mergedSteps.length > 0;

  const sortedSteps = useMemo(() => {
    if (!mergedSteps || mergedSteps.length === 0) return [];
    return [...mergedSteps].sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0));
  }, [mergedSteps]);

  const visibleSteps = useMemo(
    () => sortedSteps.filter((s) => s.step_type !== "form_submission"),
    [sortedSteps],
  );

  const defaultStep = useMemo(() => {
    const inProgress = visibleSteps.find(
      (s) => getStepStatus(s, sortedSteps, job.status) === "in_progress",
    );
    if (inProgress) return inProgress.step_order ?? 0;
    const lastCompleted = [...visibleSteps]
      .reverse()
      .find((s) => getStepStatus(s, sortedSteps, job.status) === "completed");
    if (lastCompleted) return lastCompleted.step_order ?? 0;
    return visibleSteps[0]?.step_order ?? 0;
  }, [visibleSteps, sortedSteps, job.status]);

  const [selectedStepOrder, setSelectedStepOrder] = useState<number>(defaultStep);

  const selectedStep = useMemo(
    () => visibleSteps.find((s) => (s.step_order ?? 0) === selectedStepOrder) ?? visibleSteps[0],
    [visibleSteps, selectedStepOrder],
  );

  const selectedStatus = selectedStep
    ? getStepStatus(selectedStep, sortedSteps, job.status)
    : "pending";

  const selectedLiveOutput =
    job.live_step && job.live_step.step_order === selectedStepOrder
      ? job.live_step.output_text
      : undefined;
  const selectedLiveUpdatedAt =
    job.live_step && job.live_step.step_order === selectedStepOrder
      ? job.live_step.updated_at
      : undefined;

  const emptyStatusCopy =
    job.status === "failed"
      ? "This run ended before any execution steps were recorded."
      : job.status === "processing"
        ? "Execution steps are still loading. Check back in a moment."
        : "Steps will appear once the workflow starts running.";

  return (
    <div className="space-y-5">
      {executionStepsError && (
        <ErrorState
          title="Execution timeline unavailable"
          message={executionStepsError}
          onRetry={canRetryExecution ? onRefresh : undefined}
          retryLabel="Reload timeline"
          className="dark:bg-red-900/20 dark:border-red-800"
        />
      )}

      {(showSubmission || hasSteps) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {showSubmission && submission && (
            <SubmissionSummary submission={submission} />
          )}
          {hasSteps && <ExecutionConfigCard steps={mergedSteps} />}
        </div>
      )}

      {!hasSteps && (
        <EmptyState
          title="No execution steps available"
          message={emptyStatusCopy}
          className="py-10"
        />
      )}

      {hasSteps && selectedStep && (
        <>
          {/* Mobile: horizontal pill strip */}
          <div className="lg:hidden">
            <ExecutionTimelineMobile
              steps={mergedSteps}
              selectedStepOrder={selectedStepOrder}
              onSelectStep={setSelectedStepOrder}
              jobStatus={job.status}
            />
            <div className="mt-4">
              <StepDetailPanel
                step={selectedStep}
                status={selectedStatus}
                onCopy={onCopy}
                liveOutput={selectedLiveOutput}
                liveUpdatedAt={selectedLiveUpdatedAt}
                imageArtifacts={imageArtifactsByStep.get(selectedStepOrder)}
                fileArtifacts={fileArtifactsByStep?.get(selectedStepOrder)}
                loadingImageArtifacts={loadingArtifacts}
                onEditStep={onEditStep}
                canEdit={true}
              />
            </div>
          </div>

          {/* Desktop: side-by-side panels */}
          <div className="hidden lg:flex gap-5 min-h-[55vh]">
            <div className="w-[280px] shrink-0 overflow-y-auto rounded-xl border border-border bg-card py-2 scrollbar-hide-until-hover">
              <ExecutionTimeline
                steps={mergedSteps}
                selectedStepOrder={selectedStepOrder}
                onSelectStep={setSelectedStepOrder}
                jobStatus={job.status}
              />
            </div>
            <div className="flex-1 min-w-0 overflow-y-auto rounded-xl border border-border bg-card p-5 scrollbar-hide-until-hover">
              <StepDetailPanel
                step={selectedStep}
                status={selectedStatus}
                onCopy={onCopy}
                liveOutput={selectedLiveOutput}
                liveUpdatedAt={selectedLiveUpdatedAt}
                imageArtifacts={imageArtifactsByStep.get(selectedStepOrder)}
                fileArtifacts={fileArtifactsByStep?.get(selectedStepOrder)}
                loadingImageArtifacts={loadingArtifacts}
                onEditStep={onEditStep}
                canEdit={true}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
