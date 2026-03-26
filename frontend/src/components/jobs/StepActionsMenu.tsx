import Link from "next/link";
import {
  PencilSquareIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { MergedStep, StepStatus } from "@/types/job";

interface StepActionsMenuProps {
  step: MergedStep;
  status: StepStatus;
  jobStatus?: string;
  canEdit?: boolean;
  rerunningStep?: number | null;
  onEditStep?: (stepIndex: number) => void;
  onRerunStep?: (stepIndex: number) => Promise<void>;
  onRerunStepClick?: (stepIndex: number) => void;
  detailsHref?: string;
  detailsLabel?: string;
}

const getMenuItemClass = (disabled?: boolean) => {
  const base =
    "group flex w-full items-center rounded-md px-2 py-2 text-sm transition-colors";
  if (disabled) {
    return `${base} text-gray-400 dark:text-gray-500 cursor-not-allowed`;
  }
  return `${base} text-gray-700 dark:text-gray-300`;
};

export function StepActionsMenu({
  step,
  status,
  jobStatus,
  canEdit = false,
  rerunningStep,
  onEditStep,
  onRerunStep,
  onRerunStepClick,
  detailsHref,
  detailsLabel = "View step details",
}: StepActionsMenuProps) {
  const isSystemStep =
    step.step_type === "form_submission" || step.step_type === "final_output";
  const canEditStep =
    Boolean(canEdit && onEditStep) && !isSystemStep && step.step_order > 0;
  const canRerunStep =
    Boolean(onRerunStep || onRerunStepClick) &&
    step.step_order > 0 &&
    !isSystemStep;
  const editDisabled = false; // Never lock editing
  const rerunDisabled =
    rerunningStep === step.step_order - 1 ||
    status === "pending" ||
    status === "in_progress" ||
    (!onRerunStep && !onRerunStepClick);
  const hasActions = Boolean(detailsHref || canEditStep || canRerunStep);

  if (!hasActions) {
    return null;
  }

  return (
    <DropdownMenu>
      <div className="relative inline-flex w-full justify-end text-left lg:w-auto">
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Step actions"
            className="p-1.5 rounded transition-colors touch-target min-h-[44px] sm:min-h-0 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <EllipsisVerticalIcon className="w-5 h-5" />
          </button>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-52 max-w-[calc(100vw-2rem)] divide-y divide-gray-100 dark:divide-gray-800 rounded-lg bg-white dark:bg-gray-900 shadow-lg ring-1 ring-black/5 dark:ring-white/10 z-50"
      >
        <div className="px-1 py-1">
          {detailsHref && (
            <DropdownMenuItem asChild>
              <Link
                href={detailsHref}
                onClick={(e) => e.stopPropagation()}
                className={getMenuItemClass()}
              >
                <ArrowTopRightOnSquareIcon className="mr-2 h-4 w-4" />
                {detailsLabel}
              </Link>
            </DropdownMenuItem>
          )}
          {canEditStep && (
            <DropdownMenuItem
              disabled={editDisabled}
              onClick={(e) => {
                e.stopPropagation();
                if (editDisabled) return;
                const workflowStepIndex = step.step_order - 1;
                onEditStep?.(workflowStepIndex);
              }}
              className={getMenuItemClass(editDisabled)}
            >
              <PencilSquareIcon className="mr-2 h-4 w-4" />
              {editDisabled ? "Editing locked" : "Edit workflow step"}
            </DropdownMenuItem>
          )}
          {canRerunStep && (
            <DropdownMenuItem
              disabled={rerunDisabled}
              onClick={(e) => {
                e.stopPropagation();
                if (rerunDisabled) return;
                const stepIndex = step.step_order - 1;
                if (process.env.NODE_ENV === "development") {
                  console.log(
                    `[StepHeader] Rerun menu clicked for step ${step.step_order} (index ${stepIndex})`,
                  );
                }
                if (onRerunStepClick) {
                  onRerunStepClick(stepIndex);
                } else if (onRerunStep) {
                  onRerunStep(stepIndex).catch((error) => {
                    if (process.env.NODE_ENV === "development") {
                      console.error(
                        "[StepHeader] Error in rerun handler:",
                        error,
                      );
                    }
                  });
                }
              }}
              className={getMenuItemClass(rerunDisabled)}
            >
              <ArrowPathIcon
                className={`mr-2 h-4 w-4 ${rerunningStep === step.step_order - 1 ? "animate-spin" : ""}`}
              />
              {rerunningStep === step.step_order - 1
                ? "Rerunning step..."
                : "Rerun this step"}
            </DropdownMenuItem>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
