import React, { useState } from "react";
import {
  getStatusIcon,
  getStatusBadge,
  getStepDisplayMeta,
  getJobSubmissionPreview,
} from "@/utils/jobs/listHelpers";
import { formatRelativeTime, formatDuration } from "@/utils/date";
import type { SortField } from "@/hooks/useJobFilters";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  XCircleIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { openJobDocumentInNewTab } from "@/utils/jobs/openJobDocument";
import type { Job } from "@/types/job";
import clsx from "clsx";

interface JobsTableProps {
  jobs: Job[];
  workflowMap: Record<string, string>;
  workflowStepCounts: Record<string, number>;
  onNavigate: (jobId: string) => void;
  sortField: SortField;
  sortDirection: "asc" | "desc";
  onSort: (field: SortField) => void;
}

export function JobsDesktopTable({
  jobs,
  workflowMap,
  workflowStepCounts,
  onNavigate,
  sortField,
  sortDirection,
  onSort,
}: JobsTableProps) {
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
    <div
      className="hidden md:block bg-white dark:bg-card rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
      data-tour="jobs-list"
    >
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50/50 dark:bg-gray-800/50">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Lead Magnet
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Status
            </th>
            <th
              className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-colors"
              onClick={() => onSort("date")}
            >
              <div className="flex items-center gap-1">
                Date
                {sortField === "date" &&
                  (sortDirection === "asc" ? (
                    <ChevronUpIcon className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDownIcon className="w-3.5 h-3.5" />
                  ))}
              </div>
            </th>
            <th
              className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-colors"
              onClick={() => onSort("duration")}
            >
              <div className="flex items-center gap-1">
                Time
                {sortField === "duration" &&
                  (sortDirection === "asc" ? (
                    <ChevronUpIcon className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDownIcon className="w-3.5 h-3.5" />
                  ))}
              </div>
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Output
            </th>
            <th className="relative px-6 py-4">
              <span className="sr-only">View</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-card divide-y divide-gray-100 dark:divide-gray-700">
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
            const errorPreview =
              hasError && job.error_message
                ? job.error_message.length > 80
                  ? `${job.error_message.substring(0, 80)}...`
                  : job.error_message
                : null;
            const stepMeta = getStepDisplayMeta(job, workflowStepCounts);
            const submissionPreview = getJobSubmissionPreview(job);
            const isOpening = openingJobId === job.job_id;
            const disableView = openingJobId !== null;

            return (
              <React.Fragment key={job.job_id}>
                <tr
                  className={clsx(
                    "group hover:bg-gray-50/50 dark:hover:bg-gray-800/50 cursor-pointer transition-all duration-150",
                    hasError && "bg-red-50/30 dark:bg-red-900/10",
                  )}
                  onClick={() => onNavigate(job.job_id)}
                >
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {workflowMap[job.workflow_id] || job.workflow_id || "-"}
                    </div>
                    {submissionPreview && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium truncate max-w-xs">
                        {submissionPreview}
                      </div>
                    )}
                    {stepMeta.label && (
                      <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                        {stepMeta.label}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4" data-tour="job-status">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        {/* Status badge and icon handled by helpers, but could be cleaner */}
                        <div className="scale-90 origin-left">
                          {getStatusBadge(job.status)}
                        </div>
                      </div>
                      {stepMeta.isActive && stepMeta.label && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary-600">
                          <ArrowPathIcon className="h-3 w-3 animate-spin" />
                          {stepMeta.label}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {formatRelativeTime(job.created_at)}
                    </div>
                    <div className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">
                      {new Date(job.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">
                    {duration !== null ? (
                      formatDuration(duration)
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </td>
                  <td
                    className="px-6 py-4 whitespace-nowrap"
                    data-tour="view-artifacts"
                  >
                    {job.output_url ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDocument(job);
                        }}
                        disabled={disableView}
                        className="inline-flex items-center gap-1.5 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        {isOpening ? (
                          <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                        )}
                        {isOpening ? "Opening" : "View asset"}
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-gray-300 dark:text-gray-600">
                        No asset
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ChevronRightIcon className="h-5 w-5 text-gray-300 dark:text-gray-600 group-hover:text-primary-400 dark:group-hover:text-primary-500 transition-colors inline-block" />
                  </td>
                </tr>
                {hasError && (
                  <tr
                    key={`${job.job_id}-error`}
                    className="bg-red-50/50 dark:bg-red-900/10 hover:bg-red-100/50 dark:hover:bg-red-900/20 cursor-pointer transition-all duration-150 border-t-0"
                    onClick={() => onNavigate(job.job_id)}
                  >
                    <td colSpan={6} className="px-6 py-3">
                      <div className="flex items-start bg-white/50 dark:bg-black/20 rounded-lg p-3 border border-red-100 dark:border-red-900/30">
                        <XCircleIcon className="w-5 h-5 text-red-500 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-red-800 dark:text-red-200 uppercase tracking-tight">
                            Generation failed
                          </p>
                          <p className="text-sm text-red-700 dark:text-red-300 mt-1 leading-relaxed font-medium line-clamp-2">
                            {errorPreview}
                          </p>
                          <div className="mt-2 flex items-center gap-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigate(job.job_id);
                              }}
                              className="text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline transition-colors"
                            >
                              View full error
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
