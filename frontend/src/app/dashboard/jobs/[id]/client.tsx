"use client";

import React, { useState, useRef, useMemo, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { ClipboardDocumentIcon } from "@heroicons/react/24/outline";
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
import { ExecutionSteps } from "@/components/jobs/ExecutionSteps";
import { TechnicalDetails } from "@/components/jobs/TechnicalDetails";
import { ResubmitModal } from "@/components/jobs/ResubmitModal";
import { RerunStepDialog } from "@/components/jobs/RerunStepDialog";
import { ArtifactGallery } from "@/components/jobs/detail/ArtifactGallery";
import { WorkflowImprovePanel } from "@/components/jobs/detail/WorkflowImprovePanel";
import { FullScreenPreviewModal } from "@/components/ui/FullScreenPreviewModal";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

import FlowchartSidePanel from "@/app/dashboard/workflows/components/FlowchartSidePanel";
import {
  JobOverviewSection,
  JobDurationInfo,
} from "@/components/jobs/detail/JobOverviewSection";
import { JobTrackingStats } from "@/components/tracking/JobTrackingStats";

import type {
  ArtifactGalleryItem,
  Job,
  JobStepSummary,
  MergedStep,
} from "@/types/job";
import type { WorkflowStep } from "@/types";
import type { Workflow } from "@/types/workflow";
import type { FormSubmission, Form } from "@/types/form";
import type { Artifact } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function JobDetailClient() {
  const router = useRouter();

  const [showResubmitModal, setShowResubmitModal] = useState(false);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [showRerunDialog, setShowRerunDialog] = useState(false);
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

  const [selectedIndex, setSelectedIndex] = useState(0);

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
    return <LoadingState />;
  }

  if (error && !job) {
    return <ErrorState message={error} />;
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
        />

        <JobOverviewSection
          job={job}
          workflow={workflow}
          stepsSummary={stepsSummary}
          artifactCount={artifactGalleryItems.length}
          jobDuration={jobDuration}
          lastUpdatedLabel={lastUpdatedLabel}
          lastRefreshedLabel={lastRefreshedLabel}
          onRefresh={refreshJob}
          refreshing={refreshing}
          onSelectArtifacts={() => setSelectedIndex(1)}
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
          selectedIndex={selectedIndex}
          setSelectedIndex={setSelectedIndex}
          mergedSteps={mergedSteps}
          artifactGalleryItems={artifactGalleryItems}
          executionHeader={
            <WorkflowImprovePanel
              job={job}
              workflow={workflow}
              mergedSteps={mergedSteps}
              artifacts={jobArtifacts}
            />
          }
          expandedSteps={expandedSteps}
          toggleStep={toggleStep}
          showExecutionSteps={showExecutionSteps}
          setShowExecutionSteps={setShowExecutionSteps}
          executionStepsError={executionStepsError}
          imageArtifactsByStep={imageArtifactsByStep}
          loadingArtifacts={loadingArtifacts}
          submission={submission}
          form={form}
          onResubmit={handleResubmitClick}
          resubmitting={resubmitting}
          onCopy={copyToClipboard}
          onEditStep={handleEditStep}
          onRerunStepClick={handleRerunStepClick}
          rerunningStep={rerunningStep}
          openPreview={openPreview}
        />

        <TechnicalDetails job={job} form={form} submission={submission} />

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
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  mergedSteps: MergedStep[];
  artifactGalleryItems: ArtifactGalleryItem[];
  executionHeader?: ReactNode;
  expandedSteps: Set<number>;
  toggleStep: (stepOrder: number) => void;
  showExecutionSteps: boolean;
  setShowExecutionSteps: (show: boolean) => void;
  executionStepsError: string | null;
  imageArtifactsByStep: Map<number, Artifact[]>;
  loadingArtifacts: boolean;
  submission?: FormSubmission | null;
  form?: Form | null;
  onResubmit?: () => void;
  resubmitting?: boolean;
  onCopy: (text: string) => void;
  onEditStep: (stepIndex: number) => void;
  onRerunStepClick: (stepIndex: number) => void;
  rerunningStep: number | null;
  openPreview: (item: ArtifactGalleryItem) => void;
}

function JobTabs({
  job,
  selectedIndex,
  setSelectedIndex,
  mergedSteps,
  artifactGalleryItems,
  executionHeader,
  expandedSteps,
  toggleStep,
  showExecutionSteps,
  setShowExecutionSteps,
  executionStepsError,
  imageArtifactsByStep,
  loadingArtifacts,
  submission,
  form,
  onResubmit,
  resubmitting,
  onCopy,
  onEditStep,
  onRerunStepClick,
  rerunningStep,
  openPreview,
}: JobTabsProps) {
  const tabs = [
    { name: "Report Generation", id: "execution" },
    { name: "Lead Activity", id: "tracking" },
    { name: "Debug Data", id: "raw" },
  ];

  return (
    <div className="mt-8">
      <TabGroup selectedIndex={selectedIndex} onChange={setSelectedIndex}>
        <TabList className="flex space-x-8 border-b border-gray-300 dark:border-gray-700">
          {tabs.map((tab) => (
            <Tab
              key={tab.name}
              className={({ selected }) =>
                `whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium outline-none transition-colors ${
                  selected
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-200"
                }`
              }
            >
              {tab.name}
            </Tab>
          ))}
        </TabList>
        <TabPanels className="mt-6">
          <TabPanel>
            <div className="space-y-8">
              {executionHeader ? <div>{executionHeader}</div> : null}
              <ExecutionSteps
                steps={mergedSteps}
                expandedSteps={expandedSteps}
                showExecutionSteps={showExecutionSteps}
                onToggleShow={() => setShowExecutionSteps(!showExecutionSteps)}
                onToggleStep={toggleStep}
                onCopy={onCopy}
                jobStatus={job.status}
                submission={submission}
                form={form}
                onResubmit={onResubmit}
                resubmitting={resubmitting}
                onEditStep={onEditStep}
                canEdit={true}
                imageArtifactsByStep={imageArtifactsByStep}
                loadingImageArtifacts={loadingArtifacts}
                onRerunStepClick={onRerunStepClick}
                rerunningStep={rerunningStep}
              />

              <div id="job-tab-panel-artifacts">
                <ArtifactGallery
                  items={artifactGalleryItems}
                  loading={loadingArtifacts}
                  onPreview={openPreview}
                />
              </div>
            </div>
          </TabPanel>
          <TabPanel>
            <div id="job-tab-panel-tracking">
              <JobTrackingStats jobId={job.job_id} />
            </div>
          </TabPanel>
          <TabPanel>
            <RawJsonPanel data={job} />
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Raw JSON Panel
// ---------------------------------------------------------------------------

function RawJsonPanel({ data }: { data: unknown }) {
  const hasData = Array.isArray(data) ? data.length > 0 : Boolean(data);

  if (!hasData) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 p-4 text-sm text-gray-600 dark:text-gray-400">
        No raw JSON data is available for this run.
      </div>
    );
  }

  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      toast.success("Execution JSON copied");
    } catch {
      toast.error("Unable to copy JSON");
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-950 text-gray-100">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <p className="text-sm font-semibold">Raw execution JSON</p>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold hover:bg-gray-800"
        >
          <ClipboardDocumentIcon className="h-4 w-4" />
          Copy JSON
        </button>
      </div>

      <pre className="overflow-auto text-xs leading-relaxed p-4 text-gray-100">
        {jsonString}
      </pre>
    </div>
  );
}
