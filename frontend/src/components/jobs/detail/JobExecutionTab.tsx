import { ExecutionSteps } from "@/components/jobs/ExecutionSteps";
import { ArtifactGallery } from "@/components/jobs/detail/ArtifactGallery";
import { ErrorState } from "@/components/ui/ErrorState";
import type { Artifact } from "@/types/artifact";
import type { FormSubmission } from "@/types/form";
import type { ArtifactGalleryItem, Job, MergedStep } from "@/types/job";

interface JobExecutionTabProps {
  job: Job;
  mergedSteps: MergedStep[];
  expandedSteps: Set<number>;
  showExecutionSteps: boolean;
  onToggleShowExecutionSteps: () => void;
  onToggleStep: (stepOrder: number) => void;
  executionStepsError: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  onCopy: (text: string) => void;
  imageArtifactsByStep: Map<number, Artifact[]>;
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
  showExecutionSteps,
  onToggleShowExecutionSteps,
  onToggleStep,
  executionStepsError,
  onRefresh,
  refreshing,
  onCopy,
  imageArtifactsByStep,
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

  return (
    <div className="space-y-8">
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
        variant="compact"
        steps={mergedSteps}
        expandedSteps={expandedSteps}
        showExecutionSteps={showExecutionSteps}
        onToggleShow={onToggleShowExecutionSteps}
        onToggleStep={onToggleStep}
        onCopy={onCopy}
        jobStatus={job.status}
        liveStep={job.live_step}
        onEditStep={onEditStep}
        canEdit={true}
        imageArtifactsByStep={imageArtifactsByStep}
        loadingImageArtifacts={loadingArtifacts}
        onRerunStepClick={onRerunStepClick}
        rerunningStep={rerunningStep}
        submission={submission}
        onResubmit={onResubmit}
        resubmitting={resubmitting}
      />

      <section id="job-tab-panel-artifacts" className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Outputs
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Review the generated assets and reports.
            </p>
          </div>
          {artifactGalleryItems.length > 0 && (
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              {artifactGalleryItems.length} item
              {artifactGalleryItems.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <ArtifactGallery
          items={artifactGalleryItems}
          loading={loadingArtifacts}
          onPreview={onPreview}
        />
      </section>
    </div>
  );
}
