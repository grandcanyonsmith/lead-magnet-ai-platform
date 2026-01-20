import type { JobDurationInfo, JobStepSummary } from "@/types/job";

export interface JobHeaderStatsInput {
  artifactCount?: number | null;
  stepsSummary?: JobStepSummary | null;
  jobDuration?: JobDurationInfo | null;
  totalCost?: number | null;
  loadingArtifacts?: boolean;
}

export interface JobHeaderStat {
  label: string;
  value: string;
  highlight?: boolean;
}

export const buildJobHeaderStats = ({
  artifactCount,
  stepsSummary,
  jobDuration,
  totalCost,
  loadingArtifacts,
}: JobHeaderStatsInput): JobHeaderStat[] => {
  const outputsValue = loadingArtifacts
    ? "Loading..."
    : typeof artifactCount === "number"
      ? artifactCount.toLocaleString()
      : "--";
  const stepProgressValue =
    stepsSummary && stepsSummary.total > 0
      ? `${stepsSummary.completed}/${stepsSummary.total}`
      : "--";
  const runtimeValue = jobDuration?.label || "--";
  const costValue =
    typeof totalCost === "number" && Number.isFinite(totalCost)
      ? `$${totalCost.toFixed(4)}`
      : "--";

  return [
    { label: "Steps", value: stepProgressValue, highlight: true },
    { label: "Cost", value: costValue },
    { label: "Runtime", value: runtimeValue },
    { label: "Outputs", value: outputsValue },
  ];
};
