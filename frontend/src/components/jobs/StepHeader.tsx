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
}: StepHeaderProps) {
  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-start lg:justify-between">
        <div className="order-1 flex items-start gap-4">
          <div className="min-w-0 space-y-1">
            {showMeta && <StepTimingRow step={step} status={status} />}
            <div className="flex items-center gap-2">
              <StepStatusIcon status={status} />
            </div>
            <StepTitle step={step} status={status} detailsHref={detailsHref} />
          </div>
        </div>

        {showMeta && (
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
