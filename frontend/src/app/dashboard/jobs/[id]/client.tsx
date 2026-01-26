"use client";

import React, { useState, useRef, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import { useJobDetail } from "@/hooks/useJobDetail";
import { useJobExecutionSteps } from "@/hooks/useJobExecutionSteps";
import { useMergedSteps } from "@/hooks/useMergedSteps";
import { useStepArtifacts } from "@/hooks/useStepArtifacts";
import { useJobAutoUploads } from "@/hooks/useJobAutoUploads";
import { usePreviewModal } from "@/hooks/usePreviewModal";

import { api } from "@/lib/api";
import { buildArtifactGalleryItems } from "@/utils/jobs/artifacts";
import { summarizeStepProgress } from "@/utils/jobs/steps";
import { formatDuration, formatRelativeTime } from "@/utils/date";
import {
  getJobSubmissionPreview,
  getStatusLabel,
  getSubmissionPreview,
} from "@/utils/jobs/listHelpers";

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
import type { TrackingStats } from "@/lib/api/tracking.client";
import type { ArtifactGalleryItem, Job, JobDurationInfo, JobStepSummary } from "@/types/job";
import type { WorkflowStep } from "@/types";
import type { Workflow } from "@/types/workflow";
import { useBreadcrumbs } from "@/contexts/BreadcrumbsContext";
import type {
  ImageGenerationSettings,
  ImageGenerationToolConfig,
} from "@/types/workflow";

type QuickUpdateStepInput = {
  model?: WorkflowStep["model"] | null;
  service_tier?: WorkflowStep["service_tier"] | null;
  reasoning_effort?: WorkflowStep["reasoning_effort"] | null;
  image_generation?: ImageGenerationSettings;
  tools?: WorkflowStep["tools"] | null;
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function JobDetailClient() {
  const router = useRouter();
  const { setItems: setBreadcrumbItems, clearItems: clearBreadcrumbItems } =
    useBreadcrumbs();

  const [showResubmitModal, setShowResubmitModal] = useState(false);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [showRerunDialog, setShowRerunDialog] = useState(false);
  const [trackingSessionCount, setTrackingSessionCount] = useState<number | null>(
    null,
  );
  const [trackingSessionsLoading, setTrackingSessionsLoading] = useState(false);
  const [trackingStats, setTrackingStats] = useState<TrackingStats | null>(null);
  const [trackingStatsLoading, setTrackingStatsLoading] = useState(false);
  const [totalWorkflowRuns, setTotalWorkflowRuns] = useState<number | null>(null);
  const [loadingTotalWorkflowRuns, setLoadingTotalWorkflowRuns] = useState(false);
  const [versionRunCount, setVersionRunCount] = useState<number | null>(null);
  const [loadingVersionRunCount, setLoadingVersionRunCount] = useState(false);
  const [workflowJobs, setWorkflowJobs] = useState<Job[]>([]);
  const [workflowJobsLoading, setWorkflowJobsLoading] = useState(false);
  const [workflowOptions, setWorkflowOptions] = useState<Workflow[]>([]);
  const [workflowOptionsLoading, setWorkflowOptionsLoading] = useState(false);
  const [stepIndexForRerun, setStepIndexForRerun] = useState<number | null>(
    null,
  );
  const [updatingStepIndex, setUpdatingStepIndex] = useState<number | null>(null);

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const tabParam = searchParams.get("tab");
  const activeTab = resolveJobTabId(tabParam);
  const shouldLoadExecutionSteps =
    activeTab === "overview" ||
    activeTab === "execution" ||
    activeTab === "improve";

  const latestStepUpdateRef = useRef<WorkflowStep | null>(null);
  const savingStepRef = useRef(false);

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

  const mergedSteps = useMergedSteps({ job, workflow });

  const { expandedSteps, toggleStep, expandAll, collapseAll } =
    useJobExecutionSteps(mergedSteps);

  const {
    imageArtifactsByStep,
    fileArtifactsByStep,
    artifacts: jobArtifacts,
    loading: loadingArtifacts,
  } = useStepArtifacts({
    jobId: job?.job_id,
    steps: mergedSteps,
    enabled: shouldLoadExecutionSteps,
  });

  const {
    items: autoUploads,
    loading: loadingAutoUploads,
  } = useJobAutoUploads({
    jobId: job?.job_id,
    enabled: shouldLoadExecutionSteps,
    jobStatus: job?.status,
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

  const jobOutputContext = useMemo(
    () =>
      job
        ? {
            job_id: job.job_id,
            output_url: job.output_url,
            completed_at: job.completed_at,
            failed_at: job.failed_at,
          }
        : null,
    [job],
  );

  const artifactGalleryItems = useMemo(() => {
    if (!shouldLoadExecutionSteps) return [];
    return buildArtifactGalleryItems({
      job: jobOutputContext,
      artifacts: jobArtifacts,
      steps: mergedSteps,
      autoUploads,
    });
  }, [
    autoUploads,
    jobArtifacts,
    mergedSteps,
    shouldLoadExecutionSteps,
    jobOutputContext,
  ]);

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

  React.useEffect(() => {
    let isActive = true;
    setWorkflowOptionsLoading(true);
    api
      .getWorkflows()
      .then((data) => {
        if (!isActive) return;
        setWorkflowOptions(Array.isArray(data.workflows) ? data.workflows : []);
      })
      .catch((error) => {
        if (!isActive) return;
        console.error("Failed to load lead magnets:", error);
        setWorkflowOptions([]);
      })
      .finally(() => {
        if (!isActive) return;
        setWorkflowOptionsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  React.useEffect(() => {
    let isActive = true;
    const workflowId = job?.workflow_id;
    if (!workflowId) {
      setTotalWorkflowRuns(null);
      setLoadingTotalWorkflowRuns(false);
      setVersionRunCount(null);
      setLoadingVersionRunCount(false);
      setWorkflowJobs([]);
      setWorkflowJobsLoading(false);
      return;
    }

    setLoadingTotalWorkflowRuns(true);
    setLoadingVersionRunCount(true);
    setWorkflowJobsLoading(true);
    api
      .getJobs({ workflow_id: workflowId, all: true })
      .then((data) => {
        if (!isActive) return;
        const jobs = Array.isArray(data.jobs) ? data.jobs : [];
        const sortedJobs = [...jobs].sort((a, b) => {
          const aTime = new Date(a.created_at || 0).getTime();
          const bTime = new Date(b.created_at || 0).getTime();
          if (aTime !== bTime) return aTime - bTime;
          return a.job_id.localeCompare(b.job_id);
        });
        setWorkflowJobs(sortedJobs);
        const total =
          typeof data.total === "number"
            ? data.total
            : typeof data.count === "number"
              ? data.count
              : jobs.length;
        setTotalWorkflowRuns(total);
        if (typeof activeWorkflowVersion === "number") {
          const versionCount = jobs.filter(
            (jobItem) => jobItem.workflow_version === activeWorkflowVersion,
          ).length;
          setVersionRunCount(versionCount);
        } else {
          setVersionRunCount(null);
        }
      })
      .catch((error) => {
        if (!isActive) return;
        console.error("Failed to load workflow run count:", error);
        setTotalWorkflowRuns(null);
        setVersionRunCount(null);
        setWorkflowJobs([]);
      })
      .finally(() => {
        if (!isActive) return;
        setLoadingTotalWorkflowRuns(false);
        setLoadingVersionRunCount(false);
        setWorkflowJobsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [job?.workflow_id, activeWorkflowVersion]);

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

  const loadingOutputs = loadingArtifacts || loadingAutoUploads;
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

  const breadcrumbItems = useMemo(() => {
    if (!job) return null;

    const leadMagnetLabel =
      workflow?.workflow_name || job.workflow_id || "Lead magnet";
    const jobPreview = getJobSubmissionPreview(job);
    const submissionPreview = submission
      ? getSubmissionPreview(submission)
      : null;
    const submissionLabel =
      submissionPreview ||
      (jobPreview && !jobPreview.startsWith("Submission ")
        ? jobPreview
        : null) ||
      jobPreview;
    const jobLabel = submissionLabel || `Job ${job.job_id.slice(0, 8)}`;

    const workflowMenuItems = workflowOptions.map((workflowItem) => {
      const workflowLabel =
        workflowItem.workflow_name || workflowItem.workflow_id;
      return {
        id: workflowItem.workflow_id,
        label: workflowLabel,
        href: `/dashboard/jobs?workflow_id=${workflowItem.workflow_id}`,
        isActive: workflowItem.workflow_id === job.workflow_id,
      };
    });

    if (
      job.workflow_id &&
      !workflowMenuItems.some((item) => item.id === job.workflow_id)
    ) {
      workflowMenuItems.unshift({
        id: job.workflow_id,
        label: leadMagnetLabel,
        href: `/dashboard/jobs?workflow_id=${job.workflow_id}`,
        isActive: true,
      });
    }

    const jobMenuItems = workflowJobsByNewest.map((jobItem) => {
      const label =
        getJobSubmissionPreview(jobItem) || `Job ${jobItem.job_id.slice(0, 8)}`;
      const statusLabel = getStatusLabel(jobItem.status);
      const timeLabel = jobItem.created_at
        ? formatRelativeTime(jobItem.created_at)
        : null;
      const description = [statusLabel, timeLabel].filter(Boolean).join(" · ");
      return {
        id: jobItem.job_id,
        label,
        href: buildJobHref(jobItem.job_id),
        description,
        isActive: jobItem.job_id === job.job_id,
      };
    });

    if (!jobMenuItems.some((item) => item.id === job.job_id)) {
      const currentStatus = getStatusLabel(job.status);
      const currentTime = job.created_at
        ? formatRelativeTime(job.created_at)
        : null;
      jobMenuItems.unshift({
        id: job.job_id,
        label: jobLabel,
        href: buildJobHref(job.job_id),
        description: [currentStatus, currentTime].filter(Boolean).join(" · "),
        isActive: true,
      });
    }

    return [
      {
        id: "lead-magnet",
        label: leadMagnetLabel,
        href: job.workflow_id
          ? `/dashboard/jobs?workflow_id=${job.workflow_id}`
          : "/dashboard/jobs",
        menuItems: workflowMenuItems,
        menuLabel: "Lead magnets",
        menuSearchPlaceholder: "Find lead magnet...",
        menuEmptyLabel: workflowOptionsLoading
          ? "Loading lead magnets..."
          : "No lead magnets found.",
      },
      {
        id: "job",
        label: jobLabel,
        href: buildJobHref(job.job_id),
        menuItems: jobMenuItems,
        menuLabel: "Jobs",
        menuSearchPlaceholder: "Find job...",
        menuEmptyLabel: workflowJobsLoading
          ? "Loading jobs..."
          : "No jobs found.",
      },
    ];
  }, [
    buildJobHref,
    job,
    submission,
    workflow,
    workflowJobsByNewest,
    workflowOptions,
    workflowOptionsLoading,
    workflowJobsLoading,
  ]);

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
    if (savingStepRef.current) {
      return;
    }
    if (!workflow || editingStepIndex === null || !workflow.steps) {
      toast.error("Unable to save: Workflow data not available");
      return;
    }

    savingStepRef.current = true;
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
    } finally {
      savingStepRef.current = false;
    }
  };

  const handleQuickUpdateStep = async (
    stepIndex: number,
    update: QuickUpdateStepInput,
  ) => {
    if (!workflow || !workflow.steps) {
      toast.error("Unable to update: Workflow data not available");
      return;
    }

    const originalStep = workflow.steps[stepIndex];
    if (!originalStep) {
      toast.error("Unable to update: Step not found");
      return;
    }

    const updatedStep: WorkflowStep = { ...originalStep };

    if (update.model) {
      updatedStep.model = update.model;
    }

    if ("service_tier" in update) {
      if (update.service_tier === null) {
        delete updatedStep.service_tier;
      } else if (update.service_tier !== undefined) {
        updatedStep.service_tier = update.service_tier;
      }
    }

    if ("reasoning_effort" in update) {
      if (update.reasoning_effort === null) {
        delete updatedStep.reasoning_effort;
      } else if (update.reasoning_effort !== undefined) {
        updatedStep.reasoning_effort = update.reasoning_effort;
      }
    }

    if (update.image_generation) {
      const imageConfig = update.image_generation;
      const normalizedConfig: ImageGenerationToolConfig = {
        type: "image_generation",
        model: imageConfig.model || "gpt-image-1.5",
        size: imageConfig.size || "auto",
        quality: imageConfig.quality || "auto",
        background: imageConfig.background || "auto",
      };
      if (imageConfig.format) {
        normalizedConfig.format = imageConfig.format;
      }
      const supportsCompression =
        imageConfig.format === "jpeg" || imageConfig.format === "webp";
      if (
        supportsCompression &&
        typeof imageConfig.compression === "number" &&
        Number.isFinite(imageConfig.compression)
      ) {
        normalizedConfig.compression = Math.min(
          100,
          Math.max(0, imageConfig.compression),
        );
      }
      if (imageConfig.input_fidelity) {
        normalizedConfig.input_fidelity = imageConfig.input_fidelity;
      }

      const existingTools = Array.isArray(updatedStep.tools)
        ? updatedStep.tools
        : [];
      let replaced = false;
      const nextTools = existingTools.map((tool) => {
        if (tool === "image_generation") {
          replaced = true;
          return normalizedConfig;
        }
        if (
          tool &&
          typeof tool === "object" &&
          "type" in tool &&
          (tool as { type?: string }).type === "image_generation"
        ) {
          replaced = true;
          return normalizedConfig;
        }
        return tool;
      });
      if (!replaced) {
        nextTools.push(normalizedConfig);
      }
      updatedStep.tools = nextTools;
    }

    if ("tools" in update) {
      if (update.tools === null) {
        delete updatedStep.tools;
      } else if (update.tools !== undefined) {
        updatedStep.tools = update.tools;
      }
    }

    const updatedSteps = [...workflow.steps];
    updatedSteps[stepIndex] = updatedStep;

    setUpdatingStepIndex(stepIndex);
    try {
      await api.updateWorkflow(workflow.workflow_id, {
        steps: updatedSteps,
      });
      toast.success("Step updated successfully");
      setStepIndexForRerun(stepIndex);
      setShowRerunDialog(true);
      refreshJob().catch((refreshError) => {
        console.error("Failed to refresh job after step update:", refreshError);
      });
    } catch (error) {
      console.error("Failed to update step:", error);
      toast.error("Failed to update step. Please try again.");
    } finally {
      setUpdatingStepIndex(null);
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
        try {
          await handleSaveStep(latestStepUpdateRef.current);
        } catch (error) {
          throw error; // Re-throw to let the error propagate
        }
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

        {/* Artifact Preview Modal */}
        {previewItem && previewObjectUrl && (
          <FullScreenPreviewModal
            isOpen={!!previewItem}
            onClose={closePreview}
            contentType={previewContentType}
            objectUrl={previewObjectUrl}
            fileName={previewFileName}
            artifactId={previewItem?.artifact?.artifact_id}
            jobId={previewItem?.jobId || previewItem?.artifact?.job_id}
            autoUploadKey={previewItem?.autoUploadKey}
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

