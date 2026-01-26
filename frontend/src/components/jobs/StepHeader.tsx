/**
 * Step Header Component
 * Displays step header with status, name, metrics, and action buttons
 */

import Link from "next/link";
import { StepActionsMenu } from "@/components/jobs/StepActionsMenu";
import { StepMetaRow } from "@/components/jobs/StepMetaRow";
import { StepTimingRow } from "@/components/jobs/StepTimingRow";
import { MergedStep, StepStatus } from "@/types/job";
import { FiCheckCircle, FiXCircle, FiLoader, FiClock } from "react-icons/fi";

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
  const isPending = status === "pending";

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-start lg:justify-between">
        <div className="order-1 flex items-start gap-4">
          <div className="min-w-0 space-y-1">
            {showMeta && <StepTimingRow step={step} status={status} />}
            <div className="flex items-center gap-2">
              {status === "completed" && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                  <FiCheckCircle className="w-3.5 h-3.5" />
                  Success
                </span>
              )}
              {status === "failed" && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
                  <FiXCircle className="w-3.5 h-3.5" />
                  Failed
                </span>
              )}
              {status === "in_progress" && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  <FiLoader className="w-3.5 h-3.5 animate-spin" />
                  Running
                </span>
              )}
              {status === "pending" && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                  <FiClock className="w-3.5 h-3.5" />
                  Pending
                </span>
              )}
            </div>
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
