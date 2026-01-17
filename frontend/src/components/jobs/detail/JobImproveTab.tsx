import { WorkflowImprovePanel } from "@/components/jobs/detail/WorkflowImprovePanel";
import type { Artifact } from "@/types/artifact";
import type { Job, MergedStep } from "@/types/job";
import type { Workflow } from "@/types/workflow";

interface JobImproveTabProps {
  job: Job;
  workflow: Workflow | null;
  mergedSteps: MergedStep[];
  artifacts: Artifact[];
}

export function JobImproveTab({
  job,
  workflow,
  mergedSteps,
  artifacts,
}: JobImproveTabProps) {
  return (
    <WorkflowImprovePanel
      job={job}
      workflow={workflow}
      mergedSteps={mergedSteps}
      artifacts={artifacts}
    />
  );
}
