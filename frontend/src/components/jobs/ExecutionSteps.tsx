"use client";

import { useMemo } from "react";
import type { JobLiveStep, MergedStep } from "@/types/job";
import { getStepStatus } from "./utils";
import { Artifact } from "@/types/artifact";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExecutionStepCard } from "@/components/jobs/detail/ExecutionStepCard";

interface ExecutionStepsProps {
  jobId?: string;
  steps: MergedStep[];
  onCopy: (text: string) => void;
  jobStatus?: string;
  liveStep?: JobLiveStep | null;
  onEditStep?: (stepIndex: number) => void;
  canEdit?: boolean;
  imageArtifactsByStep?: Map<number, Artifact[]>;
  fileArtifactsByStep?: Map<number, Artifact[]>;
  loadingImageArtifacts?: boolean;
}

export function ExecutionSteps({
  jobId,
  steps,
  onCopy,
  jobStatus,
  liveStep,
  onEditStep,
  canEdit = false,
  imageArtifactsByStep = new Map(),
  fileArtifactsByStep = new Map(),
  loadingImageArtifacts = false,
}: ExecutionStepsProps) {
  const sortedSteps = useMemo(() => {
    if (!steps || steps.length === 0) return [];
    return [...steps].sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0));
  }, [steps]);

  const stepsForTimeline = useMemo(
    () => sortedSteps.filter((step) => step.step_type !== "form_submission"),
    [sortedSteps],
  );

  const getStepStatusForStep = (step: MergedStep) =>
    getStepStatus(step, sortedSteps, jobStatus);

  if (!steps || steps.length === 0) {
    const emptyStatusCopy =
      jobStatus === "failed"
        ? "This run ended before any execution steps were recorded."
        : jobStatus === "processing"
          ? "Execution steps are still loading. Check back in a moment."
          : "Steps will appear once the workflow starts running.";

    return (
      <EmptyState
        title="No execution steps available"
        message={emptyStatusCopy}
        className="py-10"
      />
    );
  }

  return (
    <div className="space-y-3">
      {stepsForTimeline.map((step) => {
        const stepOrder = step.step_order ?? 0;
        return (
          <ExecutionStepCard
            key={stepOrder}
            step={step}
            status={getStepStatusForStep(step)}
            jobId={jobId}
            jobStatus={jobStatus}
            liveStep={liveStep}
            onCopy={onCopy}
            imageArtifacts={imageArtifactsByStep.get(stepOrder)}
            fileArtifacts={fileArtifactsByStep.get(stepOrder)}
            loadingImageArtifacts={loadingImageArtifacts}
            onEditStep={onEditStep}
            canEdit={canEdit}
          />
        );
      })}
    </div>
  );
}
