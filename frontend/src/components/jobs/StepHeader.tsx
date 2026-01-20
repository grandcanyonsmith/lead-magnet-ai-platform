/**
 * Step Header Component
 * Displays step header with status, name, metrics, and action buttons
 */

import Link from "next/link";
import { StepActionsMenu } from "@/components/jobs/StepActionsMenu";
import { StepMetaRow } from "@/components/jobs/StepMetaRow";
import { StepTimingRow } from "@/components/jobs/StepTimingRow";
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
  detailsHref,
  detailsLabel = "View step details",
  showMeta = true,
}: StepHeaderProps) {
  const isPending = status === "pending";

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="min-w-0 space-y-1">
            {showMeta && <StepTimingRow step={step} status={status} />}
            <h3
              className={`text-base sm:text-lg font-semibold break-words ${isPending ? "text-gray-500 dark:text-gray-500" : "text-gray-900 dark:text-white"}`}
            >
              {detailsHref ? (
                <Link
                  href={detailsHref}
                  className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  {step.step_name || `Step ${step.step_order ?? 0}`}
                </Link>
              ) : (
                step.step_name || `Step ${step.step_order ?? 0}`
              )}
            </h3>
            {showMeta && (
              <StepMetaRow step={step} status={status} allSteps={allSteps} />
            )}
          </div>
        </div>

        <div className="flex w-full items-center justify-end gap-3 self-end lg:w-auto lg:self-auto">
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
