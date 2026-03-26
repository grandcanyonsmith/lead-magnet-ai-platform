import { ExecutionSteps } from "@/components/jobs/ExecutionSteps";
import { ExecutionConfigCard } from "@/components/jobs/detail/ExecutionConfigCard";
import { SubmissionSummary } from "@/components/jobs/detail/SubmissionSummary";
import { ErrorState } from "@/components/ui/ErrorState";
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

      {(showSubmission || hasSteps) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {showSubmission && submission && (
            <SubmissionSummary submission={submission} />
          )}
          {hasSteps && <ExecutionConfigCard steps={mergedSteps} />}
        </div>
      )}

      <ExecutionSteps
        jobId={job.job_id}
        steps={mergedSteps}
        onCopy={onCopy}
        jobStatus={job.status}
        liveStep={job.live_step}
        onEditStep={onEditStep}
        canEdit={true}
        imageArtifactsByStep={imageArtifactsByStep}
        fileArtifactsByStep={fileArtifactsByStep}
        loadingImageArtifacts={loadingArtifacts}
      />
    </div>
  );
}
