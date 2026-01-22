"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisVerticalIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import { Menu, Transition } from "@headlessui/react";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import type {
  BreadcrumbItem,
  BreadcrumbMenuItem,
} from "@/contexts/BreadcrumbsContext";
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
  workflowSelector?: BreadcrumbItem | null;
  runSelector?: BreadcrumbItem | null;
}

const STATUS_BORDER_CLASS: Record<Status, string> = {
  pending: "border-gray-400",
  processing: "border-blue-500",
  completed: "border-green-500",
  failed: "border-red-500",
};

const SEARCH_THRESHOLD = 7;
const EMPTY_MENU_ITEMS: BreadcrumbMenuItem[] = [];

type HeaderSelectSize = "primary" | "secondary";

interface HeaderSelectProps {
  label: string;
  menuItems?: BreadcrumbMenuItem[];
  menuLabel?: string;
  menuSearchPlaceholder?: string;
  menuEmptyLabel?: string;
  size?: HeaderSelectSize;
  ariaLabel?: string;
}

function HeaderSelect({
  label,
  menuItems,
  menuLabel,
  menuSearchPlaceholder,
  menuEmptyLabel,
  size = "primary",
  ariaLabel,
}: HeaderSelectProps) {
  const items = menuItems ?? EMPTY_MENU_ITEMS;
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const showSearch = items.length >= SEARCH_THRESHOLD;
  const filteredItems = useMemo(() => {
    if (!normalizedQuery) return items;
    return items.filter((item) => {
      const labelMatch = item.label.toLowerCase().includes(normalizedQuery);
      const descriptionMatch =
        typeof item.description === "string" &&
        item.description.toLowerCase().includes(normalizedQuery);
      return labelMatch || descriptionMatch;
    });
  }, [items, normalizedQuery]);
  const emptyLabel =
    menuEmptyLabel || (normalizedQuery ? "No matches found." : "No items.");
  const triggerTextClass =
    size === "primary"
      ? "text-sm sm:text-lg font-semibold text-foreground"
      : "text-xs sm:text-sm font-medium text-muted-foreground";
  const iconClass =
    size === "primary"
      ? "h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground"
      : "h-3.5 w-3.5 text-muted-foreground";
  const gapClass = size === "primary" ? "gap-2" : "gap-1";
  const iconOffsetClass = size === "primary" ? "mt-1" : "mt-0.5";
  const menuWidthClass = size === "primary" ? "w-72 lg:w-80" : "w-64 lg:w-72";
  const hasMenu =
    items.length > 0 || Boolean(menuEmptyLabel) || Boolean(menuLabel);

  if (!hasMenu) {
    return (
      <span className="min-w-0">
        <span
          className={`block min-w-0 whitespace-normal break-words ${triggerTextClass}`}
          title={label}
        >
          {label}
        </span>
      </span>
    );
  }

  return (
    <div className="relative inline-flex w-full">
      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          aria-label={ariaLabel}
          className={`group flex w-full items-start ${gapClass} rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60`}
        >
          <span className="min-w-0">
            <span
              className={`block min-w-0 whitespace-normal break-words ${triggerTextClass}`}
              title={label}
            >
              {label}
            </span>
          </span>
          <ChevronDownIcon
            className={`${iconClass} ${iconOffsetClass} shrink-0`}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="bottom"
          className={`${menuWidthClass} z-[70]`}
        >
          {menuLabel && (
            <DropdownMenuLabel className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              {menuLabel}
            </DropdownMenuLabel>
          )}
          {showSearch && (
            <div className="px-2 pb-2">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={menuSearchPlaceholder || "Search..."}
                  className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          )}
          <div className="max-h-72 overflow-y-auto scrollbar-hide">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <DropdownMenuItem key={item.id} className="cursor-pointer">
                  <Link href={item.href} className="flex w-full items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {item.label}
                      </span>
                      {item.description && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      )}
                    </div>
                    {item.isActive && (
                      <CheckIcon
                        className="mt-0.5 h-4 w-4 text-primary-500"
                        aria-hidden="true"
                      />
                    )}
                  </Link>
                </DropdownMenuItem>
              ))
            ) : (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                {emptyLabel}
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

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
  workflowSelector,
  runSelector,
}: JobHeaderProps) {
  const router = useRouter();

  const workflowLabel =
    workflowSelector?.label || workflow?.workflow_name || "Lead report";
  const runLabel =
    runSelector?.label ||
    (job?.job_id ? `Job ${job.job_id.slice(0, 8)}` : "");
  const showRunSelector = Boolean(runLabel);

  const statusBorderClass = job?.status
    ? STATUS_BORDER_CLASS[job.status]
    : "border-transparent";
  const headingContent = (
    <span className="flex min-w-0 flex-col gap-1">
      <HeaderSelect
        label={workflowLabel}
        ariaLabel="Select lead magnet"
        menuItems={workflowSelector?.menuItems}
        menuLabel={workflowSelector?.menuLabel}
        menuSearchPlaceholder={workflowSelector?.menuSearchPlaceholder}
        menuEmptyLabel={workflowSelector?.menuEmptyLabel}
        size="primary"
      />
      {showRunSelector && (
        <HeaderSelect
          label={runLabel}
          ariaLabel="Select run"
          menuItems={runSelector?.menuItems}
          menuLabel={runSelector?.menuLabel}
          menuSearchPlaceholder={runSelector?.menuSearchPlaceholder}
          menuEmptyLabel={runSelector?.menuEmptyLabel}
          size="secondary"
        />
      )}
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
