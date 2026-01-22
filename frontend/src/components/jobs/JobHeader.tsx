"use client";

import { Fragment } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilSquareIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";
import { Menu, Transition } from "@headlessui/react";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Status } from "@/types/common";
import type { Job, JobDurationInfo, JobStepSummary } from "@/types/job";
import type { Workflow } from "@/types/workflow";
import {
  buildJobHeaderStats,
  type JobHeaderStatsContext,
} from "@/utils/jobs/headerStats";
import { JobHeaderStats } from "@/components/jobs/JobHeaderStats";

interface JobHeaderProps {
  error: string | null;
  resubmitting: boolean;
  onResubmit: () => void;
  job?: Job | null;
  workflow?: Workflow | null;
  activeTab?: JobHeaderStatsContext;
  editHref?: string;
  artifactCount?: number | null;
  stepsSummary?: JobStepSummary | null;
  jobDuration?: JobDurationInfo | null;
  totalCost?: number | null;
  loadingArtifacts?: boolean;
  workflowVersion?: number | null;
  totalRuns?: number | null;
  loadingTotalRuns?: boolean;
  jobSequenceNumber?: number | null;
  loadingJobSequence?: boolean;
  versionRunCount?: number | null;
  loadingVersionRunCount?: boolean;
  workflowStepCount?: number | null;
  trackingStats?: import("@/lib/api/tracking.client").TrackingStats | null;
  trackingStatsLoading?: boolean;
  trackingSessionCount?: number | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  previousJobHref?: string | null;
  nextJobHref?: string | null;
  adjacentJobsLoading?: boolean;
}

const STATUS_BORDER_CLASS: Record<Status, string> = {
  pending: "border-gray-400",
  processing: "border-blue-500",
  completed: "border-green-500",
  failed: "border-red-500",
};

export function JobHeader({
  error,
  resubmitting,
  onResubmit,
  job,
  workflow,
  activeTab,
  editHref,
  artifactCount,
  stepsSummary,
  jobDuration,
  totalCost,
  loadingArtifacts,
  workflowVersion,
  totalRuns,
  loadingTotalRuns,
  jobSequenceNumber,
  loadingJobSequence,
  versionRunCount,
  loadingVersionRunCount,
  workflowStepCount,
  trackingStats,
  trackingStatsLoading,
  trackingSessionCount,
  refreshing,
  onRefresh,
  previousJobHref,
  nextJobHref,
  adjacentJobsLoading,
}: JobHeaderProps) {
  const router = useRouter();

  const heading = workflow?.workflow_name || "Lead report";

  const statusBorderClass = job?.status
    ? STATUS_BORDER_CLASS[job.status]
    : "border-transparent";
  const headingContent = (
    <span className="flex items-center gap-2 min-w-0">
      <span
        className="min-w-0 text-sm sm:text-lg whitespace-normal break-words"
        title={heading}
      >
        {heading}
      </span>
    </span>
  );

  const stats = buildJobHeaderStats({
    artifactCount,
    stepsSummary,
    jobDuration,
    totalCost,
    loadingArtifacts,
    workflowVersion,
    totalRuns,
    loadingTotalRuns,
    jobSequenceNumber,
    loadingJobSequence,
    versionRunCount,
    loadingVersionRunCount,
    workflowStepCount,
    trackingStats,
    trackingStatsLoading,
    trackingSessionCount,
    context: activeTab,
  });

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

  const hasActions = Boolean(workflow?.workflow_id || onRefresh || onResubmit);
  const isNavDisabled = adjacentJobsLoading === true;
  const resolvedEditHref =
    editHref ||
    (workflow?.workflow_id
      ? `/dashboard/workflows/${workflow.workflow_id}/edit`
      : "");

  const handleJobNavigate = (href?: string | null) => {
    if (!href || isNavDisabled) return;
    router.push(href);
  };

  return (
    <div className="mb-6 sm:mb-7 space-y-3 sm:space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-red-700 dark:text-red-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Unable to update this job</p>
            <p className="text-sm text-red-700/90 dark:text-red-200/90">
              {error}
            </p>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-red-950/40 px-3 py-2 text-sm font-semibold text-red-700 dark:text-red-200 transition-colors hover:bg-red-50 dark:hover:bg-red-900/40 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <ArrowPathIcon
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              {refreshing ? "Retrying..." : "Retry"}
            </button>
          )}
        </div>
      )}

      <PageHeader
        heading={headingContent}
        className="mb-0 pb-4"
        actionsInlineOnMobile
        bottomContent={
          <JobHeaderStats
            stats={stats}
            highlightBorderClassName={statusBorderClass}
          />
        }
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous job"
            title={isNavDisabled ? "Loading jobs..." : "Previous job"}
            onClick={() => handleJobNavigate(previousJobHref)}
            disabled={isNavDisabled || !previousJobHref}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next job"
            title={isNavDisabled ? "Loading jobs..." : "Next job"}
            onClick={() => handleJobNavigate(nextJobHref)}
            disabled={isNavDisabled || !nextJobHref}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>

        {hasActions && (
          <Menu as="div" className="relative inline-block text-left ml-auto">
            <Menu.Button
              aria-label="Job actions"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <EllipsisVerticalIcon className="h-5 w-5" />
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
              <Menu.Items className="absolute right-0 mt-2 w-52 origin-top-right divide-y divide-gray-100 dark:divide-gray-800 rounded-lg bg-white dark:bg-gray-900 shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none z-50">
                <div className="px-1 py-1">
                  {workflow?.workflow_id && (
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          type="button"
                          onClick={() =>
                            resolvedEditHref
                              ? router.push(resolvedEditHref)
                              : null
                          }
                          className={getMenuItemClass(active)}
                        >
                          <PencilSquareIcon className="mr-2 h-4 w-4" />
                          Edit lead magnet
                        </button>
                      )}
                    </Menu.Item>
                  )}
                  {onRefresh && (
                    <Menu.Item disabled={refreshing}>
                      {({ active, disabled }) => (
                        <button
                          type="button"
                          onClick={onRefresh}
                          disabled={disabled}
                          className={getMenuItemClass(active, disabled)}
                        >
                          <ArrowPathIcon
                            className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                          />
                          {refreshing ? "Refreshing..." : "Refresh data"}
                        </button>
                      )}
                    </Menu.Item>
                  )}
                  <Menu.Item disabled={resubmitting}>
                    {({ active, disabled }) => (
                      <button
                        type="button"
                        onClick={onResubmit}
                        disabled={disabled}
                        className={getMenuItemClass(active, disabled)}
                      >
                        <ArrowUturnLeftIcon className="mr-2 h-4 w-4" />
                        {resubmitting ? "Resubmitting..." : "Resubmit"}
                      </button>
                    )}
                  </Menu.Item>
                </div>
              </Menu.Items>
            </Transition>
          </Menu>
        )}
      </PageHeader>
    </div>
  );
}
