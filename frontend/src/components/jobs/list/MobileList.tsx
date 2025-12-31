import { useState } from "react";
import {
  getStatusIcon,
  getStatusBadge,
  getStepDisplayMeta,
  getJobSubmissionPreview,
} from "@/utils/jobs/listHelpers";
import { formatRelativeTime, formatDuration } from "@/utils/date";
import {
  ArrowTopRightOnSquareIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { openJobDocumentInNewTab } from "@/utils/jobs/openJobDocument";
import { JobPreviewThumbnail } from "./JobPreviewThumbnail";
import type { Job } from "@/types/job";
import clsx from "clsx";

interface JobsMobileListProps {
  jobs: Job[];
  workflowMap: Record<string, string>;
  workflowStepCounts: Record<string, number>;
  onNavigate: (jobId: string) => void;
}

export function JobsMobileList({
  jobs,
  workflowMap,
  workflowStepCounts,
  onNavigate,
}: JobsMobileListProps) {
  const [openingJobId, setOpeningJobId] = useState<string | null>(null);

  const handleViewDocument = async (job: Job) => {
    if (!job.output_url || openingJobId) return;

    setOpeningJobId(job.job_id);

    try {
      await openJobDocumentInNewTab(job.job_id);
    } finally {
      setOpeningJobId(null);
    }
  };

  if (!jobs.length) {
    return null;
  }

  return (
    <div className="block md:hidden space-y-4" data-tour="jobs-list">
      {jobs.map((job) => {
        const duration =
          job.completed_at && job.created_at
            ? Math.round(
                (new Date(job.completed_at).getTime() -
                  new Date(job.created_at).getTime()) /
                  1000,
              )
            : null;
        const hasError = job.status === "failed" && job.error_message;
        const stepMeta = getStepDisplayMeta(job, workflowStepCounts);
        const submissionPreview = getJobSubmissionPreview(job);

        return (
          <div
            key={job.job_id}
            onClick={() => onNavigate(job.job_id)}
            className={clsx(
              "group relative bg-white dark:bg-card rounded-xl shadow-sm border border-gray-200 dark:border-border overflow-hidden cursor-pointer hover:shadow-md transition-all active:scale-[0.98]",
              hasError && "border-red-100 dark:border-red-800",
            )}
          >
            <div className="p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-foreground truncate">
                    {workflowMap[job.workflow_id] || job.workflow_id || "-"}
                  </h3>
                  {submissionPreview && (
                    <p className="text-xs text-gray-500 dark:text-muted-foreground mt-1 font-medium truncate">
                      {submissionPreview}
                    </p>
                  )}
                </div>
                <div
                  className="shrink-0 flex flex-col items-end gap-1.5"
                  data-tour="job-status"
                >
                  <div className="scale-90 origin-right">
                    {getStatusBadge(job.status)}
                  </div>
                  {stepMeta.isActive && stepMeta.label && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-primary-600 dark:text-primary">
                      <ArrowPathIcon className="h-3 w-3 animate-spin" />
                      <span>{stepMeta.label}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between py-3 border-y border-gray-50 dark:border-border">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-bold text-gray-400 dark:text-muted-foreground/70 uppercase tracking-tight">
                    Started
                  </span>
                  <span className="text-xs font-medium text-gray-700 dark:text-foreground">
                    {formatRelativeTime(job.created_at)}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-0.5 text-right">
                  <span className="text-[11px] font-bold text-gray-400 dark:text-muted-foreground/70 uppercase tracking-tight">
                    Duration
                  </span>
                  <span className="text-xs font-medium text-gray-700 dark:text-foreground">
                    {duration !== null ? formatDuration(duration) : "—"}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-4">
                <div
                  className="flex items-center gap-3"
                  data-tour="view-artifacts"
                  onClick={(e) => e.stopPropagation()}
                >
                  <JobPreviewThumbnail job={job} size="sm" showOnHover={false} />
                  {job.output_url ? (
                    <button
                      type="button"
                      onClick={() => handleViewDocument(job)}
                      disabled={openingJobId === job.job_id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary/20 text-primary-700 dark:text-primary text-xs font-bold transition-all active:bg-primary-100 dark:active:bg-primary/30 disabled:opacity-50"
                    >
                      {openingJobId === job.job_id ? (
                        <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                      )}
                      {openingJobId === job.job_id ? "Opening" : "View asset"}
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center gap-1 text-xs font-bold text-gray-400 dark:text-muted-foreground">
                  View details
                  <ChevronRightIcon className="h-4 w-4" />
                </div>
              </div>

              {hasError && (
                <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 flex items-start gap-2.5">
                  <XCircleIcon className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-red-800 dark:text-red-300 uppercase tracking-tight">
                      Error
                    </p>
                    <p className="text-xs font-medium text-red-700 dark:text-red-400 mt-0.5 line-clamp-2 leading-relaxed">
                      {job.error_message}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
