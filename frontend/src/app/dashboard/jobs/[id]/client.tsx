"use client";

import React, { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useJobDetail } from "@/hooks/useJobDetail";
import { useJobExecutionSteps } from "@/hooks/useJobExecutionSteps";
import { useMergedSteps } from "@/hooks/useMergedSteps";
import { usePreviewModal } from "@/hooks/usePreviewModal";
import { useJobBreadcrumbs } from "@/hooks/useJobBreadcrumbs";
import { useJobRelatedData } from "@/hooks/useJobRelatedData";
import { useBreadcrumbs } from "@/contexts/BreadcrumbsContext";

import { summarizeStepProgress } from "@/utils/jobs/steps";
import { getJobDuration } from "@/utils/jobs/duration";

import { JobHeader } from "@/components/jobs/JobHeader";
import { JobDetailSkeleton } from "@/components/jobs/detail/JobDetailSkeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import {
  JobTabs,
  resolveJobTabId,
  JobTabId,
} from "@/components/jobs/detail/JobTabs";

import { JobDetailModals } from "./components/JobDetailModals";
import { useJobArtifactsData } from "./hooks/useJobArtifactsData";
import { useJobDetailState } from "./hooks/useJobDetailState";
import { useJobUpdates } from "./hooks/useJobUpdates";

import type {
  ArtifactGalleryItem,
  JobStepSummary,
} from "@/types/job";

