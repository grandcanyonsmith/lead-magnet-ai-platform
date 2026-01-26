import { useMemo, useState } from "react";
import { ExecutionSteps } from "@/components/jobs/ExecutionSteps";
import { ArtifactGallery } from "@/components/jobs/detail/ArtifactGallery";
import { ErrorState } from "@/components/ui/ErrorState";
import { SectionCard } from "@/components/ui/SectionCard";
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
  expandedSteps,
  onToggleStep,
  onExpandAllSteps,
  onCollapseAllSteps,
  onQuickUpdateStep,
  updatingStepIndex,
  executionStepsError,
  onRefresh,
  refreshing,
  onCopy,
  imageArtifactsByStep,
  fileArtifactsByStep,
  loadingArtifacts,
  submission,
  onResubmit,
  resubmitting,
  onEditStep,
  onRerunStepClick,
  rerunningStep,
  artifactGalleryItems,
  onPreview,
}: JobExecutionTabProps) {
  const canRetryExecution = Boolean(onRefresh) && !refreshing;
  const [viewMode, setViewMode] = useState<"compact" | "expanded">("compact");
  const timelineStepOrders = useMemo(
    () =>
      mergedSteps
        .filter((step) => step.step_type !== "form_submission")
        .map((step) => step.step_order)
        .filter((order): order is number => order !== undefined && order !== null),
    [mergedSteps],
  );

  const handleViewModeChange = (nextMode: "compact" | "expanded") => {
    setViewMode(nextMode);
    if (nextMode === "expanded") {
      onExpandAllSteps?.(timelineStepOrders);
    } else {
      onCollapseAllSteps?.();
    }
  };

  return (
    <div className="space-y-6">
      {executionStepsError && (
        <ErrorState
          title="Execution timeline unavailable"
          message={executionStepsError}
          onRetry={canRetryExecution ? onRefresh : undefined}
          retryLabel="Reload timeline"
          className="dark:bg-red-900/20 dark:border-red-800"
        />
      )}

      <ExecutionSteps
        jobId={job.job_id}
        variant={viewMode}
        steps={mergedSteps}
        expandedSteps={expandedSteps}
        onToggleStep={onToggleStep}
        onExpandAll={onExpandAllSteps}
        onCollapseAll={onCollapseAllSteps}
        onVariantChange={handleViewModeChange}
        onCopy={onCopy}
        jobStatus={job.status}
        liveStep={job.live_step}
        onEditStep={onEditStep}
        onQuickUpdateStep={onQuickUpdateStep}
        updatingStepIndex={updatingStepIndex}
        canEdit={true}
        imageArtifactsByStep={imageArtifactsByStep}
        fileArtifactsByStep={fileArtifactsByStep}
        loadingImageArtifacts={loadingArtifacts}
        onRerunStepClick={onRerunStepClick}
        rerunningStep={rerunningStep}
        submission={submission}
        onResubmit={onResubmit}
        resubmitting={resubmitting}
      />

      <SectionCard
        title="Outputs"
        description="Review the generated assets and reports."
        actions={
          artifactGalleryItems.length > 0 ? (
            <span className="text-xs font-semibold text-muted-foreground">
              {artifactGalleryItems.length} item
              {artifactGalleryItems.length === 1 ? "" : "s"}
            </span>
          ) : null
        }
      >
        <div id="job-tab-panel-artifacts" className="space-y-4">
          <ArtifactGallery
            items={artifactGalleryItems}
            loading={loadingArtifacts}
            onPreview={onPreview}
          />
        </div>
      </SectionCard>
    </div>
  );
}
