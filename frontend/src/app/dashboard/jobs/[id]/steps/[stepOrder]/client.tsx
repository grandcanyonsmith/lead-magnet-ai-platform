"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ClipboardDocumentIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import { FiLoader } from "react-icons/fi";
import { toast } from "react-hot-toast";
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";

import { useJobDetail } from "@/hooks/useJobDetail";
import { useMergedSteps } from "@/hooks/useMergedSteps";
import { useImageArtifacts } from "@/hooks/useImageArtifacts";
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
  formatLiveOutputText,
  formatStepInput,
  formatStepOutput,
  isHTML,
  isJSON,
  isMarkdown,
} from "@/utils/jobFormatting";
import { PreviewRenderer } from "@/components/artifacts/PreviewRenderer";
import FlowchartSidePanel from "@/app/dashboard/workflows/components/FlowchartSidePanel";

import type { MergedStep, StepStatus } from "@/types/job";
import type { Artifact } from "@/types/artifact";
import type { WorkflowStep } from "@/types";

type FormattedContent = {
  content: string | unknown;
  type: "json" | "markdown" | "text" | "html";
};

function coerceJsonContent(formatted: FormattedContent): FormattedContent {
  if (formatted.type === "json") {
    return formatted;
  }
  if (typeof formatted.content !== "string") {
    return formatted;
  }
  const trimmed = formatted.content.trim();
  if (!trimmed) return formatted;
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return formatted;
  }
  try {
    const parsed = JSON.parse(trimmed);
    return { content: parsed, type: "json" };
  } catch {
    return formatted;
  }
}

function formatContentForDetail(value: unknown): FormattedContent {
  if (typeof value === "string") {
    if (isHTML(value)) {
      return { content: value, type: "html" };
    }
    if (isJSON(value)) {
      try {
        return { content: JSON.parse(value), type: "json" };
      } catch {
        return { content: value, type: "text" };
      }
    }
    if (isMarkdown(value)) {
      return { content: value, type: "markdown" };
    }
    return { content: value, type: "text" };
  }
  return { content: value, type: "json" };
}

function toCopyText(formatted: FormattedContent): string {
  if (formatted.type === "json") {
    try {
      const jsonString = JSON.stringify(formatted.content, null, 2);
      if (typeof jsonString === "string") {
        return jsonString;
      }
      return formatted.content === undefined ? "" : String(formatted.content);
    } catch {
      return String(formatted.content);
    }
  }
  return typeof formatted.content === "string"
    ? formatted.content
    : formatted.content === undefined
      ? ""
      : String(formatted.content);
}

