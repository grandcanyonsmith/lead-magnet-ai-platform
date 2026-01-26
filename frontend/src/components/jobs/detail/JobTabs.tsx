import { SubHeaderTabs } from "@/components/ui/SubHeaderTabs";
import type { ComponentProps } from "react";
import dynamic from "next/dynamic";
import { JobSummaryTab } from "@/components/jobs/detail/JobSummaryTab";
import type {
  ArtifactGalleryItem,
  Job,
  JobStepSummary,
  MergedStep,
} from "@/types/job";
import type { Workflow } from "@/types/workflow";
import type { Form, FormSubmission } from "@/types/form";
import type { Artifact } from "@/types/artifact";
import type { TrackingStats } from "@/lib/api/tracking.client";

type TabGroupId = "general" | "workflow" | "insights" | "advanced";

const TabFallback = ({ label }: { label: string }) => (
  <div className="rounded-xl border border-border bg-card/60 p-6 text-sm text-muted-foreground">
    Loading {label}...
  </div>
);

type JobExecutionTabProps = ComponentProps<
  typeof import("@/components/jobs/detail/JobExecutionTab").JobExecutionTab
>;
type JobImproveTabProps = ComponentProps<
  typeof import("@/components/jobs/detail/JobImproveTab").JobImproveTab
>;
type JobTrackingTabProps = ComponentProps<
  typeof import("@/components/jobs/detail/JobTrackingTab").JobTrackingTab
>;
type JobTechnicalTabProps = ComponentProps<
  typeof import("@/components/jobs/detail/JobTechnicalTab").JobTechnicalTab
>;
type JobEditTabProps = ComponentProps<
  typeof import("@/components/jobs/detail/JobEditTab").JobEditTab
>;

const JobExecutionTab = dynamic<JobExecutionTabProps>(
  () =>
    import("@/components/jobs/detail/JobExecutionTab").then(
      (mod) => mod.JobExecutionTab,
    ),
  { loading: () => <TabFallback label="execution details" /> },
);

const JobImproveTab = dynamic<JobImproveTabProps>(
  () =>
    import("@/components/jobs/detail/JobImproveTab").then(
      (mod) => mod.JobImproveTab,
    ),
  { loading: () => <TabFallback label="improvement insights" /> },
);

const JobTrackingTab = dynamic<JobTrackingTabProps>(
  () =>
    import("@/components/jobs/detail/JobTrackingTab").then(
      (mod) => mod.JobTrackingTab,
    ),
  { loading: () => <TabFallback label="activity data" /> },
);

const JobTechnicalTab = dynamic<JobTechnicalTabProps>(
  () =>
    import("@/components/jobs/detail/JobTechnicalTab").then(
      (mod) => mod.JobTechnicalTab,
    ),
  { loading: () => <TabFallback label="technical details" /> },
);

const JobEditTab = dynamic<JobEditTabProps>(
  () =>
    import("@/components/jobs/detail/JobEditTab").then(
      (mod) => mod.JobEditTab,
    ),
  { loading: () => <TabFallback label="lead magnet editor" /> },
);

const TAB_CONFIG = [
  {
    id: "overview",
    label: "Overview",
    description: "Key metrics and quick actions",
    badgeLabel: { singular: "Output", plural: "Outputs" },
    group: "general" as TabGroupId,
  },
  {
    id: "execution",
    label: "Execution",
    description: "Report generation steps",
    badgeLabel: { singular: "Step", plural: "Steps" },
    group: "workflow" as TabGroupId,
  },
  {
    id: "improve",
    label: "Improve",
    description: "Review & refine workflow",
    group: "workflow" as TabGroupId,
  },
  {
    id: "edit",
    label: "Edit",
    description: "Update lead magnet settings",
    group: "workflow" as TabGroupId,
  },
  {
    id: "tracking",
    label: "Activity",
    description: "Lead sessions & recordings",
    badgeLabel: { singular: "Session", plural: "Sessions" },
    group: "insights" as TabGroupId,
  },
  {
    id: "technical",
    label: "Technical",
    description: "IDs, inputs, artifacts, raw JSON",
    group: "advanced" as TabGroupId,
  },
] as const;

export type JobTabId = (typeof TAB_CONFIG)[number]["id"];

const DEFAULT_TAB: JobTabId = "overview";

const LEGACY_TAB_ALIASES: Record<string, JobTabId> = {
  summary: "overview",
  raw: "technical",
  debug: "technical",
};

const isJobTabId = (value: string | null): value is JobTabId =>
  TAB_CONFIG.some((tab) => tab.id === value);

export const resolveJobTabId = (value: string | null): JobTabId => {
  if (value && value in LEGACY_TAB_ALIASES) {
    return LEGACY_TAB_ALIASES[value];
  }
  if (isJobTabId(value)) {
    return value;
  }
  return DEFAULT_TAB;
};

