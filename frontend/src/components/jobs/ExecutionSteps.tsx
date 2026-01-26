"use client";

import { useMemo } from "react";
import type { JobLiveStep, MergedStep } from "@/types/job";
import type { FormSubmission } from "@/types/form";
import type {
  AIModel,
  ImageGenerationSettings,
  ReasoningEffort,
  ServiceTier,
  Tool,
} from "@/types/workflow";
import { getStepStatus } from "./utils";
import { Artifact } from "@/types/artifact";
import { SubmissionSummary } from "@/components/jobs/detail/SubmissionSummary";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { parseLogs } from "@/utils/logParsing";
import { ExecutionStepsHeader } from "./ExecutionStepsHeader";
import { StepProgressBar } from "./StepProgressBar";
import { RecursiveStep } from "./RecursiveStep";

type StepQuickUpdate = {
  model?: AIModel | null;
  service_tier?: ServiceTier | null;
  reasoning_effort?: ReasoningEffort | null;
  image_generation?: ImageGenerationSettings;
  tools?: Tool[] | null;
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
        actions={
          <ExecutionStepsHeader
            variant={variant}
            onVariantChange={onVariantChange}
            onExpandAll={() => onExpandAll?.(timelineStepOrders)}
            onCollapseAll={onCollapseAll}
            hasTimelineSteps={hasTimelineSteps}
            timelineStepOrdersLength={timelineStepOrders.length}
            expandedStepsSize={expandedSteps.size}
          />
        }
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
              return (
                <RecursiveStep
                  key={stepOrder}
                  step={step}
                  jobId={jobId}
                  variant={variant}
                  isExpanded={expandedSteps.has(stepOrder)}
                  onToggle={() => onToggleStep(stepOrder)}
                  onCopy={onCopy}
                  jobStatus={jobStatus}
                  liveStep={liveStep}
                  onRerunStep={onRerunStep}
                  rerunningStep={rerunningStep}
                  onEditStep={onEditStep}
                  canEdit={canEdit}
                  onQuickUpdateStep={onQuickUpdateStep}
                  updatingStepIndex={updatingStepIndex}
                  imageArtifacts={imageArtifactsByStep.get(stepOrder)}
                  fileArtifacts={fileArtifactsByStep.get(stepOrder)}
                  loadingImageArtifacts={loadingImageArtifacts}
                  onRerunStepClick={onRerunStepClick}
                  allSteps={sortedSteps}
                  getStepStatus={getStepStatusForStep}
                />
              );
            })}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
