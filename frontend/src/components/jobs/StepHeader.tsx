/**
 * Step Header Component
 * Displays step header with status, name, metrics, and action buttons
 */

import { Fragment } from "react";
import Link from "next/link";
import { MergedStep, StepStatus } from "@/types/job";
import { formatDurationMs } from "@/utils/jobFormatting";
import {
  PencilSquareIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  EllipsisVerticalIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleIconSolid } from "@heroicons/react/24/solid";
import { Menu, Transition } from "@headlessui/react";

const STEP_STATUS_BADGE: Record<
  StepStatus,
  { label: string; className: string }
> = {
  completed: {
    label: "Completed",
    className: "bg-green-100 text-green-800 border border-green-200",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-blue-100 text-blue-800 border border-blue-200",
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-800 border border-red-200",
  },
  pending: {
    label: "Pending",
    className: "bg-gray-100 text-gray-700 border border-gray-200",
  },
};

const STEP_NUMBER_BG: Record<StepStatus, string> = {
  completed: "bg-green-600",
  in_progress: "bg-blue-600",
  failed: "bg-red-600",
  pending: "bg-gray-400",
};

interface StepHeaderProps {
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

// Type for tool - can be a string or an object with a type property
type Tool = string | { type: string; [key: string]: unknown };

// Helper to get tool name from tool object or string
function getToolName(tool: Tool): string {
  return typeof tool === "string" ? tool : tool.type || "unknown";
}

// Render status icon inline
function renderStatusIcon(status: StepStatus) {
  const iconClass = "w-5 h-5 flex-shrink-0";
  switch (status) {
    case "completed":
      return <CheckCircleIconSolid className={`${iconClass} text-green-600`} />;
    case "in_progress":
      return (
        <ArrowPathIcon className={`${iconClass} text-blue-600 animate-spin`} />
      );
    case "failed":
      return <XCircleIcon className={`${iconClass} text-red-600`} />;
    case "pending":
    default:
      return (
        <div className={`${iconClass} rounded-full border-2 border-gray-300`} />
      );
  }
}

// Render tool badges inline
function renderToolBadges(tools?: string[] | unknown[]) {
  if (!tools || !Array.isArray(tools) || tools.length === 0) {
    return (
      <span className="px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
        None
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {tools.map((tool, toolIdx) => {
        const toolName = getToolName(tool as Tool);
        return (
          <span
            key={toolIdx}
            className="px-1.5 py-0.5 text-[10px] font-semibold bg-primary-50 text-primary-700 rounded-md border border-primary-100 whitespace-nowrap"
          >
            {toolName}
          </span>
        );
      })}
    </div>
  );
}

export function StepHeader({
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
}: StepHeaderProps) {
  const isPending = status === "pending";
  const isCompleted = status === "completed";
  const isInProgress = status === "in_progress";
  const statusBadge = STEP_STATUS_BADGE[status];
  
  // Use status for coloring instead of step type
  const isSystemStep = step.step_type === "form_submission" || step.step_type === "final_output";
  const canEditStep =
    Boolean(canEdit && onEditStep) && !isSystemStep && step.step_order > 0;
  const canRerunStep =
    Boolean(onRerunStep || onRerunStepClick) &&
    step.step_order > 0 &&
    !isSystemStep;
  const editDisabled = jobStatus === "processing";
  const rerunDisabled =
    rerunningStep === step.step_order - 1 ||
    status === "pending" ||
    status === "in_progress" ||
    (!onRerunStep && !onRerunStepClick);
  const hasActions = Boolean(detailsHref || canEditStep || canRerunStep);

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

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tabular-nums text-gray-500 dark:text-gray-400">
              {isCompleted &&
                (step.duration_ms !== undefined || step.usage_info) && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 dark:bg-gray-800 px-2 py-0.5 border border-gray-200 dark:border-gray-700">
                    {step.duration_ms !== undefined &&
                      formatDurationMs(step.duration_ms)}
                    {step.usage_info?.cost_usd !== undefined && (
                      <>
                        <span className="text-gray-300 dark:text-gray-600">•</span>
                        <span>
                          $
                          {typeof step.usage_info.cost_usd === "number"
                            ? step.usage_info.cost_usd.toFixed(4)
                            : parseFloat(
                                String(step.usage_info.cost_usd) || "0",
                                ).toFixed(4)}
                        </span>
                      </>
                    )}
                  </div>
                )}
              {step.model && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50/50 dark:bg-purple-900/30 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:text-purple-300 border border-purple-100/50 dark:border-purple-800/30">
                  {step.model}
                </span>
              )}
              {((step.input?.tools && step.input.tools.length > 0) ||
                (step.tools && step.tools.length > 0)) && (
                <div className="flex items-center gap-1.5">
                  {renderToolBadges(step.input?.tools || step.tools)}
                </div>
              )}
              {isInProgress && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200 animate-pulse">
                  Processing...
                </span>
              )}
              {status === "failed" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 border border-red-200">
                  Failed
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

        <div className="flex items-center gap-3 self-end lg:self-auto">
          {hasActions && (
            <Menu as="div" className="relative inline-block text-left">
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
                <Menu.Items className="absolute right-0 mt-2 w-52 origin-top-right divide-y divide-gray-100 dark:divide-gray-800 rounded-lg bg-white dark:bg-gray-900 shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none z-20">
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
                            {editDisabled
                              ? "Editing locked"
                              : "Edit workflow step"}
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
          )}
        </div>
      </div>
    </div>
  );
}
