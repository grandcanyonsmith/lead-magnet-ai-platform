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
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatPill } from "@/components/ui/StatPill";
import { KeyValueList } from "@/components/ui/KeyValueList";
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
  const gridColumns = showCost ? "xl:grid-cols-5" : "xl:grid-cols-4";

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

  const metadataItems = [
    {
      label: "Job ID",
      value: job.job_id,
      copyValue: job.job_id,
    },
    job.submission_id
      ? {
          label: "Submission ID",
          value: job.submission_id,
          copyValue: job.submission_id,
        }
      : null,
    workflow?.workflow_id
      ? {
          label: "Workflow ID",
          value: workflow.workflow_id,
          copyValue: workflow.workflow_id,
        }
      : null,
    {
      label: "Status",
      value: job.status,
    },
    {
      label: "Created",
      value: formatRelativeTime(job.created_at),
    },
    job.started_at
      ? {
          label: "Started",
          value: formatRelativeTime(job.started_at),
        }
      : null,
    job.completed_at
      ? {
          label: "Completed",
          value: formatRelativeTime(job.completed_at),
        }
      : null,
    job.updated_at
      ? {
          label: "Last updated",
          value: formatRelativeTime(job.updated_at),
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    value: string;
    copyValue?: string;
  }>;

  return (
    <section className="mb-4 sm:mb-6 space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Job summary</h2>
        <p className="text-sm text-muted-foreground">
          Key metrics and quick actions for this run.
        </p>
      </div>

      <div className={`grid gap-3 md:grid-cols-2 ${gridColumns}`}>
        <StatPill
          label="Step progress"
          value={`${stepsSummary.completed}/${stepsSummary.total || "--"}`}
          helperText={stepStatusCopy}
          icon={<ChartBarIcon className="h-4 w-4" />}
        />
        <StatPill
          label="Runtime"
          value={
            jobDuration?.label ||
            (effectiveStartTime
              ? "Initializing..."
              : isAutoUpdating
                ? "Starting..."
                : "Not started")
          }
          helperText={
            completedLabel
              ? `Completed ${completedLabel}`
              : startLabel
                ? `Started ${startLabel}`
                : isAutoUpdating
                  ? "Processing started"
                  : "Waiting for worker"
          }
          icon={<ClockIcon className="h-4 w-4" />}
        />
        <StatPill
          label="Outputs"
          value={artifactCount}
          helperText={
            artifactCount
              ? "Results ready to review"
              : "Generated reports will appear here"
          }
          icon={<PhotoIcon className="h-4 w-4" />}
        />
        <StatPill
          label="Workflow"
          value={workflow?.workflow_name || "Workflow template"}
          helperText={
            workflow?.steps?.length
              ? `${workflow.steps.length} configured steps`
              : "Workflow metadata unavailable"
          }
          icon={<QueueListIcon className="h-4 w-4" />}
        />
        {showCost && (
          <StatPill
            label="Total cost"
            value={`$${totalCost?.toFixed(4)}`}
            helperText="Estimated AI usage"
            icon={<CurrencyDollarIcon className="h-4 w-4" />}
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="Quick actions"
          description="Jump to details or export results."
          className="lg:col-span-2"
        >
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleViewTimeline}>
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              View timeline
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleViewArtifacts}
              disabled={artifactCount === 0}
            >
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              View results
            </Button>
            {job.output_url && (
              <a
                href={job.output_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Download output
              </a>
            )}
            {workflow?.workflow_id && (
              <Link
                href={`/dashboard/workflows/${workflow.workflow_id}`}
                className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                View template
              </Link>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Metadata" description="Reference IDs and timing.">
          <KeyValueList items={metadataItems} columns={1} dense />
        </SectionCard>
      </div>
    </section>
  );
}
