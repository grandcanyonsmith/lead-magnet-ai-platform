"use client";

import React, { useState, useRef, useMemo } from "react";
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
import { formatDuration } from "@/utils/date";

import { JobHeader } from "@/components/jobs/JobHeader";
import { ResubmitModal } from "@/components/jobs/ResubmitModal";
import { RerunStepDialog } from "@/components/jobs/RerunStepDialog";
import { FullScreenPreviewModal } from "@/components/ui/FullScreenPreviewModal";
import { JobDetailSkeleton } from "@/components/jobs/detail/JobDetailSkeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import {
  JobTabs,
  resolveJobTabId,
  type JobTabId,
} from "@/components/jobs/detail/JobTabs";

import FlowchartSidePanel from "@/app/dashboard/workflows/components/FlowchartSidePanel";
import type { ArtifactGalleryItem, Job, JobDurationInfo, JobStepSummary } from "@/types/job";
import type { WorkflowStep } from "@/types";

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

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const tabParam = searchParams.get("tab");
  const activeTab = resolveJobTabId(tabParam);
  const shouldLoadExecutionSteps =
    activeTab === "overview" ||
    activeTab === "execution" ||
    activeTab === "improve";

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
  } = useJobDetail({
    loadExecutionSteps: shouldLoadExecutionSteps,
    pollExecutionSteps: shouldLoadExecutionSteps,
  });

  const { expandedSteps, toggleStep } = useJobExecutionSteps();

  const mergedSteps = useMergedSteps({ job, workflow });

  const {
    imageArtifactsByStep,
    artifacts: jobArtifacts,
    loading: loadingArtifacts,
  } = useImageArtifacts({
    jobId: job?.job_id,
    steps: mergedSteps,
    enabled: shouldLoadExecutionSteps,
  });

  const buildTabHref = (tabId: JobTabId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabId);
    return `${pathname}?${params.toString()}`;
  };

  const editTabHref = buildTabHref("edit");
  const handleEditExit = () => {
    router.push(buildTabHref("overview"));
  };

  const { previewItem, openPreview, closePreview } =
    usePreviewModal<ArtifactGalleryItem>();

  const artifactGalleryItems = useMemo(() => {
    if (!shouldLoadExecutionSteps) return [];
    return buildArtifactGalleryItems({
      job,
      artifacts: jobArtifacts,
      steps: mergedSteps,
    });
  }, [job, jobArtifacts, mergedSteps, shouldLoadExecutionSteps]);

  const stepsSummary = useMemo<JobStepSummary>(
    () => summarizeStepProgress(mergedSteps),
    [mergedSteps],
  );

  const totalCost = useMemo(() => {
    if (!shouldLoadExecutionSteps) {
      return null;
    }
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
  }, [job?.execution_steps, shouldLoadExecutionSteps]);

  const jobDuration = useMemo(() => getJobDuration(job), [job]);

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
      <div className="flex min-h-full flex-col">
        <JobHeader
          error={error}
          resubmitting={resubmitting}
          onResubmit={handleResubmitClick}
          job={job}
          workflow={workflow}
          editHref={editTabHref}
          artifactCount={artifactGalleryItems.length}
          stepsSummary={stepsSummary}
          jobDuration={jobDuration}
          totalCost={totalCost}
          loadingArtifacts={loadingArtifacts}
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
        <div className="flex-1 min-h-0">
          <JobTabs
            job={job}
            activeTab={activeTab}
            buildTabHref={buildTabHref}
            mergedSteps={mergedSteps}
            artifactGalleryItems={artifactGalleryItems}
            workflow={workflow}
            artifacts={jobArtifacts}
            stepsSummary={stepsSummary}
            form={form}
            expandedSteps={expandedSteps}
            toggleStep={toggleStep}
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
            onEditExit={handleEditExit}
          />
        </div>

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

