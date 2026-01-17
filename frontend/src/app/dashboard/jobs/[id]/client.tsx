"use client";

import React, { useState, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import { useJobDetail } from "@/hooks/useJobDetail";
import { useJobExecutionSteps } from "@/hooks/useJobExecutionSteps";
import { useMergedSteps } from "@/hooks/useMergedSteps";
import { useImageArtifacts } from "@/hooks/useImageArtifacts";
import { usePreviewModal } from "@/hooks/usePreviewModal";

import { api } from "@/lib/api";
import { buildArtifactGalleryItems } from "@/utils/jobs/artifacts";
import { summarizeStepProgress } from "@/utils/jobs/steps";
import { formatRelativeTime, formatDuration } from "@/utils/date";

import { JobHeader } from "@/components/jobs/JobHeader";
import { ResubmitModal } from "@/components/jobs/ResubmitModal";
import { RerunStepDialog } from "@/components/jobs/RerunStepDialog";
import { FullScreenPreviewModal } from "@/components/ui/FullScreenPreviewModal";
import { JobDetailSkeleton } from "@/components/jobs/detail/JobDetailSkeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { JobExecutionTab } from "@/components/jobs/detail/JobExecutionTab";
import { JobSummaryTab } from "@/components/jobs/detail/JobSummaryTab";
import { JobImproveTab } from "@/components/jobs/detail/JobImproveTab";
import { JobTrackingTab } from "@/components/jobs/detail/JobTrackingTab";
import { JobTechnicalTab } from "@/components/jobs/detail/JobTechnicalTab";
import { JobDebugTab } from "@/components/jobs/detail/JobDebugTab";

import FlowchartSidePanel from "@/app/dashboard/workflows/components/FlowchartSidePanel";
import type { JobDurationInfo } from "@/components/jobs/detail/JobOverviewSection";

import type {
  ArtifactGalleryItem,
  Job,
  JobStepSummary,
  MergedStep,
} from "@/types/job";
import type { WorkflowStep } from "@/types";
import type { Workflow } from "@/types/workflow";
import type { Form, FormSubmission } from "@/types/form";
import type { Artifact } from "@/types/artifact";

const TAB_CONFIG = [
  { id: "execution", name: "Report Generation" },
  { id: "summary", name: "Job Summary" },
  { id: "improve", name: "Review & Improve" },
  { id: "tracking", name: "Lead Activity" },
  { id: "technical", name: "Technical Details" },
  { id: "raw", name: "Debug Data" },
] as const;

type JobTabId = (typeof TAB_CONFIG)[number]["id"];

const DEFAULT_TAB: JobTabId = "execution";

const isJobTabId = (value: string | null): value is JobTabId =>
  TAB_CONFIG.some((tab) => tab.id === value);

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function JobDetailClient() {
  const router = useRouter();

  const [showResubmitModal, setShowResubmitModal] = useState(false);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [showRerunDialog, setShowRerunDialog] = useState(false);
  const [trackingSessionCount, setTrackingSessionCount] = useState<number | null>(
    null,
  );
  const [trackingSessionsLoading, setTrackingSessionsLoading] = useState(false);
  const [stepIndexForRerun, setStepIndexForRerun] = useState<number | null>(
    null,
  );

  const latestStepUpdateRef = useRef<WorkflowStep | null>(null);

  const {
    job,
    workflow,
    form,
    submission,
    loading,
    error,
    resubmitting,
    handleResubmit,
    rerunningStep,
    handleRerunStep,
    executionStepsError,
    refreshJob,
    refreshing,
    lastLoadedAt,
  } = useJobDetail();

  const {
    showExecutionSteps,
    setShowExecutionSteps,
    expandedSteps,
    toggleStep,
  } = useJobExecutionSteps();

  const mergedSteps = useMergedSteps({ job, workflow });

  const {
    imageArtifactsByStep,
    artifacts: jobArtifacts,
    loading: loadingArtifacts,
  } = useImageArtifacts({
    jobId: job?.job_id,
    steps: mergedSteps,
  });

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const tabParam = searchParams.get("tab");
  const activeTab = isJobTabId(tabParam) ? tabParam : DEFAULT_TAB;

  const buildTabHref = (tabId: JobTabId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabId);
    return `${pathname}?${params.toString()}`;
  };

  const handleSelectExecutionTab = () => {
    router.push(buildTabHref("execution"));
  };

  const { previewItem, openPreview, closePreview } =
    usePreviewModal<ArtifactGalleryItem>();

  const artifactGalleryItems = useMemo(
    () =>
      buildArtifactGalleryItems({
        job,
        artifacts: jobArtifacts,
        steps: mergedSteps,
      }),
    [job, jobArtifacts, mergedSteps],
  );

  const stepsSummary = useMemo<JobStepSummary>(
    () => summarizeStepProgress(mergedSteps),
    [mergedSteps],
  );

  const totalCost = useMemo(() => {
    if (!job?.execution_steps || !Array.isArray(job.execution_steps)) {
      return null;
    }

    const aiSteps = job.execution_steps.filter(
      (step) =>
        step.step_type === "ai_generation" ||
        step.step_type === "workflow_step",
    );

    if (aiSteps.length === 0) {
      return null;
    }

    const sum = aiSteps.reduce((acc: number, step) => {
      const cost = step.usage_info?.cost_usd;
      if (cost === undefined || cost === null) {
        return acc;
      }
      if (typeof cost === "number") {
        return acc + cost;
      }
      if (typeof cost === "string") {
        const parsed = parseFloat(cost);
        return acc + (Number.isNaN(parsed) ? 0 : parsed);
      }
      return acc;
    }, 0);

    const hasCostData = aiSteps.some((step) => {
      const cost = step.usage_info?.cost_usd;
      if (cost === undefined || cost === null) return false;
      return typeof cost === "number" ? cost > 0 : parseFloat(String(cost)) > 0;
    });

    if (!hasCostData) {
      return null;
    }

    return sum;
  }, [job?.execution_steps]);

  const jobDuration = useMemo(() => getJobDuration(job), [job]);

  const lastUpdatedLabel = useMemo(
    () => (job?.updated_at ? formatRelativeTime(job.updated_at) : null),
    [job?.updated_at],
  );

  const lastRefreshedLabel = useMemo(
    () =>
      lastLoadedAt ? formatRelativeTime(lastLoadedAt.toISOString()) : null,
    [lastLoadedAt],
  );

  const previewObjectUrl =
    previewItem?.artifact?.object_url ||
    previewItem?.artifact?.public_url ||
    previewItem?.url;

  const previewContentType =
    previewItem?.artifact?.content_type ||
    (previewItem?.kind === "imageUrl" ? "image/png" : undefined);

  const previewFileName =
    previewItem?.artifact?.file_name ||
    previewItem?.artifact?.artifact_name ||
    previewItem?.label;

  // Navigation handlers
  const currentPreviewIndex = useMemo(() => {
    if (!previewItem) return -1;
    return artifactGalleryItems.findIndex((item) => item.id === previewItem.id);
  }, [previewItem, artifactGalleryItems]);

  const handleNextPreview = () => {
    if (
      currentPreviewIndex === -1 ||
      currentPreviewIndex === artifactGalleryItems.length - 1
    )
      return;
    openPreview(artifactGalleryItems[currentPreviewIndex + 1]);
  };

  const handlePreviousPreview = () => {
    if (currentPreviewIndex <= 0) return;
    openPreview(artifactGalleryItems[currentPreviewIndex - 1]);
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleResubmitClick = () => setShowResubmitModal(true);

  const handleResubmitConfirm = async () => {
    await handleResubmit();
    setShowResubmitModal(false);
  };

  const handleEditStep = (stepIndex: number) => {
    setEditingStepIndex(stepIndex);
    setIsSidePanelOpen(true);
    latestStepUpdateRef.current = null;
  };

  const handleSaveStep = async (updatedStep: WorkflowStep) => {
    if (!workflow || editingStepIndex === null || !workflow.steps) {
      toast.error("Unable to save: Workflow data not available");
      return;
    }

    try {
      const updatedSteps = [...workflow.steps];
      const originalStep = updatedSteps[editingStepIndex];

      updatedSteps[editingStepIndex] = {
        ...originalStep,
        ...updatedStep,
      };

      // Update workflow
      await api.updateWorkflow(workflow.workflow_id, {
        steps: updatedSteps,
      });

      toast.success("Step updated successfully");

      setStepIndexForRerun(editingStepIndex);

      setEditingStepIndex(null);
      setIsSidePanelOpen(false);

      setShowRerunDialog(true);

      router.refresh();
    } catch (error: any) {
      console.error("Failed to save step:", error);
      toast.error("Failed to save step. Please try again.");
    }
  };

  const handleCancelEdit = async () => {
    if (latestStepUpdateRef.current && editingStepIndex !== null) {
      const currentStep = workflow?.steps?.[editingStepIndex];
      const hasChanges =
        currentStep &&
        JSON.stringify(currentStep) !==
          JSON.stringify(latestStepUpdateRef.current);

      if (hasChanges) {
        await handleSaveStep(latestStepUpdateRef.current);
      }

      latestStepUpdateRef.current = null;
    }

    setEditingStepIndex(null);
    setIsSidePanelOpen(false);
  };

  const handleRerunStepClick = (stepIndex: number) => {
    setStepIndexForRerun(stepIndex);
    setShowRerunDialog(true);
  };

  const handleRerunOnly = async () => {
    if (stepIndexForRerun !== null) {
      setShowRerunDialog(false);
      await handleRerunStep(stepIndexForRerun, false);
      setStepIndexForRerun(null);
    }
  };

  const handleRerunAndContinue = async () => {
    if (stepIndexForRerun !== null) {
      setShowRerunDialog(false);
      await handleRerunStep(stepIndexForRerun, true);
      setStepIndexForRerun(null);
    }
  };

  const handleCloseRerunDialog = () => {
    setShowRerunDialog(false);
    setStepIndexForRerun(null);
  };

  // ---------------------------------------------------------------------------
  // Loading / Error States
  // ---------------------------------------------------------------------------

  if (loading) {
    return <JobDetailSkeleton />;
  }

  if (error && !job) {
    return (
      <ErrorState
        title="Unable to load job"
        message={error}
        onRetry={refreshJob}
        retryLabel="Reload job"
        className="dark:bg-red-900/20 dark:border-red-800"
      />
    );
  }

  if (!job) {
    return null;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const errorFallback = (
    <div className="border border-red-300 dark:border-red-900 rounded-lg p-6 bg-red-50 dark:bg-red-900/20">
      <p className="text-red-800 dark:text-red-200 font-medium">Error loading job details</p>
      <p className="text-red-600 dark:text-red-300 text-sm mt-1">
        Please refresh the page or try again.
      </p>
    </div>
  );

  return (
    <ErrorBoundary fallback={errorFallback}>
      <div>
        <JobHeader
          error={error}
          resubmitting={resubmitting}
          onResubmit={handleResubmitClick}
          job={job}
          workflow={workflow}
          submission={submission}
          lastUpdatedLabel={lastUpdatedLabel}
          lastRefreshedLabel={lastRefreshedLabel}
          onRefresh={refreshJob}
          refreshing={refreshing}
        />

        <ResubmitModal
          isOpen={showResubmitModal}
          onClose={() => setShowResubmitModal(false)}
          onConfirm={handleResubmitConfirm}
          isResubmitting={resubmitting}
        />

        {/* -------------------------------------- */}
        {/* Step Edit Side Panel */}
        {/* -------------------------------------- */}

        {editingStepIndex !== null && workflow?.steps?.[editingStepIndex] && (
          <FlowchartSidePanel
            step={workflow.steps[editingStepIndex]}
            index={editingStepIndex}
            totalSteps={workflow.steps.length}
            allSteps={workflow.steps}
            isOpen={isSidePanelOpen}
            onClose={handleCancelEdit}
            onChange={(index, updatedStep) => {
              latestStepUpdateRef.current = updatedStep;
            }}
            onDelete={() =>
              toast.error("Cannot delete steps from execution viewer.")
            }
            onMoveUp={() =>
              toast.error("Cannot reorder steps from execution viewer.")
            }
            onMoveDown={() =>
              toast.error("Cannot reorder steps from execution viewer.")
            }
            workflowId={workflow.workflow_id}
          />
        )}

        {/* Rerun dialog */}
        <RerunStepDialog
          isOpen={showRerunDialog}
          onClose={handleCloseRerunDialog}
          onRerunOnly={handleRerunOnly}
          onRerunAndContinue={handleRerunAndContinue}
          stepNumber={stepIndexForRerun !== null ? stepIndexForRerun + 1 : 0}
          stepName={
            stepIndexForRerun !== null
              ? mergedSteps[stepIndexForRerun]?.step_name
              : undefined
          }
          isRerunning={rerunningStep !== null}
        />

        {/* Tabs */}
        <JobTabs
          job={job}
          activeTab={activeTab}
          buildTabHref={buildTabHref}
          mergedSteps={mergedSteps}
          artifactGalleryItems={artifactGalleryItems}
          workflow={workflow}
          artifacts={jobArtifacts}
          stepsSummary={stepsSummary}
          jobDuration={jobDuration}
          totalCost={totalCost}
          form={form}
          onSelectExecutionTab={handleSelectExecutionTab}
          expandedSteps={expandedSteps}
          toggleStep={toggleStep}
          showExecutionSteps={showExecutionSteps}
          setShowExecutionSteps={setShowExecutionSteps}
          executionStepsError={executionStepsError}
          imageArtifactsByStep={imageArtifactsByStep}
          loadingArtifacts={loadingArtifacts}
          submission={submission}
          onResubmit={handleResubmitClick}
          resubmitting={resubmitting}
          onRefresh={refreshJob}
          refreshing={refreshing}
          onCopy={copyToClipboard}
          onEditStep={handleEditStep}
          onRerunStepClick={handleRerunStepClick}
          rerunningStep={rerunningStep}
          openPreview={openPreview}
          trackingSessionCount={trackingSessionCount}
          trackingSessionsLoading={trackingSessionsLoading}
          onTrackingSessionsLoaded={setTrackingSessionCount}
          onTrackingSessionsLoadingChange={setTrackingSessionsLoading}
        />

        {/* Artifact Preview Modal */}
        {previewItem && previewObjectUrl && (
          <FullScreenPreviewModal
            isOpen={!!previewItem}
            onClose={closePreview}
            contentType={previewContentType}
            objectUrl={previewObjectUrl}
            fileName={previewFileName}
            artifactId={previewItem?.artifact?.artifact_id}
            onNext={handleNextPreview}
            onPrevious={handlePreviousPreview}
            hasNext={currentPreviewIndex < artifactGalleryItems.length - 1}
            hasPrevious={currentPreviewIndex > 0}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getJobDuration(job?: Job | null): JobDurationInfo | null {
  const shouldFallbackToCreatedAt =
    job?.status === "processing" ||
    job?.status === "completed" ||
    job?.status === "failed";

  const startTime =
    job?.started_at || (shouldFallbackToCreatedAt ? job?.created_at : null);

  if (!startTime) return null;

  const start = new Date(startTime).getTime();
  const endTime = job?.completed_at || job?.failed_at;
  const endTimestamp = endTime ? new Date(endTime).getTime() : Date.now();

  const seconds = Math.max(0, Math.round((endTimestamp - start) / 1000));

  return {
    seconds,
    label: formatDuration(seconds),
    isLive:
      !job?.completed_at &&
      !job?.failed_at &&
      !job?.error_message &&
      job?.status === "processing",
  };
}

// ---------------------------------------------------------------------------
// Job Tabs Component
// ---------------------------------------------------------------------------

interface JobTabsProps {
  job: Job;
  activeTab: JobTabId;
  buildTabHref: (tabId: JobTabId) => string;
  mergedSteps: MergedStep[];
  artifactGalleryItems: ArtifactGalleryItem[];
  workflow: Workflow | null;
  artifacts: Artifact[];
  stepsSummary: JobStepSummary;
  jobDuration?: JobDurationInfo | null;
  totalCost?: number | null;
  form: Form | null;
  onSelectExecutionTab: () => void;
  expandedSteps: Set<number>;
  toggleStep: (stepOrder: number) => void;
  showExecutionSteps: boolean;
  setShowExecutionSteps: (show: boolean) => void;
  executionStepsError: string | null;
  imageArtifactsByStep: Map<number, Artifact[]>;
  loadingArtifacts: boolean;
  submission?: FormSubmission | null;
  onResubmit?: () => void;
  resubmitting?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  onCopy: (text: string) => void;
  onEditStep: (stepIndex: number) => void;
  onRerunStepClick: (stepIndex: number) => void;
  rerunningStep: number | null;
  openPreview: (item: ArtifactGalleryItem) => void;
  trackingSessionCount?: number | null;
  trackingSessionsLoading?: boolean;
  onTrackingSessionsLoaded?: (count: number) => void;
  onTrackingSessionsLoadingChange?: (loading: boolean) => void;
}

function JobTabs({
  job,
  activeTab,
  buildTabHref,
  mergedSteps,
  artifactGalleryItems,
  workflow,
  artifacts,
  stepsSummary,
  jobDuration,
  totalCost,
  form,
  onSelectExecutionTab,
  expandedSteps,
  toggleStep,
  showExecutionSteps,
  setShowExecutionSteps,
  executionStepsError,
  imageArtifactsByStep,
  loadingArtifacts,
  submission,
  onResubmit,
  resubmitting,
  onRefresh,
  refreshing,
  onCopy,
  onEditStep,
  onRerunStepClick,
  rerunningStep,
  openPreview,
  trackingSessionCount,
  trackingSessionsLoading,
  onTrackingSessionsLoaded,
  onTrackingSessionsLoadingChange,
}: JobTabsProps) {
  const stepsBadge = stepsSummary.total;
  const artifactsBadge = artifactGalleryItems.length;
  const trackingBadge =
    trackingSessionsLoading && trackingSessionCount === null
      ? "…"
      : trackingSessionCount;

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-xl border border-border bg-card p-1 shadow-sm">
        <nav className="flex flex-wrap gap-1">
          {TAB_CONFIG.map((tab) => {
            const isActive = activeTab === tab.id;
            const badgeValue =
              tab.id === "execution"
                ? stepsBadge
                : tab.id === "summary"
                  ? artifactsBadge
                  : tab.id === "tracking"
                    ? trackingBadge
                    : null;
            const badgeLabel =
              tab.id === "execution"
                ? "Steps"
                : tab.id === "summary"
                  ? "Outputs"
                  : tab.id === "tracking"
                    ? "Sessions"
                    : undefined;
            return (
              <Link
                key={tab.id}
                href={buildTabHref(tab.id)}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold outline-none transition-colors ${
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <span>{tab.name}</span>
                {badgeValue !== null && badgeValue !== undefined && (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      isActive
                        ? "bg-primary/10 text-primary-700 dark:text-primary-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                    title={badgeLabel}
                  >
                    {badgeValue}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
      <div>
        {activeTab === "execution" && (
          <JobExecutionTab
            job={job}
            mergedSteps={mergedSteps}
            expandedSteps={expandedSteps}
            showExecutionSteps={showExecutionSteps}
            onToggleShowExecutionSteps={() =>
              setShowExecutionSteps(!showExecutionSteps)
            }
            onToggleStep={toggleStep}
            executionStepsError={executionStepsError}
            onRefresh={onRefresh}
            refreshing={refreshing}
            onCopy={onCopy}
            imageArtifactsByStep={imageArtifactsByStep}
            loadingArtifacts={loadingArtifacts}
            submission={submission}
            onResubmit={onResubmit}
            resubmitting={resubmitting}
            onEditStep={onEditStep}
            onRerunStepClick={onRerunStepClick}
            rerunningStep={rerunningStep}
            artifactGalleryItems={artifactGalleryItems}
            onPreview={openPreview}
          />
        )}
        {activeTab === "summary" && (
          <JobSummaryTab
            job={job}
            workflow={workflow}
            stepsSummary={stepsSummary}
            artifactCount={artifactGalleryItems.length}
            jobDuration={jobDuration}
            totalCost={totalCost}
            onSelectExecutionTab={onSelectExecutionTab}
          />
        )}
        {activeTab === "improve" && (
          <JobImproveTab
            job={job}
            workflow={workflow}
            mergedSteps={mergedSteps}
            artifacts={artifacts}
          />
        )}
        {activeTab === "tracking" && (
          <JobTrackingTab
            jobId={job.job_id}
            onSessionsLoaded={onTrackingSessionsLoaded}
            onSessionsLoadingChange={onTrackingSessionsLoadingChange}
          />
        )}
        {activeTab === "technical" && (
          <JobTechnicalTab
            job={job}
            form={form}
            submission={submission}
          />
        )}
        {activeTab === "raw" && <JobDebugTab data={job} />}
      </div>
    </div>
  );
}
