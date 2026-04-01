"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisVerticalIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import type { BreadcrumbItem } from "@/contexts/BreadcrumbsContext";
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

const STATUS_BADGE_VARIANT: Record<Status, NonNullable<BadgeProps["variant"]>> = {
  pending: "outline",
  processing: "warning",
  completed: "success",
  failed: "destructive",
};

const STATUS_LABEL: Record<Status, string> = {
  pending: "Pending",
  processing: "Running",
  completed: "Completed",
  failed: "Failed",
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
  workflowSelector,
  runSelector,
}: JobHeaderProps) {
  const router = useRouter();

  const workflowLabel =
    workflowSelector?.label || workflow?.workflow_name || "Lead report";
  const runLabel =
    runSelector?.label ||
    (job?.job_id ? `Job ${job.job_id.slice(0, 8)}` : "");
  const showRunBreadcrumb = Boolean(runLabel);
  const titleLabel =
    runSelector?.label && runSelector.label !== workflowLabel
      ? runSelector.label
      : workflowLabel;
  const titleContextLabel =
    titleLabel !== workflowLabel ? workflowLabel : null;

  const effectiveStatus = error ? "failed" : job?.status;
  const statusBorderClass = effectiveStatus
    ? STATUS_BORDER_CLASS[effectiveStatus]
    : "border-transparent";
  const statusLabel = effectiveStatus ? STATUS_LABEL[effectiveStatus] : null;
  const statusBadgeVariant = effectiveStatus
    ? STATUS_BADGE_VARIANT[effectiveStatus]
    : undefined;
  const statusSummaryParts: string[] = [];
  if (effectiveStatus === "completed" || effectiveStatus === "failed") {
    const duration = jobDuration?.label;
    if (duration) {
      statusSummaryParts.push(
        effectiveStatus === "completed"
          ? `Completed in ${duration}`
          : `Failed after ${duration}`,
      );
    }
  }
  if (stepsSummary?.total) {
    statusSummaryParts.push(`${stepsSummary.total} step${stepsSummary.total === 1 ? "" : "s"}`);
  }
  if (typeof totalCost === "number" && totalCost > 0) {
    statusSummaryParts.push(`$${totalCost.toFixed(2)}`);
  }
  const headingContent = (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-1 text-xs font-medium text-muted-foreground sm:text-sm">
        <Link
          href="/dashboard/jobs"
          className="transition-colors hover:text-foreground"
        >
          Leads &amp; Results
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground/60" />
        {workflowSelector?.href ? (
          <Link
            href={workflowSelector.href}
            className="max-w-[14rem] truncate transition-colors hover:text-foreground sm:max-w-[18rem]"
            title={workflowLabel}
          >
            {workflowLabel}
          </Link>
        ) : (
          <span
            className="max-w-[14rem] truncate sm:max-w-[18rem]"
            title={workflowLabel}
          >
            {workflowLabel}
          </span>
        )}
        {showRunBreadcrumb && (
          <>
            <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span
              className="max-w-[16rem] truncate text-foreground/80 sm:max-w-[22rem]"
              title={runLabel}
            >
              {runLabel}
            </span>
          </>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-wrap items-start gap-2 sm:items-center">
          <h1 className="min-w-0 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            <span className="block truncate" title={titleLabel}>
              {titleLabel}
            </span>
          </h1>
          {statusLabel && statusBadgeVariant && (
            <Badge
              variant={statusBadgeVariant}
              className="shrink-0 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]"
            >
              {effectiveStatus === "processing" && (
                <ArrowPathIcon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              {statusLabel}
            </Badge>
          )}
        </div>
        {titleContextLabel && (
          <p className="text-sm text-muted-foreground">
            Lead magnet:{" "}
            <span className="font-medium text-foreground/80">
              {titleContextLabel}
            </span>
          </p>
        )}
      </div>
      {statusSummaryParts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {statusSummaryParts.map((part, index) => (
            <Badge
              key={`${part}-${index}`}
              variant="outline"
              className="border-border/60 bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground"
            >
              {part}
            </Badge>
          ))}
        </div>
      )}
    </div>
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
    <div className="mb-3 sm:mb-4 space-y-3 sm:space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-red-700 dark:text-red-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-pulse">
          <div>
            <p className="text-sm font-semibold flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Job failed
            </p>
            <p className="text-sm text-red-700/90 dark:text-red-200/90 mt-1">
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
        className="mb-0 pb-3 border-b-0"
        actionsInlineOnMobile
        bottomContent={
          <JobHeaderStats
            stats={stats}
            highlightBorderClassName={statusBorderClass}
          />
        }
      >
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-background/80 p-1 shadow-sm">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Previous job"
              title={isNavDisabled ? "Loading jobs..." : "Previous job"}
              onClick={() => handleJobNavigate(previousJobHref)}
              disabled={isNavDisabled || !previousJobHref}
              className="h-8 w-8 rounded-md"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Next job"
              title={isNavDisabled ? "Loading jobs..." : "Next job"}
              onClick={() => handleJobNavigate(nextJobHref)}
              disabled={isNavDisabled || !nextJobHref}
              className="h-8 w-8 rounded-md"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>

          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              onClick={onRefresh}
              disabled={refreshing}
              className="gap-2"
            >
              <ArrowPathIcon
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              {refreshing ? "Refreshing..." : "Refresh data"}
            </Button>
          )}

          <Button
            type="button"
            onClick={onResubmit}
            disabled={resubmitting}
            className="gap-2"
          >
            <ArrowUturnLeftIcon className="h-4 w-4" />
            {resubmitting ? "Resubmitting..." : "Resubmit"}
          </Button>

          {workflow?.workflow_id && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Job actions"
                  className="shrink-0"
                >
                  <EllipsisVerticalIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="bottom"
                sideOffset={8}
                className="w-52"
              >
                <DropdownMenuItem
                  onClick={() =>
                    resolvedEditHref ? router.push(resolvedEditHref) : undefined
                  }
                  className="gap-2"
                >
                  <PencilSquareIcon className="h-4 w-4" />
                  Edit lead magnet
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </PageHeader>
    </div>
  );
}
