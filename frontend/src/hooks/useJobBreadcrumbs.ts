import { useMemo } from "react";
import { formatRelativeTime } from "@/utils/date";
import {
  getJobSubmissionPreview,
  getStatusLabel,
  getSubmissionPreview,
} from "@/utils/jobs/listHelpers";
import { Job } from "@/types/job";
import { Workflow } from "@/types/workflow";
import { FormSubmission } from "@/types/form";

interface UseJobBreadcrumbsProps {
  job: Job | null;
  workflow: Workflow | null;
  submission: FormSubmission | null;
  workflowOptions: Workflow[];
  workflowJobsByNewest: Job[];
  workflowOptionsLoading: boolean;
  workflowJobsLoading: boolean;
  buildJobHref: (jobId: string) => string;
}

export function useJobBreadcrumbs({
  job,
  workflow,
  submission,
  workflowOptions,
  workflowJobsByNewest,
  workflowOptionsLoading,
  workflowJobsLoading,
  buildJobHref,
}: UseJobBreadcrumbsProps) {
  return useMemo(() => {
    if (!job) return null;

    const leadMagnetLabel =
      workflow?.workflow_name || job.workflow_id || "Lead magnet";
    const jobPreview = getJobSubmissionPreview(job);
    const submissionPreview = submission
      ? getSubmissionPreview(submission)
      : null;
    const submissionLabel =
      submissionPreview ||
      (jobPreview && !jobPreview.startsWith("Submission ")
        ? jobPreview
        : null) ||
      jobPreview;
    const jobLabel = submissionLabel || `Job ${job.job_id.slice(0, 8)}`;

    const workflowMenuItems = workflowOptions.map((workflowItem) => {
      const workflowLabel =
        workflowItem.workflow_name || workflowItem.workflow_id;
      return {
        id: workflowItem.workflow_id,
        label: workflowLabel,
        href: `/dashboard/jobs?workflow_id=${workflowItem.workflow_id}`,
        isActive: workflowItem.workflow_id === job.workflow_id,
      };
    });

    if (
      job.workflow_id &&
      !workflowMenuItems.some((item) => item.id === job.workflow_id)
    ) {
      workflowMenuItems.unshift({
        id: job.workflow_id,
        label: leadMagnetLabel,
        href: `/dashboard/jobs?workflow_id=${job.workflow_id}`,
        isActive: true,
      });
    }

    const jobMenuItems = workflowJobsByNewest.map((jobItem) => {
      const label =
        getJobSubmissionPreview(jobItem) || `Job ${jobItem.job_id.slice(0, 8)}`;
      const statusLabel = getStatusLabel(jobItem.status);
      const timeLabel = jobItem.created_at
        ? formatRelativeTime(jobItem.created_at)
        : null;
      const description = [statusLabel, timeLabel].filter(Boolean).join(" · ");
      return {
        id: jobItem.job_id,
        label,
        href: buildJobHref(jobItem.job_id),
        description,
        isActive: jobItem.job_id === job.job_id,
      };
    });

    if (!jobMenuItems.some((item) => item.id === job.job_id)) {
      const currentStatus = getStatusLabel(job.status);
      const currentTime = job.created_at
        ? formatRelativeTime(job.created_at)
        : null;
      jobMenuItems.unshift({
        id: job.job_id,
        label: jobLabel,
        href: buildJobHref(job.job_id),
        description: [currentStatus, currentTime].filter(Boolean).join(" · "),
        isActive: true,
      });
    }

    return [
      {
        id: "lead-magnet",
        label: leadMagnetLabel,
        href: job.workflow_id
          ? `/dashboard/jobs?workflow_id=${job.workflow_id}`
          : "/dashboard/jobs",
        menuItems: workflowMenuItems,
        menuLabel: "Lead magnets",
        menuSearchPlaceholder: "Find lead magnet...",
        menuEmptyLabel: workflowOptionsLoading
          ? "Loading lead magnets..."
          : "No lead magnets found.",
      },
      {
        id: "job",
        label: jobLabel,
        href: buildJobHref(job.job_id),
        menuItems: jobMenuItems,
        menuLabel: "Jobs",
        menuSearchPlaceholder: "Find job...",
        menuEmptyLabel: workflowJobsLoading
          ? "Loading jobs..."
          : "No jobs found.",
      },
    ];
  }, [
    buildJobHref,
    job,
    submission,
    workflow,
    workflowJobsByNewest,
    workflowOptions,
    workflowOptionsLoading,
    workflowJobsLoading,
  ]);
}