function toPreviewText(formatted: FormattedContent, maxLength = 280): string {
  const raw = toCopyText(formatted).trim();
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, maxLength - 3)}...`;
}

function abbreviateUrl(url: string, startLength = 28, endLength = 12): string {
  if (!url) return "";
  if (url.length <= startLength + endLength + 3) return url;
  return `${url.slice(0, startLength)}...${url.slice(-endLength)}`;
}

type Tool = string | { type: string; [key: string]: unknown };

function getToolLabel(tool: Tool): string {
  return typeof tool === "string" ? tool : tool.type || "unknown";
}

interface SectionCardProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  preview?: string | null;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

function SectionCard({
  title,
  description,
  defaultOpen = false,
  preview,
  actions,
  children,
}: SectionCardProps) {
  return (
    <Disclosure defaultOpen={defaultOpen}>
      {({ open }) => (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-card shadow-sm overflow-hidden">
          <div className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {title}
              </h3>
              {description && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {actions}
              <DisclosureButton
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                aria-label={open ? "Collapse section" : "Expand section"}
              >
                {open ? (
                  <ChevronUpIcon className="h-4 w-4" />
                ) : (
                  <ChevronDownIcon className="h-4 w-4" />
                )}
              </DisclosureButton>
            </div>
          </div>
          {!open && preview && (
            <div className="px-4 pb-4 sm:px-5 text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap line-clamp-3">
              {preview}
            </div>
          )}
          <DisclosurePanel className="border-t border-gray-100 dark:border-gray-700 px-4 py-4 sm:px-5 sm:py-5">
            {children}
          </DisclosurePanel>
        </div>
      )}
    </Disclosure>
  );
}

interface StepNavCardProps {
  label: string;
  direction: "previous" | "next";
  href?: string | null;
  step: MergedStep | null;
  status?: StepStatus | null;
}

function StepNavCard({
  label,
  direction,
  href,
  step,
  status,
}: StepNavCardProps) {
  const emptyLabel =
    direction === "previous" ? "Start of workflow" : "End of workflow";
  const title = step?.step_name || (step ? `Step ${step.step_order ?? 0}` : "");
  const subtitle = step?.step_type
    ? step.step_type.replace(/_/g, " ")
    : emptyLabel;

  const content = (
    <div
      className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-card p-3 shadow-sm transition-all ${
        href
          ? "hover:border-primary-200 dark:hover:border-primary-800/60 hover:shadow-md"
          : "opacity-70"
      }`}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide">
          {direction === "previous" ? (
            <ArrowLeftIcon className="h-3.5 w-3.5" />
          ) : (
            <ArrowRightIcon className="h-3.5 w-3.5" />
          )}
          {label}
        </span>
        {status && (
          <StatusBadge status={status} className="px-2 py-0.5 text-[10px]" />
        )}
      </div>
      <div className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        {title || "No step available"}
      </div>
      <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 capitalize">
        {subtitle}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        {content}
      </Link>
    );
  }

  return <div>{content}</div>;
}

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

  const { imageArtifactsByStep, loading: loadingArtifacts } = useImageArtifacts({
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
  const formattedLiveOutputText = formatLiveOutputText(liveOutputText);
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

  const toolChoice = step.input?.tool_choice ?? step.tool_choice;
  const rawTools = Array.isArray(step.input?.tools)
    ? step.input.tools
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
  const isEditingDisabled = job?.status === "processing";

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
    } catch (saveError) {
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
        <SectionCard
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
          {showLiveOutputPanel && (
            <div className="mb-4 rounded-lg border border-blue-200 dark:border-blue-800/40 bg-blue-50/60 dark:bg-blue-900/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FiLoader className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-300" />
                  <span className="text-xs font-semibold text-blue-800 dark:text-blue-200">
                    Live output (streaming)
                  </span>
                  {liveStatus && (
                    <span className="rounded-full border border-blue-200/70 dark:border-blue-800/40 bg-blue-100/60 dark:bg-blue-900/20 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-200">
                      {liveStatus}
                    </span>
                  )}
                  {job?.live_step?.truncated && (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      Output truncated
                    </span>
                  )}
                </div>
                {liveUpdatedAtLabel && (
                  <span className="text-[11px] text-blue-700/70 dark:text-blue-200/60">
                    Updated {liveUpdatedAtLabel}
                  </span>
                )}
              </div>
              <pre className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-800 dark:text-gray-200 scrollbar-hide-until-hover">
                {hasLiveOutput
                  ? formattedLiveOutputText
                  : "Waiting for model output..."}
              </pre>
              {job?.live_step?.error && (
                <p className="mt-2 text-xs text-red-600">
                  {job.live_step.error}
                </p>
              )}
            </div>
          )}
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
        </SectionCard>

        {formattedInstructions && (
          <SectionCard
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
          </SectionCard>
        )}

        <SectionCard
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
        </SectionCard>

        {hasImages && (
          <SectionCard
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
          </SectionCard>
        )}

        <SectionCard
          title="Step stats"
          description="Configuration, timing, and usage details."
          preview={statsPreview}
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-4 space-y-3">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                Configuration
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-500 dark:text-gray-400">Step order</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100">
                    {step.step_order ?? "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-500 dark:text-gray-400">Step type</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                    {stepTypeLabel}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-500 dark:text-gray-400">Model</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100">
                    {step.model || "—"}
                  </dd>
                </div>
                {toolChoice && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-gray-500 dark:text-gray-400">
                      Tool choice
                    </dt>
                    <dd className="font-medium text-gray-900 dark:text-gray-100">
                      {toolChoice}
                    </dd>
                  </div>
                )}
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-gray-500 dark:text-gray-400">Tools</dt>
                  <dd className="flex flex-wrap justify-end gap-1 text-right">
                    {toolLabels.length > 0 ? (
                      toolLabels.map((tool) => (
                        <span
                          key={tool}
                          className="rounded-md border border-primary-100 dark:border-primary-800/40 bg-primary-50 dark:bg-primary-900/20 px-2 py-0.5 text-[11px] font-semibold text-primary-700 dark:text-primary-300"
                        >
                          {tool}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">—</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-4 space-y-3">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                Timing & cost
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-500 dark:text-gray-400">Duration</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100">
                    {durationLabel || "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-500 dark:text-gray-400">Started</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100">
                    {startedAtLabel || "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-500 dark:text-gray-400">Completed</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100">
                    {completedAtLabel || "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-500 dark:text-gray-400">Cost</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100">
                    {formattedCost || "—"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-4 space-y-3">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                Usage
              </h3>
              {usageRows.length > 0 ? (
                <dl className="space-y-2 text-sm">
                  {usageRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between gap-3"
                    >
                      <dt className="text-gray-500 dark:text-gray-400">
                        {row.label}
                      </dt>
                      <dd className="font-medium text-gray-900 dark:text-gray-100">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No usage details recorded for this step yet.
                </p>
              )}
            </div>
          </div>
        </SectionCard>

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
