import { ExecutionSteps } from "@/components/jobs/ExecutionSteps";
import { ArtifactGallery } from "@/components/jobs/detail/ArtifactGallery";
import { JobLogsStream } from "@/components/jobs/JobLogsStream";
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

      {/* Live Log Streaming - Show when job is processing */}
      {job.status === "processing" && (
        <SectionCard
          title="Live Execution Logs"
          description="Real-time logs from shell executor commands"
        >
          <JobLogsStream
            jobId={job.job_id}
            enabled={job.status === "processing"}
          />
        </SectionCard>
      )}

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