interface JobTabsProps {
  job: Job;
  activeTab: JobTabId;
  buildTabHref: (tabId: JobTabId) => string;
  mergedSteps: MergedStep[];
  artifactGalleryItems: ArtifactGalleryItem[];
  workflow: Workflow | null;
  artifacts: Artifact[];
  stepsSummary: JobStepSummary;
  form: Form | null;
  expandedSteps: Set<number>;
  toggleStep: (stepOrder: number) => void;
  expandAllSteps: (stepOrders: number[]) => void;
  collapseAllSteps: () => void;
  executionStepsError: string | null;
  imageArtifactsByStep: Map<number, Artifact[]>;
  fileArtifactsByStep?: Map<number, Artifact[]>;
  loadingArtifacts: boolean;
  submission?: FormSubmission | null;
  onResubmit?: () => void;
  resubmitting?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  onCopy: (text: string) => void;
  onEditStep: (stepIndex: number) => void;
  onQuickUpdateStep?: (stepIndex: number, update: {
    model?: import("@/types/workflow").AIModel | null;
    service_tier?: import("@/types/workflow").ServiceTier | null;
    reasoning_effort?: import("@/types/workflow").ReasoningEffort | null;
    image_generation?: import("@/types/workflow").ImageGenerationSettings;
    tools?: import("@/types/workflow").Tool[] | null;
  }) => Promise<void>;
  updatingStepIndex?: number | null;
  onRerunStepClick: (stepIndex: number) => void;
  rerunningStep: number | null;
  openPreview: (item: ArtifactGalleryItem) => void;
  trackingSessionCount?: number | null;
  trackingSessionsLoading?: boolean;
  onTrackingSessionsLoaded?: (count: number) => void;
  onTrackingSessionsLoadingChange?: (loading: boolean) => void;
  onTrackingStatsLoaded?: (stats: TrackingStats | null) => void;
  onTrackingStatsLoadingChange?: (loading: boolean) => void;
  onEditExit?: () => void;
}

export function JobTabs({
  job,
  activeTab,
  buildTabHref,
  mergedSteps,
  artifactGalleryItems,
  workflow,
  artifacts,
  stepsSummary,
  form,
  expandedSteps,
  toggleStep,
  expandAllSteps,
  collapseAllSteps,
  executionStepsError,
  imageArtifactsByStep,
  fileArtifactsByStep,
  loadingArtifacts,
  submission,
  onResubmit,
  resubmitting,
  onRefresh,
  refreshing,
  onCopy,
  onEditStep,
  onQuickUpdateStep,
  updatingStepIndex,
  onRerunStepClick,
  rerunningStep,
  openPreview,
  trackingSessionCount,
  trackingSessionsLoading,
  onTrackingSessionsLoaded,
  onTrackingSessionsLoadingChange,
  onTrackingStatsLoaded,
  onTrackingStatsLoadingChange,
  onEditExit,
}: JobTabsProps) {
  const stepsBadge = stepsSummary.total;
  const artifactsBadge = artifactGalleryItems.length;
  const trackingBadge =
    trackingSessionsLoading && trackingSessionCount === null
      ? "…"
      : trackingSessionCount;
  const badgeValues: Partial<Record<JobTabId, number | string | null>> = {
    overview: artifactsBadge,
    execution: stepsBadge,
    tracking: trackingBadge,
  };

  const formatBadgeText = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return null;
    return String(value);
  };

  const tabs = TAB_CONFIG.map((tab) => ({
    id: tab.id,
    label: tab.label,
    href: buildTabHref(tab.id),
    badge:
      "badgeLabel" in tab ? formatBadgeText(badgeValues[tab.id]) : null,
  }));

  return (
    <section className="mt-4 sm:mt-5 flex flex-1 min-h-0 flex-col">
      <SubHeaderTabs
        tabs={tabs}
        activeId={activeTab}
        portalTargetId="dashboard-subheader"
        enableOverflowMenu
        mobileMaxVisible={3}
        compactMaxVisible={2}
        compactBreakpointPx={420}
      />
      <div className="min-w-0 pt-2 sm:pt-3 flex flex-1 min-h-0 flex-col overflow-hidden">
        {activeTab === "overview" && (
          <JobSummaryTab
            artifactGalleryItems={artifactGalleryItems}
            loadingArtifacts={loadingArtifacts}
            onPreview={openPreview}
          />
        )}
        {activeTab === "execution" && (
          <JobExecutionTab
            job={job}
            mergedSteps={mergedSteps}
            expandedSteps={expandedSteps}
            onToggleStep={toggleStep}
            onExpandAllSteps={expandAllSteps}
            onCollapseAllSteps={collapseAllSteps}
            executionStepsError={executionStepsError}
            onRefresh={onRefresh}
            refreshing={refreshing}
            onCopy={onCopy}
            imageArtifactsByStep={imageArtifactsByStep}
            fileArtifactsByStep={fileArtifactsByStep}
            loadingArtifacts={loadingArtifacts}
            submission={submission}
            onResubmit={onResubmit}
            resubmitting={resubmitting}
            onEditStep={onEditStep}
            onQuickUpdateStep={onQuickUpdateStep}
            updatingStepIndex={updatingStepIndex}
            onRerunStepClick={onRerunStepClick}
            rerunningStep={rerunningStep}
            artifactGalleryItems={artifactGalleryItems}
            onPreview={openPreview}
          />
        )}
        {activeTab === "improve" && (
          <JobImproveTab
            job={job}
            workflow={workflow}
            mergedSteps={mergedSteps}
            artifacts={artifacts}
          />
        )}
        {activeTab === "edit" && (
          <JobEditTab workflow={workflow} onExit={onEditExit} />
        )}
        {activeTab === "tracking" && (
          <JobTrackingTab
            jobId={job.job_id}
            onSessionsLoaded={onTrackingSessionsLoaded}
            onSessionsLoadingChange={onTrackingSessionsLoadingChange}
            onStatsLoaded={onTrackingStatsLoaded}
            onStatsLoadingChange={onTrackingStatsLoadingChange}
          />
        )}
        {activeTab === "technical" && (
          <JobTechnicalTab job={job} form={form} submission={submission} />
        )}
      </div>
    </section>
  );
}