export default function JobDetailClient() {
  const router = useRouter();
  const { setItems: setBreadcrumbItems, clearItems: clearBreadcrumbItems } =
    useBreadcrumbs();

  const {
    showResubmitModal,
    setShowResubmitModal,
    editingStepIndex,
    setEditingStepIndex,
    isSidePanelOpen,
    setIsSidePanelOpen,
    showRerunDialog,
    setShowRerunDialog,
    stepIndexForRerun,
    setStepIndexForRerun,
    updatingStepIndex,
    setUpdatingStepIndex,
    trackingSessionCount,
    setTrackingSessionCount,
    trackingSessionsLoading,
    setTrackingSessionsLoading,
    trackingStats,
    setTrackingStats,
    trackingStatsLoading,
    setTrackingStatsLoading,
  } = useJobDetailState();

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const tabParam = searchParams.get("tab");
  const activeTab = resolveJobTabId(tabParam);
  const shouldLoadExecutionSteps =
    activeTab === "overview" ||
    activeTab === "execution" ||
    activeTab === "improve";

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

  const {
    handleSaveStep,
    handleQuickUpdateStep,
    handleCancelEdit,
    latestStepUpdateRef,
  } = useJobUpdates({
    workflow,
    editingStepIndex,
    setEditingStepIndex,
    setIsSidePanelOpen,
    setStepIndexForRerun,
    setShowRerunDialog,
    refreshJob,
    setUpdatingStepIndex,
  });

  const mergedSteps = useMergedSteps({ job, workflow });

  const { expandedSteps, toggleStep, expandAll, collapseAll } =
    useJobExecutionSteps(mergedSteps);

  // Use new hook for artifacts
  const {
    imageArtifactsByStep,
    fileArtifactsByStep,
    jobArtifacts,
    artifactGalleryItems,
    loadingOutputs,
  } = useJobArtifactsData({
    job,
    mergedSteps,
    shouldLoadExecutionSteps,
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

  const stepsSummary = useMemo<JobStepSummary>(
    () => summarizeStepProgress(mergedSteps),
    [mergedSteps],
  );
  const workflowStepCount = Array.isArray(workflow?.steps)
    ? workflow.steps.length
    : null;
  const workflowVersion =
    typeof workflow?.version === "number" && Number.isFinite(workflow.version)
      ? workflow.version
      : typeof workflow?.template_version === "number" &&
          Number.isFinite(workflow.template_version)
        ? workflow.template_version
        : null;
  const activeWorkflowVersion =
    typeof workflowVersion === "number"
      ? workflowVersion
      : typeof job?.workflow_version === "number" &&
          Number.isFinite(job.workflow_version)
        ? job.workflow_version
        : null;

  const {
    totalWorkflowRuns,
    loadingTotalWorkflowRuns,
    versionRunCount,
    loadingVersionRunCount,
    workflowJobs,
    workflowJobsLoading,
    workflowOptions,
    workflowOptionsLoading,
  } = useJobRelatedData({
    job,
    activeWorkflowVersion,
  });

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

  const workflowJobsByNewest = useMemo(() => {
    if (workflowJobs.length === 0) return [];
    return [...workflowJobs].sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      if (aTime !== bTime) return bTime - aTime;
      return b.job_id.localeCompare(a.job_id);
    });
  }, [workflowJobs]);

  const jobQueryString = useMemo(
    () => searchParams.toString(),
    [searchParams],
  );
  const buildJobHref = useMemo(
    () => (targetJobId: string) =>
      jobQueryString
        ? `/dashboard/jobs/${targetJobId}?${jobQueryString}`
        : `/dashboard/jobs/${targetJobId}`,
    [jobQueryString],
  );

  const breadcrumbItems = useJobBreadcrumbs({
    job,
    workflow,
    submission,
    workflowOptions,
    workflowJobsByNewest,
    workflowOptionsLoading,
    workflowJobsLoading,
    buildJobHref,
  });

  const workflowSelector = breadcrumbItems?.[0] ?? null;
  const runSelector = breadcrumbItems?.[1] ?? null;

  React.useEffect(() => {
    setBreadcrumbItems(breadcrumbItems);
  }, [breadcrumbItems, setBreadcrumbItems]);

  React.useEffect(() => {
    return () => {
      clearBreadcrumbItems();
    };
  }, [clearBreadcrumbItems]);

  const jobSequenceNumber = useMemo(() => {
    if (!job?.job_id || workflowJobs.length === 0) {
      return null;
    }
    const currentIndex = workflowJobs.findIndex(
      (jobItem) => jobItem.job_id === job.job_id,
    );
    return currentIndex >= 0 ? currentIndex + 1 : null;
  }, [job?.job_id, workflowJobs]);

  const { previousJobHref, nextJobHref } = useMemo(() => {
    if (!job?.job_id || workflowJobs.length === 0) {
      return { previousJobHref: null, nextJobHref: null };
    }
    const currentIndex = workflowJobs.findIndex(
      (jobItem) => jobItem.job_id === job.job_id,
    );
    if (currentIndex === -1) {
      return { previousJobHref: null, nextJobHref: null };
    }
    const previousJob =
      currentIndex > 0 ? workflowJobs[currentIndex - 1] : null;
    const nextJob =
      currentIndex < workflowJobs.length - 1
        ? workflowJobs[currentIndex + 1]
        : null;
    return {
      previousJobHref: previousJob?.job_id
        ? buildJobHref(previousJob.job_id)
        : null,
      nextJobHref: nextJob?.job_id ? buildJobHref(nextJob.job_id) : null,
    };
  }, [buildJobHref, job?.job_id, workflowJobs]);

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

  const errorFallback = (
    <div className="border border-red-300 dark:border-red-900 rounded-lg p-6 bg-red-50 dark:bg-red-900/20">
      <p className="text-red-800 dark:text-red-200 font-medium">
        Error loading job details
      </p>
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
          activeTab={activeTab}
          editHref={editTabHref}
          artifactCount={artifactGalleryItems.length}
          stepsSummary={stepsSummary}
          jobDuration={jobDuration}
          totalCost={totalCost}
          loadingArtifacts={loadingOutputs}
          workflowVersion={workflowVersion}
          totalRuns={totalWorkflowRuns}
          loadingTotalRuns={loadingTotalWorkflowRuns}
          jobSequenceNumber={jobSequenceNumber}
          loadingJobSequence={workflowJobsLoading}
          versionRunCount={versionRunCount}
          loadingVersionRunCount={loadingVersionRunCount}
          workflowStepCount={workflowStepCount}
          trackingStats={trackingStats}
          trackingStatsLoading={trackingStatsLoading}
          trackingSessionCount={trackingSessionCount}
          onRefresh={refreshJob}
          refreshing={refreshing}
          previousJobHref={previousJobHref}
          nextJobHref={nextJobHref}
          adjacentJobsLoading={workflowJobsLoading}
          workflowSelector={workflowSelector}
          runSelector={runSelector}
        />
        <div id="job-edit-subheader" className="w-full" />

        <JobDetailModals
          showResubmitModal={showResubmitModal}
          setShowResubmitModal={setShowResubmitModal}
          handleResubmitConfirm={handleResubmitConfirm}
          resubmitting={resubmitting}
          editingStepIndex={editingStepIndex}
          workflow={workflow}
          isSidePanelOpen={isSidePanelOpen}
          handleCancelEdit={handleCancelEdit}
          latestStepUpdateRef={latestStepUpdateRef}
          showRerunDialog={showRerunDialog}
          handleCloseRerunDialog={handleCloseRerunDialog}
          handleRerunOnly={handleRerunOnly}
          handleRerunAndContinue={handleRerunAndContinue}
          stepIndexForRerun={stepIndexForRerun}
          mergedSteps={mergedSteps}
          rerunningStep={rerunningStep}
          previewItem={previewItem}
          closePreview={closePreview}
          previewContentType={previewContentType}
          previewObjectUrl={previewObjectUrl}
          previewFileName={previewFileName}
          handleNextPreview={handleNextPreview}
          handlePreviousPreview={handlePreviousPreview}
          hasNextPreview={currentPreviewIndex < artifactGalleryItems.length - 1}
          hasPreviousPreview={currentPreviewIndex > 0}
          artifactGalleryItems={artifactGalleryItems}
        />

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
            expandAllSteps={expandAll}
            collapseAllSteps={collapseAll}
            executionStepsError={executionStepsError}
            imageArtifactsByStep={imageArtifactsByStep}
            fileArtifactsByStep={fileArtifactsByStep}
            loadingArtifacts={loadingOutputs}
            submission={submission}
            onResubmit={handleResubmitClick}
            resubmitting={resubmitting}
            onRefresh={refreshJob}
            refreshing={refreshing}
            onCopy={copyToClipboard}
            onEditStep={handleEditStep}
            onQuickUpdateStep={handleQuickUpdateStep}
            updatingStepIndex={updatingStepIndex}
            onRerunStepClick={handleRerunStepClick}
            rerunningStep={rerunningStep}
            openPreview={openPreview}
            trackingSessionCount={trackingSessionCount}
            trackingSessionsLoading={trackingSessionsLoading}
            onTrackingSessionsLoaded={setTrackingSessionCount}
            onTrackingSessionsLoadingChange={setTrackingSessionsLoading}
            onTrackingStatsLoaded={setTrackingStats}
            onTrackingStatsLoadingChange={setTrackingStatsLoading}
            onEditExit={handleEditExit}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}
