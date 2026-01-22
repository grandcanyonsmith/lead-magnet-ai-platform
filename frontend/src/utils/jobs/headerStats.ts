import type { TrackingStats } from "@/lib/api/tracking.client";
import { formatTrackingDuration } from "@/utils/tracking";
import type { JobDurationInfo, JobStepSummary } from "@/types/job";

export type JobHeaderStatsContext =
  | "overview"
  | "execution"
  | "improve"
  | "edit"
  | "tracking"
  | "technical"
  | "raw";

type JobHeaderStatKey =
  | "steps"
  | "cost"
  | "runtime"
  | "outputs"
  | "version"
  | "totalCreated"
  | "workflowSteps"
  | "createdThisVersion"
  | "totalClicks"
  | "uniqueVisitors"
  | "totalSessions"
  | "avgSessionDuration"
  | "totalPageViews"
  | "avgPageViews";

export interface JobHeaderStatsInput {
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
  trackingStats?: TrackingStats | null;
  trackingStatsLoading?: boolean;
  trackingSessionCount?: number | null;
  context?: JobHeaderStatsContext;
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
  context = "overview",
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
  const versionValue =
    typeof workflowVersion === "number" && Number.isFinite(workflowVersion)
      ? `v${workflowVersion}`
      : "--";
  const totalRunsValue = loadingTotalRuns
    ? "Loading..."
    : typeof totalRuns === "number"
      ? totalRuns.toLocaleString()
      : "--";
  const createdSequenceValue =
    loadingTotalRuns || loadingJobSequence
      ? "Loading..."
      : typeof jobSequenceNumber === "number" &&
          Number.isFinite(jobSequenceNumber) &&
          typeof totalRuns === "number" &&
          Number.isFinite(totalRuns)
        ? `${jobSequenceNumber.toLocaleString()}/${totalRuns.toLocaleString()}`
        : totalRunsValue;
  const createdThisVersionValue = loadingVersionRunCount
    ? "Loading..."
    : typeof versionRunCount === "number"
      ? versionRunCount.toLocaleString()
      : "--";
  const workflowStepsValue =
    typeof workflowStepCount === "number" && Number.isFinite(workflowStepCount)
      ? workflowStepCount.toLocaleString()
      : "--";
  const totalClicksValue = trackingStatsLoading
    ? "Loading..."
    : typeof trackingStats?.total_clicks === "number"
      ? trackingStats.total_clicks.toLocaleString()
      : "--";
  const uniqueVisitorsValue = trackingStatsLoading
    ? "Loading..."
    : typeof trackingStats?.unique_visitors === "number"
      ? trackingStats.unique_visitors.toLocaleString()
      : "--";
  const totalSessionsRaw =
    typeof trackingStats?.total_sessions === "number"
      ? trackingStats.total_sessions
      : typeof trackingSessionCount === "number"
        ? trackingSessionCount
        : null;
  const totalSessionsValue = trackingStatsLoading
    ? "Loading..."
    : typeof totalSessionsRaw === "number"
      ? totalSessionsRaw.toLocaleString()
      : "--";
  const avgSessionDurationValue = trackingStatsLoading
    ? "Loading..."
    : typeof trackingStats?.average_session_duration_seconds === "number"
      ? formatTrackingDuration(trackingStats.average_session_duration_seconds)
      : "--";
  const totalPageViewsValue = trackingStatsLoading
    ? "Loading..."
    : typeof trackingStats?.total_page_views === "number"
      ? trackingStats.total_page_views.toLocaleString()
      : "--";
  const avgPageViewsValue = trackingStatsLoading
    ? "Loading..."
    : typeof trackingStats?.average_page_views_per_session === "number" &&
        Number.isFinite(trackingStats.average_page_views_per_session)
      ? trackingStats.average_page_views_per_session.toFixed(1)
      : "--";

  const statsByKey: Record<JobHeaderStatKey, JobHeaderStat> = {
    steps: { label: "Steps", value: stepProgressValue, highlight: true },
    cost: { label: "Cost", value: costValue },
    runtime: { label: "Runtime", value: runtimeValue },
    outputs: { label: "Outputs", value: outputsValue },
    version: { label: "Version", value: versionValue },
    totalCreated: { label: "Created", value: createdSequenceValue },
    createdThisVersion: {
      label: "Created this version",
      value: createdThisVersionValue,
    },
    workflowSteps: { label: "Workflow steps", value: workflowStepsValue },
    totalClicks: { label: "Total clicks", value: totalClicksValue },
    uniqueVisitors: { label: "Unique visitors", value: uniqueVisitorsValue },
    totalSessions: { label: "Total sessions", value: totalSessionsValue },
    avgSessionDuration: {
      label: "Avg session duration",
      value: avgSessionDurationValue,
    },
    totalPageViews: { label: "Total page views", value: totalPageViewsValue },
    avgPageViews: {
      label: "Avg page views/session",
      value: avgPageViewsValue,
    },
  };

  const contextMap: Record<JobHeaderStatsContext, JobHeaderStatKey[]> = {
    overview: ["steps", "runtime", "outputs", "version", "cost", "totalCreated"],
    execution: ["steps", "runtime", "cost"],
    improve: ["version", "workflowSteps", "createdThisVersion", "totalCreated"],
    edit: ["version", "workflowSteps", "createdThisVersion"],
    tracking: [
      "totalClicks",
      "uniqueVisitors",
      "totalSessions",
      "avgSessionDuration",
      "totalPageViews",
      "avgPageViews",
    ],
    technical: ["steps", "runtime", "outputs"],
    raw: ["steps", "runtime", "outputs"],
  };

  const statKeys = contextMap[context] ?? contextMap.overview;
  return statKeys.map((key) => statsByKey[key]);
};
