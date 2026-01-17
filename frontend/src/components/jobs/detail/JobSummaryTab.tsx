import { JobOverviewSection } from "@/components/jobs/detail/JobOverviewSection";
import type { JobDurationInfo } from "@/components/jobs/detail/JobOverviewSection";
import type { Job, JobStepSummary } from "@/types/job";
import type { Workflow } from "@/types/workflow";

interface JobSummaryTabProps {
  job: Job;
  workflow: Workflow | null;
  stepsSummary: JobStepSummary;
  artifactCount: number;
  jobDuration?: JobDurationInfo | null;
  totalCost?: number | null;
  onSelectExecutionTab: () => void;
}

export function JobSummaryTab({
  job,
  workflow,
  stepsSummary,
  artifactCount,
  jobDuration,
  totalCost,
  onSelectExecutionTab,
}: JobSummaryTabProps) {
  return (
    <JobOverviewSection
      job={job}
      workflow={workflow}
      stepsSummary={stepsSummary}
      artifactCount={artifactCount}
      jobDuration={jobDuration}
      totalCost={totalCost}
      onSelectExecutionTab={onSelectExecutionTab}
    />
  );
}
