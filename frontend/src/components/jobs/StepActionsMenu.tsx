import { Fragment } from "react";
import Link from "next/link";
import {
  PencilSquareIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";
import { Menu, Transition } from "@headlessui/react";
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

const getMenuItemClass = (active: boolean, disabled?: boolean) => {
  const base =
    "group flex w-full items-center rounded-md px-2 py-2 text-sm transition-colors";
  if (disabled) {
    return `${base} text-gray-400 dark:text-gray-500 cursor-not-allowed`;
  }
  return active
    ? `${base} bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300`
    : `${base} text-gray-700 dark:text-gray-300`;
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
    <Menu as="div" className="relative inline-flex w-full justify-end text-left lg:w-auto">
      <Menu.Button
        aria-label="Step actions"
        className="p-1.5 rounded transition-colors touch-target min-h-[44px] sm:min-h-0 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <EllipsisVerticalIcon className="w-5 h-5" />
      </Menu.Button>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 mt-2 w-52 max-w-[calc(100vw-2rem)] origin-top-right divide-y divide-gray-100 dark:divide-gray-800 rounded-lg bg-white dark:bg-gray-900 shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none z-50">
          <div className="px-1 py-1">
            {detailsHref && (
              <Menu.Item>
                {({ active }) => (
                  <Link
                    href={detailsHref}
                    onClick={(e) => e.stopPropagation()}
                    className={getMenuItemClass(active)}
                  >
                    <ArrowTopRightOnSquareIcon className="mr-2 h-4 w-4" />
                    {detailsLabel}
                  </Link>
                )}
              </Menu.Item>
            )}
            {canEditStep && (
              <Menu.Item disabled={editDisabled}>
                {({ active, disabled }) => (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (disabled) return;
                      const workflowStepIndex = step.step_order - 1;
                      onEditStep?.(workflowStepIndex);
                    }}
                    disabled={disabled}
                    className={getMenuItemClass(active, disabled)}
                  >
                    <PencilSquareIcon className="mr-2 h-4 w-4" />
                    {editDisabled ? "Editing locked" : "Edit workflow step"}
                  </button>
                )}
              </Menu.Item>
            )}
            {canRerunStep && (
              <Menu.Item disabled={rerunDisabled}>
                {({ active, disabled }) => (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (disabled) return;
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
                    disabled={disabled}
                    className={getMenuItemClass(active, disabled)}
                  >
                    <ArrowPathIcon
                      className={`mr-2 h-4 w-4 ${rerunningStep === step.step_order - 1 ? "animate-spin" : ""}`}
                    />
                    {rerunningStep === step.step_order - 1
                      ? "Rerunning step..."
                      : "Rerun this step"}
                  </button>
                )}
              </Menu.Item>
            )}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
