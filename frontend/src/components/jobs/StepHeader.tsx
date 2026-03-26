/**
 * Step Header Component
 * Displays step header with status, name, metrics, and action buttons
 */

import { StepActionsMenu } from "@/components/jobs/StepActionsMenu";
import { StepMetaRow } from "@/components/jobs/StepMetaRow";
import { StepTimingRow } from "@/components/jobs/StepTimingRow";
import { StepStatusIcon } from "@/components/jobs/StepStatusIcon";
import { StepTitle } from "@/components/jobs/StepTitle";
import { MergedStep, StepStatus } from "@/types/job";

import { formatDurationMs } from "@/utils/jobFormatting";

interface StepHeaderProps {
  step: MergedStep;
  status: StepStatus;
  jobStatus?: string;
  canEdit?: boolean;
  rerunningStep?: number | null;
  allSteps?: MergedStep[];
  onEditStep?: (stepIndex: number) => void;
  onRerunStep?: (stepIndex: number) => Promise<void>;
  onRerunStepClick?: (stepIndex: number) => void;
  onQuickUpdateStep?: (stepIndex: number, update: {
    model?: import("@/types/workflow").AIModel | null;
    service_tier?: import("@/types/workflow").ServiceTier | null;
    reasoning_effort?: import("@/types/workflow").ReasoningEffort | null;
    image_generation?: import("@/types/workflow").ImageGenerationSettings;
    tools?: import("@/types/workflow").Tool[] | null;
  }) => Promise<void>;
  updatingStepIndex?: number | null;
  detailsHref?: string;
  detailsLabel?: string;
  showMeta?: boolean;
  variant?: "compact" | "expanded";
}

function formatStepTimestamp(isoString?: string): string | null {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return null;
  }
}

export function StepHeader({
  step,
  status,
  jobStatus,
  canEdit = false,
  rerunningStep,
  allSteps,
  onEditStep,
  onRerunStep,
  onRerunStepClick,
  onQuickUpdateStep,
  updatingStepIndex,
  detailsHref,
  detailsLabel = "View step details",
  showMeta = true,
  variant = "expanded",
}: StepHeaderProps) {
  const isCompact = variant === "compact";
  const isCompleted = status === "completed";

  const completedAt = formatStepTimestamp(step.completed_at);
  const durationLabel = step.duration_ms !== undefined ? formatDurationMs(step.duration_ms) : null;
  const costLabel =
    step.usage_info?.cost_usd !== undefined
      ? `$${typeof step.usage_info.cost_usd === "number" ? step.usage_info.cost_usd.toFixed(2) : parseFloat(String(step.usage_info.cost_usd) || "0").toFixed(2)}`
      : null;

  const stepTypeBadge = step.step_type === "ai_generation"
    ? "AI STEP"
    : step.step_type === "workflow_step"
      ? "WORKFLOW"
      : step.step_type
        ? step.step_type.replace(/_/g, " ").toUpperCase()
        : null;

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-start lg:justify-between">
        <div className="order-1 flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <StepStatusIcon status={status} />
                <StepTitle step={step} status={status} detailsHref={detailsHref} />
              </div>
              {isCompleted && (completedAt || durationLabel) && (
                <p className="text-xs text-muted-foreground ml-6">
                  {completedAt && `Completed at ${completedAt}`}
                  {completedAt && durationLabel && " \u00b7 "}
                  {durationLabel && `Duration: ${durationLabel}`}
                </p>
              )}
            </div>

            {isCompact && (
              <div className="flex items-center gap-1.5 shrink-0">
                {stepTypeBadge && (
                  <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    {stepTypeBadge}
                  </span>
                )}
                {costLabel && (
                  <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {costLabel}
                  </span>
                )}
              </div>
            )}
          </div>

          {!isCompact && showMeta && <StepTimingRow step={step} status={status} />}
        </div>

        {!isCompact && showMeta && (
          <div className="order-2 w-full lg:order-3 lg:basis-full">
            <StepMetaRow
              step={step}
              status={status}
              allSteps={allSteps}
              canEdit={canEdit}
              onEditStep={onEditStep}
              onQuickUpdateStep={onQuickUpdateStep}
              updatingStepIndex={updatingStepIndex}
              jobStatus={jobStatus}
            />
          </div>
        )}

        <div className="order-3 flex w-full items-center justify-end gap-3 self-end lg:order-2 lg:w-auto lg:self-auto">
          <StepActionsMenu
            step={step}
            status={status}
            jobStatus={jobStatus}
            canEdit={canEdit}
            rerunningStep={rerunningStep}
            onEditStep={onEditStep}
            onRerunStep={onRerunStep}
            onRerunStepClick={onRerunStepClick}
            detailsHref={detailsHref}
            detailsLabel={detailsLabel}
          />
        </div>
      </div>
    </div>
  );
}
