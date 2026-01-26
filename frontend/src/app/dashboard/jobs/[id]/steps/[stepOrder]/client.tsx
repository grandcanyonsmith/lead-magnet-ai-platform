"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  ClipboardDocumentIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";

import { useJobDetail } from "@/hooks/useJobDetail";
import { useMergedSteps } from "@/hooks/useMergedSteps";
import { useStepArtifacts } from "@/hooks/useStepArtifacts";
import { api } from "@/lib/api";
import { getStepStatus } from "@/components/jobs/utils";
import { StepContent } from "@/components/jobs/StepContent";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { formatRelativeTime } from "@/utils/date";
import {
  formatDurationMs,
  formatStepInput,
  formatStepOutput,
} from "@/utils/jobFormatting";
import { PreviewRenderer } from "@/components/artifacts/PreviewRenderer";
import FlowchartSidePanel from "@/app/dashboard/workflows/components/FlowchartSidePanel";

import { getStepInput } from "@/utils/stepInput";
import type { Artifact } from "@/types/artifact";
import type { WorkflowStep } from "@/types";
import {
  abbreviateUrl,
  coerceJsonContent,
  formatContentForDetail,
  getToolLabel,
  toCopyText,
  toPreviewText,
  Tool,
} from "@/utils/stepDetailUtils";
import { CollapsibleSectionCard } from "@/components/ui/CollapsibleSectionCard";
import { StepNavCard } from "@/components/jobs/detail/StepNavCard";
import { LiveOutputPanel } from "@/components/jobs/detail/LiveOutputPanel";
import { StepStatsCard } from "@/components/jobs/detail/StepStatsCard";

