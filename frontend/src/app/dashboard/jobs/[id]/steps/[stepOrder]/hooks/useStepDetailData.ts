import { useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { useJobDetail } from "@/hooks/useJobDetail";
import { useMergedSteps } from "@/hooks/useMergedSteps";
import { useStepArtifacts } from "@/hooks/useStepArtifacts";
import { api } from "@/lib/api";
import { getStepStatus } from "@/components/jobs/utils";
import {
  formatDurationMs,
  formatStepInput,
  formatStepOutput,
} from "@/utils/jobFormatting";
import { getStepInput } from "@/utils/stepInput";
import {
  coerceJsonContent,
  formatContentForDetail,
  getToolLabel,
  toPreviewText,
  Tool,
} from "@/utils/stepDetailUtils";
import type { WorkflowStep } from "@/types";

export function useStepDetailData() {
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
      structure: "unknown" as const,
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

  const stepTitle = step?.step_name || `Step ${step?.step_order ?? stepOrder}`;
  const stepLabel = `Step ${step?.step_order ?? stepOrder}`;
  const heading = stepTitle;
  const description = job?.job_id
    ? `Job ${job.job_id} · ${job.status.replace(/_/g, " ")}`
    : "Execution step details";

  const costValue = step?.usage_info?.cost_usd;
  const formattedCost =
    costValue === undefined || costValue === null
      ? null
      : typeof costValue === "number"
        ? `$${costValue.toFixed(4)}`
        : Number.isNaN(Number(costValue))
          ? null
          : `$${Number(costValue).toFixed(4)}`;

  const durationLabel =
    step?.duration_ms !== undefined ? formatDurationMs(step.duration_ms) : null;
  const startedAtLabel = step?.started_at
    ? new Date(step.started_at).toLocaleString() // Using full date/time for detail view
    : null;
  const completedAtLabel = step?.completed_at
    ? new Date(step.completed_at).toLocaleString()
    : null;

  const promptTokens =
    step?.usage_info?.prompt_tokens ?? step?.usage_info?.input_tokens;
  const completionTokens =
    step?.usage_info?.completion_tokens ?? step?.usage_info?.output_tokens;
  const promptLabel =
    step?.usage_info?.prompt_tokens !== undefined
      ? "Prompt tokens"
      : "Input tokens";
  const completionLabel =
    step?.usage_info?.completion_tokens !== undefined
      ? "Completion tokens"
      : "Output tokens";

  const usageRows = [
    promptTokens !== undefined
      ? { label: promptLabel, value: String(promptTokens) }
      : null,
    completionTokens !== undefined
      ? { label: completionLabel, value: String(completionTokens) }
      : null,
    step?.usage_info?.total_tokens !== undefined
      ? { label: "Total tokens", value: String(step.usage_info.total_tokens) }
      : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const stepInput = step ? getStepInput(step.input) : null;
  const toolChoice = stepInput?.tool_choice ?? step?.tool_choice;
  const rawTools = Array.isArray(stepInput?.tools)
    ? stepInput.tools
    : Array.isArray(step?.tools)
      ? step.tools
      : [];
  const toolLabels = Array.from(
    new Set(
      rawTools
        .map((tool) => getToolLabel(tool as Tool))
        .filter((tool) => tool),
    ),
  );
  const stepTypeLabel = step?.step_type
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
    step?.step_type === "form_submission" || step?.step_type === "final_output";
  const canEditStep =
    Boolean(workflow?.steps && step?.step_order !== undefined) &&
    !isSystemStep &&
    (step?.step_order ?? 0) > 0;
  const isEditingDisabled = false;

  const handleEditStep = () => {
    if (!workflow || !canEditStep || !step) return;
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

  const handleCopy = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error("Unable to copy");
    }
  };

  return {
    stepOrder,
    isStepOrderValid,
    job,
    workflow,
    loading,
    error,
    refreshJob,
    refreshing,
    editingStepIndex,
    setEditingStepIndex,
    isSidePanelOpen,
    setIsSidePanelOpen,
    latestStepUpdateRef,
    mergedSteps,
    sortedSteps,
    step,
    formattedInput,
    formattedOutput,
    inputMeta,
    inputInstructions,
    inputPayload,
    formattedInputPayload,
    formattedInstructions,
    outputContent,
    outputPreview,
    inputPreview,
    instructionsPreview,
    stepStatus,
    imageArtifactsByStep,
    loadingArtifacts,
    stepImageUrls,
    stepImageArtifacts,
    hasImages,
    liveOutput,
    liveUpdatedAt,
    isLiveStep,
    liveOutputText,
    hasLiveOutput,
    outputIsEmpty,
    showLiveOutputPanel,
    liveStatus,
    liveUpdatedAtLabel,
    stepIndex,
    prevStep,
    nextStep,
    jobHref,
    prevHref,
    nextHref,
    stepTitle,
    stepLabel,
    heading,
    description,
    costValue,
    formattedCost,
    durationLabel,
    startedAtLabel,
    completedAtLabel,
    promptTokens,
    completionTokens,
    promptLabel,
    completionLabel,
    usageRows,
    stepInput,
    toolChoice,
    rawTools,
    toolLabels,
    stepTypeLabel,
    totalSteps,
    stepPosition,
    progressPercent,
    statsPreview,
    prevStepStatus,
    nextStepStatus,
    timelineHref,
    isSystemStep,
    canEditStep,
    isEditingDisabled,
    handleEditStep,
    handleSaveStep,
    handleCancelEdit,
    handleCopy,
  };
}
