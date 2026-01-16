import Link from "next/link";
import {
  ChartBarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  PhotoIcon,
  QueueListIcon,
  ArrowTopRightOnSquareIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import { formatRelativeTime } from "@/utils/date";
import type { Job, JobStepSummary } from "@/types/job";
import type { Workflow } from "@/types/workflow";

export interface JobDurationInfo {
  seconds: number;
  label: string;
  isLive: boolean;
}

interface JobOverviewSectionProps {
  job: Job;
  workflow?: Workflow | null;
  stepsSummary: JobStepSummary;
  artifactCount: number;
  jobDuration?: JobDurationInfo | null;
  totalCost?: number | null;
  onSelectExecutionTab?: () => void;
}

export function JobOverviewSection({
  job,
  workflow,
  stepsSummary,
  artifactCount,
  jobDuration,
  totalCost,
  onSelectExecutionTab,
}: JobOverviewSectionProps) {
  const progressPercent = stepsSummary.total
    ? Math.round((stepsSummary.completed / stepsSummary.total) * 100)
    : 0;
  const stepStatusCopy = (() => {
    if (stepsSummary.failed > 0) return `${stepsSummary.failed} failed`;
    if (stepsSummary.running > 0) return `${stepsSummary.running} running`;
    if (stepsSummary.pending > 0) return `${stepsSummary.pending} queued`;
    if (stepsSummary.total === 0) return "No workflow steps";
    return "All steps completed";
  })();

  // Fall back to created_at when started_at is not set for processing, completed, or failed jobs
  const shouldFallbackToCreatedAt =
    job.status === "processing" ||
    job.status === "completed" ||
    job.status === "failed";
  const effectiveStartTime =
    job.started_at || (shouldFallbackToCreatedAt ? job.created_at : null);
  const startLabel = effectiveStartTime
    ? formatRelativeTime(effectiveStartTime)
    : null;
  const completedLabel = job.completed_at
    ? formatRelativeTime(job.completed_at)
    : null;
  const isAutoUpdating = job.status === "processing";

  const showCost =
    typeof totalCost === "number" && Number.isFinite(totalCost);
  const gridColumns = showCost ? "lg:grid-cols-5" : "lg:grid-cols-4";

  const handleViewArtifacts = () => {
    if (artifactCount === 0) {
      return;
    }
    onSelectExecutionTab?.();
    if (typeof window !== "undefined") {
      // Wait for tab to switch and DOM to update before scrolling
      setTimeout(() => {
        const artifactsElement = document.getElementById(
          "job-tab-panel-artifacts",
        );
        if (artifactsElement) {
          artifactsElement.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }, 100);
    }
  };

  const handleViewTimeline = () => {
    onSelectExecutionTab?.();
    if (typeof window !== "undefined") {
      setTimeout(() => {
        const timelineElement =
          document.getElementById("job-execution-timeline");
        if (timelineElement) {
          timelineElement.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }, 100);
    }
  };

  return (
    <section className="mb-4 sm:mb-6">
      <div className="mb-4 space-y-1">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Job summary
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Key metrics and quick actions for this run.
        </p>
      </div>

      <div
        className={`grid gap-3 md:grid-cols-2 ${gridColumns}`}
      >
        <div className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-card p-4 shadow flex h-full flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Step progress
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {stepsSummary.completed}/{stepsSummary.total || "--"}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {stepStatusCopy}
              </p>
            </div>
            <span className="inline-flex rounded-2xl bg-primary-50 dark:bg-primary-900/20 p-3 text-primary-700 dark:text-primary-300 ring-1 ring-primary-100 dark:ring-primary-900/30">
              <ChartBarIcon className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-auto pt-4 space-y-3">
            <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 ring-1 ring-black/[0.02] overflow-hidden">
              <span
                className="block h-full rounded-full bg-primary-600 transition-all"
                style={{ width: `${progressPercent}%` }}
                aria-label={`Step progress ${progressPercent}%`}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{progressPercent}%</span>
              <span>
                {stepsSummary.total ? `${stepsSummary.total} steps` : "No steps"}
              </span>
            </div>
            <button
              type="button"
              onClick={handleViewTimeline}
              className="inline-flex items-center text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
            >
              View timeline
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-card p-4 shadow-sm flex h-full flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Runtime
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {jobDuration?.label ||
                  (effectiveStartTime
                    ? "Initializing..."
                    : isAutoUpdating
                      ? "Starting..."
                      : "Not started")}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {completedLabel
                  ? `Completed ${completedLabel}`
                  : startLabel
                    ? `Started ${startLabel}`
                    : isAutoUpdating
                      ? "Processing started"
                      : "Waiting for worker"}
              </p>
            </div>
            <span className="inline-flex rounded-2xl bg-amber-50 dark:bg-amber-900/20 p-3 text-amber-700 dark:text-amber-300 ring-1 ring-amber-100 dark:ring-amber-900/30">
              <ClockIcon className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
          {jobDuration?.isLive && (
            <span className="mt-auto inline-flex items-center gap-2 rounded-full bg-green-50 dark:bg-green-900/20 px-3 py-1.5 text-xs font-semibold text-green-700 dark:text-green-300 ring-1 ring-green-100 dark:ring-green-900/30">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-card p-4 shadow-sm flex h-full flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Results
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {artifactCount}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {artifactCount
                  ? "Results ready to review"
                  : "Generated reports will appear here"}
              </p>
            </div>
            <span className="inline-flex rounded-2xl bg-purple-50 dark:bg-purple-900/20 p-3 text-purple-700 dark:text-purple-300 ring-1 ring-purple-100 dark:ring-purple-900/30">
              <PhotoIcon className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-auto space-y-2">
            <button
              type="button"
              onClick={handleViewArtifacts}
              disabled={artifactCount === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
              View Results
            </button>
            {job.output_url && (
              <a
                href={job.output_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
                Download output
              </a>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-card p-4 shadow-sm flex h-full flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Workflow
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {workflow?.workflow_name || "Workflow template"}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {workflow?.steps?.length
                  ? `${workflow.steps.length} configured steps`
                  : "Workflow metadata unavailable"}
              </p>
            </div>
            <span className="inline-flex rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 p-3 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-100 dark:ring-indigo-900/30">
              <QueueListIcon className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
          {workflow?.workflow_id ? (
            <Link
              href={`/dashboard/workflows/${workflow.workflow_id}`}
              className="mt-auto inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
              View template
            </Link>
          ) : (
            <p className="mt-auto text-sm text-gray-500 dark:text-gray-400">
              Workflow details not available for this job
            </p>
          )}
        </div>

        {showCost && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-card p-4 shadow-sm flex h-full flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Total cost
                </p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  ${totalCost?.toFixed(4)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Estimated AI usage
                </p>
              </div>
              <span className="inline-flex rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 p-3 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-100 dark:ring-emerald-900/30">
                <CurrencyDollarIcon className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