export default function StepDetailClient() {
  const params = useParams();
  const stepParam = Array.isArray(params?.stepOrder)
    ? params.stepOrder[0]
    : params?.stepOrder;
  const stepOrder = Number(stepParam);
  const isStepOrderValid = Number.isFinite(stepOrder) && stepOrder >= 0;

  const {
    job,
    workflow,
    loading,
    error,
    refreshJob,
    refreshing,
  } = useJobDetail();

  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const latestStepUpdateRef = useRef<WorkflowStep | null>(null);

  const mergedSteps = useMergedSteps({ job, workflow });
  const sortedSteps = useMemo(
    () =>
      [...mergedSteps].sort(
        (a, b) => (a.step_order ?? 0) - (b.step_order ?? 0),
      ),
    [mergedSteps],
  );

  const step = useMemo(
    () =>
      sortedSteps.find((item) => (item.step_order ?? 0) === stepOrder) ||
      null,
    [sortedSteps, stepOrder],
  );

  const formattedInput = useMemo(
    () => (step ? formatStepInput(step) : null),
    [step],
  );
  const formattedOutput = useMemo(
    () => (step ? formatStepOutput(step) : null),
    [step],
  );
  const inputMeta =
    formattedInput &&
    formattedInput.structure === "ai_input" &&
    typeof formattedInput.content === "object" &&
    formattedInput.content !== null
      ? (formattedInput.content as { instructions?: string; input?: unknown })
      : null;
  const inputInstructions =
    typeof inputMeta?.instructions === "string"
      ? inputMeta.instructions
      : typeof step?.instructions === "string"
        ? step.instructions
        : null;
  const inputPayload =
    inputMeta?.input !== undefined ? inputMeta.input : formattedInput?.content;
  const formattedInputPayload = useMemo(
    () => formatContentForDetail(inputPayload),
    [inputPayload],
  );
  const formattedInstructions = useMemo(
    () =>
      inputInstructions
        ? formatContentForDetail(inputInstructions)
        : null,
    [inputInstructions],
  );
  const outputContent = useMemo(() => {
    const base = formattedOutput ?? {
      content: step?.output ?? null,
      type: "json",
    };
    return coerceJsonContent(base);
  }, [formattedOutput, step?.output]);
  const outputPreview = toPreviewText(outputContent);
  const inputPreview = toPreviewText(formattedInputPayload);
  const instructionsPreview = formattedInstructions
    ? toPreviewText(formattedInstructions)
    : null;

  const stepStatus = useMemo(() => {
    if (!step) return "pending";
    return getStepStatus(step, sortedSteps, job?.status);
  }, [step, sortedSteps, job?.status]);

  const { imageArtifactsByStep, loading: loadingArtifacts } = useStepArtifacts({
    jobId: job?.job_id,
    steps: mergedSteps,
  });

  const stepImageUrls = Array.isArray(step?.image_urls) ? step.image_urls : [];
  const stepImageArtifacts =
    imageArtifactsByStep.get(step?.step_order ?? 0) || [];
  const hasImages = stepImageUrls.length > 0 || stepImageArtifacts.length > 0;

  const liveOutput =
    job?.live_step && step?.step_order === job.live_step.step_order
      ? job.live_step.output_text
      : undefined;
  const liveUpdatedAt =
    job?.live_step && step?.step_order === job.live_step.step_order
      ? job.live_step.updated_at
      : undefined;
  const isLiveStep =
    Boolean(job?.live_step) &&
    step?.step_order !== undefined &&
    job?.live_step?.step_order === step.step_order;
  const liveOutputText = typeof liveOutput === "string" ? liveOutput : "";
  const hasLiveOutput = liveOutputText.length > 0;
  const outputIsEmpty =
    step?.output === null || step?.output === undefined || step?.output === "";
  const showLiveOutputPanel =
    isLiveStep &&
    (job?.status === "processing" ||
      hasLiveOutput ||
      Boolean(liveUpdatedAt) ||
      Boolean(job?.live_step?.error) ||
      Boolean(job?.live_step?.status));
  const liveStatus = job?.live_step?.status
    ? job.live_step.status.replace(/_/g, " ")
    : null;
  const liveUpdatedAtLabel = liveUpdatedAt
    ? new Date(liveUpdatedAt).toLocaleTimeString([], {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  const stepIndex = step
    ? sortedSteps.findIndex(
        (item) => (item.step_order ?? 0) === (step.step_order ?? 0),
      )
    : -1;
  const prevStep = stepIndex > 0 ? sortedSteps[stepIndex - 1] : null;
  const nextStep =
    stepIndex >= 0 && stepIndex < sortedSteps.length - 1
      ? sortedSteps[stepIndex + 1]
      : null;

  const jobHref = job?.job_id
    ? `/dashboard/jobs/${job.job_id}`
    : "/dashboard/jobs";
  const prevHref =
    prevStep && job?.job_id
      ? `/dashboard/jobs/${job.job_id}/steps/${prevStep.step_order ?? 0}`
      : null;
  const nextHref =
    nextStep && job?.job_id
      ? `/dashboard/jobs/${job.job_id}/steps/${nextStep.step_order ?? 0}`
      : null;

  const handleCopy = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error("Unable to copy");
    }
  };

  const handleCopyOutput = () => {
    if (showLiveOutputPanel && outputIsEmpty && hasLiveOutput) {
      handleCopy(liveOutputText, "Live output copied");
      return;
    }
    handleCopy(toCopyText(outputContent), "Output copied");
  };

  if (loading) {
    return <LoadingState fullPage message="Loading step details..." />;
  }

  if (error && !job) {
    return (
      <ErrorState
        title="Unable to load job"
        message={error}
        onRetry={refreshJob}
        retryLabel={refreshing ? "Refreshing..." : "Reload job"}
        className="dark:bg-red-900/20 dark:border-red-800"
      />
    );
  }

  if (!isStepOrderValid) {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Invalid step"
          message="This step number is not valid. Please return to the job."
        />
        <Link
          href={jobHref}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to job
        </Link>
      </div>
    );
  }

  if (!job || !step) {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Step not found"
          message="This step does not exist for the selected job."
          onRetry={refreshJob}
          retryLabel="Reload job"
          className="dark:bg-red-900/20 dark:border-red-800"
        />
        <Link
          href={jobHref}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to job
        </Link>
      </div>
    );
  }

  const stepTitle = step.step_name || `Step ${step.step_order ?? stepOrder}`;
  const stepLabel = `Step ${step.step_order ?? stepOrder}`;
  const heading = stepTitle;
  const description = job?.job_id
    ? `Job ${job.job_id} · ${job.status.replace(/_/g, " ")}`
    : "Execution step details";

  const costValue = step.usage_info?.cost_usd;
  const formattedCost =
    costValue === undefined || costValue === null
      ? null
      : typeof costValue === "number"
        ? `$${costValue.toFixed(4)}`
        : Number.isNaN(Number(costValue))
          ? null
          : `$${Number(costValue).toFixed(4)}`;

  const durationLabel =
    step.duration_ms !== undefined ? formatDurationMs(step.duration_ms) : null;
  const startedAtLabel = step.started_at
    ? formatRelativeTime(step.started_at)
    : null;
  const completedAtLabel = step.completed_at
    ? formatRelativeTime(step.completed_at)
    : null;

  const promptTokens =
    step.usage_info?.prompt_tokens ?? step.usage_info?.input_tokens;
  const completionTokens =
    step.usage_info?.completion_tokens ?? step.usage_info?.output_tokens;
  const promptLabel =
    step.usage_info?.prompt_tokens !== undefined
      ? "Prompt tokens"
      : "Input tokens";
  const completionLabel =
    step.usage_info?.completion_tokens !== undefined
      ? "Completion tokens"
      : "Output tokens";

  const usageRows = [
    promptTokens !== undefined
      ? { label: promptLabel, value: String(promptTokens) }
      : null,
    completionTokens !== undefined
      ? { label: completionLabel, value: String(completionTokens) }
      : null,
    step.usage_info?.total_tokens !== undefined
      ? { label: "Total tokens", value: String(step.usage_info.total_tokens) }
      : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const stepInput = getStepInput(step.input);
  const toolChoice = stepInput?.tool_choice ?? step.tool_choice;
  const rawTools = Array.isArray(stepInput?.tools)
    ? stepInput.tools
    : Array.isArray(step.tools)
      ? step.tools
      : [];
  const toolLabels = Array.from(
    new Set(
      rawTools
        .map((tool) => getToolLabel(tool as Tool))
        .filter((tool) => tool),
    ),
  );
  const stepTypeLabel = step.step_type
    ? step.step_type.replace(/_/g, " ")
    : "workflow step";
  const totalSteps = sortedSteps.length;
  const stepPosition = stepIndex >= 0 ? stepIndex + 1 : null;
  const progressPercent =
    stepPosition && totalSteps > 0
      ? Math.round((stepPosition / totalSteps) * 100)
      : 0;
  const statsPreview = [
    durationLabel ? `Duration ${durationLabel}` : null,
    formattedCost ? `Cost ${formattedCost}` : null,
    toolLabels.length > 0
      ? `${toolLabels.length} tool${toolLabels.length === 1 ? "" : "s"}`
      : null,
    usageRows.length > 0
      ? `${usageRows.length} usage metric${
          usageRows.length === 1 ? "" : "s"
        }`
      : "No usage data",
  ]
    .filter(Boolean)
    .join(" · ");

  const prevStepStatus = prevStep
    ? getStepStatus(prevStep, sortedSteps, job?.status)
    : null;
  const nextStepStatus = nextStep
    ? getStepStatus(nextStep, sortedSteps, job?.status)
    : null;
  const timelineHref = `${jobHref}#execution-steps-list`;

  const isSystemStep =
    step.step_type === "form_submission" || step.step_type === "final_output";
  const canEditStep =
    Boolean(workflow?.steps && step.step_order !== undefined) &&
    !isSystemStep &&
    (step.step_order ?? 0) > 0;
  const isEditingDisabled = false; // Never lock editing

  const handleEditStep = () => {
    if (!workflow || !canEditStep) return;
    const index = (step.step_order ?? 1) - 1;
    setEditingStepIndex(index);
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

      await api.updateWorkflow(workflow.workflow_id, {
        steps: updatedSteps,
      });

      toast.success("Step updated successfully");
      latestStepUpdateRef.current = null;
      setEditingStepIndex(null);
      setIsSidePanelOpen(false);
      refreshJob();
    } catch (saveError: unknown) {
      console.error("Failed to save step:", saveError);
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
        return;
      }
    }

    latestStepUpdateRef.current = null;
    setEditingStepIndex(null);
    setIsSidePanelOpen(false);
  };

  return (
    <div className="space-y-6">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
      >
        <Link
          href="/dashboard/jobs"
          className="hover:text-gray-900 dark:hover:text-white"
        >
          Jobs
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <Link
          href={jobHref}
          className="font-mono text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          {job.job_id}
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="font-semibold text-gray-700 dark:text-gray-200">
          {stepLabel}
        </span>
      </nav>
      <PageHeader
        heading={heading}
        description={description}
        bottomContent={
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-1 text-xs font-semibold text-gray-700 dark:text-gray-200">
                {stepLabel}
              </span>
              <StatusBadge
                status={stepStatus}
                className="px-3 py-1 text-xs"
              />
              {isLiveStep && (
                <span className="inline-flex items-center rounded-full border border-blue-200 dark:border-blue-800/50 bg-blue-50/70 dark:bg-blue-900/20 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-200">
                  Live
                </span>
              )}
              <span className="inline-flex items-center rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-1 text-xs text-gray-600 dark:text-gray-300 capitalize">
                {stepTypeLabel}
              </span>
              {step.model && (
                <span className="inline-flex items-center rounded-full border border-purple-200 dark:border-purple-800/40 bg-purple-50/60 dark:bg-purple-900/20 px-3 py-1 text-xs text-purple-700 dark:text-purple-300">
                  {step.model}
                </span>
              )}
            </div>
            {toolLabels.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {toolLabels.map((tool) => (
                  <span
                    key={tool}
                    className="rounded-md border border-primary-100 dark:border-primary-800/40 bg-primary-50 dark:bg-primary-900/20 px-2 py-0.5 text-[11px] font-semibold text-primary-700 dark:text-primary-300"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            )}
          </div>
        }
      >
        {canEditStep && (
          <button
            type="button"
            onClick={handleEditStep}
            disabled={isEditingDisabled}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <PencilSquareIcon className="h-4 w-4" />
            {isEditingDisabled ? "Editing locked" : "Edit step"}
          </button>
        )}
        <Link
          href={jobHref}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to job
        </Link>
        {prevHref && (
          <Link
            href={prevHref}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Previous
          </Link>
        )}
        {nextHref && (
          <Link
            href={nextHref}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Next
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        )}
      </PageHeader>

      <div className="grid gap-3 md:grid-cols-3">
        <StepNavCard
          label="Previous step"
          direction="previous"
          href={prevHref}
          step={prevStep}
          status={prevStepStatus}
        />
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold uppercase tracking-wide">Progress</span>
            {stepPosition !== null && totalSteps > 0 && (
              <span>
                {stepPosition} of {totalSteps}
              </span>
            )}
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-2 rounded-full bg-primary-600 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-500 dark:text-gray-400">
            <span>
              {startedAtLabel ? `Started ${startedAtLabel}` : "Not started"}
            </span>
            <span className="text-right">
              {durationLabel ? `Duration ${durationLabel}` : "Duration —"}
            </span>
            <span>
              {completedAtLabel
                ? `Completed ${completedAtLabel}`
                : job?.status === "processing"
                  ? "In progress"
                  : "Not completed"}
            </span>
            <span className="text-right">
              {formattedCost ? `Cost ${formattedCost}` : "Cost —"}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
            <span>{progressPercent}% complete</span>
            <Link
              href={timelineHref}
              className="font-semibold text-primary-600 hover:text-primary-700"
            >
              View full timeline
            </Link>
          </div>
        </div>
        <StepNavCard
          label="Next step"
          direction="next"
          href={nextHref}
          step={nextStep}
          status={nextStepStatus}
        />
      </div>

      <div className="space-y-4">
        <CollapsibleSectionCard
          title="Output"
          description="Latest step output and rendered preview."
          defaultOpen
          preview={outputPreview}
          actions={
            <button
              type="button"
              onClick={handleCopyOutput}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
            >
              <ClipboardDocumentIcon className="h-3.5 w-3.5" />
              Copy
            </button>
          }
        >
          <LiveOutputPanel
            showLiveOutputPanel={Boolean(showLiveOutputPanel)}
            liveStatus={liveStatus}
            job={job}
            liveUpdatedAtLabel={liveUpdatedAtLabel}
            hasLiveOutput={hasLiveOutput}
            liveOutputText={liveOutputText}
          />
          {showLiveOutputPanel && outputIsEmpty ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Final output will appear once this step completes.
            </p>
          ) : (
            <StepContent
              formatted={outputContent}
              imageUrls={stepImageUrls}
            />
          )}
        </CollapsibleSectionCard>

        {formattedInstructions && (
          <CollapsibleSectionCard
            title="Instructions"
            description="Prompt instructions for this step."
            preview={instructionsPreview}
            actions={
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    toCopyText(formattedInstructions),
                    "Instructions copied",
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
              >
                <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                Copy
              </button>
            }
          >
            <StepContent formatted={formattedInstructions} />
          </CollapsibleSectionCard>
        )}

        <CollapsibleSectionCard
          title="Input payload"
          description="Structured input data sent into the step."
          preview={inputPreview}
          actions={
            <button
              type="button"
              onClick={() =>
                handleCopy(
                  toCopyText(formattedInputPayload),
                  "Input payload copied",
                )
              }
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
            >
              <ClipboardDocumentIcon className="h-3.5 w-3.5" />
              Copy
            </button>
          }
        >
          <StepContent formatted={formattedInputPayload} />
        </CollapsibleSectionCard>

        {hasImages && (
          <CollapsibleSectionCard
            title="Generated images"
            description="Images created during this step."
            preview={`${stepImageUrls.length + stepImageArtifacts.length} image${
              stepImageUrls.length + stepImageArtifacts.length === 1 ? "" : "s"
            }`}
          >
            {loadingArtifacts && stepImageUrls.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Loading images...
              </p>
            ) : (
              <div className="flex flex-nowrap gap-3 overflow-x-auto pb-2 scrollbar-hide-until-hover">
                {stepImageUrls.map((url, index) => (
                  <div
                    key={`url-${index}`}
                    className="shrink-0 w-56 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800"
                  >
                    <div className="aspect-square">
                      <PreviewRenderer
                        contentType="image/png"
                        objectUrl={url}
                        fileName={`Generated image ${index + 1}`}
                        className="w-full h-full"
                      />
                    </div>
                    <div className="px-2 py-2">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-primary-600 dark:text-primary-400 hover:text-primary-700 truncate block"
                        title={url}
                      >
                        {abbreviateUrl(url)}
                      </a>
                    </div>
                  </div>
                ))}
                {stepImageArtifacts.map((artifact: Artifact, index: number) => {
                  const artifactUrl =
                    artifact.object_url || artifact.public_url;
                  if (!artifactUrl) return null;
                  const artifactLabel =
                    artifact.file_name ||
                    artifact.artifact_name ||
                    abbreviateUrl(artifactUrl);
                  return (
                    <div
                      key={`artifact-${artifact.artifact_id || index}`}
                      className="shrink-0 w-56 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800"
                    >
                      <div className="aspect-square">
                        <PreviewRenderer
                          contentType={artifact.content_type || "image/png"}
                          objectUrl={artifactUrl}
                          fileName={
                            artifact.file_name ||
                            artifact.artifact_name ||
                            `Image ${index + 1}`
                          }
                          className="w-full h-full"
                          artifactId={artifact.artifact_id}
                        />
                      </div>
                      <div className="px-2 py-2">
                        <a
                          href={artifactUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-primary-600 dark:text-primary-400 hover:text-primary-700 truncate block"
                          title={
                            artifact.file_name ||
                            artifact.artifact_name ||
                            artifactUrl
                          }
                        >
                          {artifactLabel}
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CollapsibleSectionCard>
        )}

        <CollapsibleSectionCard
          title="Step stats"
          description="Configuration, timing, and usage details."
          preview={statsPreview}
        >
          <StepStatsCard
            step={step}
            stepTypeLabel={stepTypeLabel}
            toolChoice={toolChoice}
            toolLabels={toolLabels}
            durationLabel={durationLabel}
            startedAtLabel={startedAtLabel}
            completedAtLabel={completedAtLabel}
            formattedCost={formattedCost}
            usageRows={usageRows}
            jobStatus={job?.status}
          />
        </CollapsibleSectionCard>

        {step.error && (
          <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50/70 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-200">
            <h3 className="text-sm font-semibold">Error details</h3>
            <p className="mt-2 whitespace-pre-wrap">{step.error}</p>
          </div>
        )}
      </div>

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
    </div>
  );
}
