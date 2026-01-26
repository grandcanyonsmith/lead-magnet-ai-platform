"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { JobSummaryTab } from "@/components/jobs/detail/JobSummaryTab";
import { RecursiveTabs, TabNode } from "@/components/ui/recursive/RecursiveTabs";
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
import type { ComponentProps } from "react";

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
  const router = useRouter();
  
  const stepsBadge = stepsSummary.total;
  const artifactsBadge = artifactGalleryItems.length;
  const trackingBadge =
    trackingSessionsLoading && trackingSessionCount === null
      ? 0 // Use 0 or undefined for loading state in generic tabs
      : trackingSessionCount ?? 0;
      
  const badgeValues: Partial<Record<JobTabId, number>> = {
    overview: artifactsBadge,
    execution: stepsBadge,
    tracking: typeof trackingBadge === 'number' ? trackingBadge : 0,
  };

  const tabs: TabNode[] = useMemo(() => [
    {
      id: "overview",
      label: "Overview",
      badge: badgeValues.overview,
      content: (
        <JobSummaryTab
          artifactGalleryItems={artifactGalleryItems}
          loadingArtifacts={loadingArtifacts}
          onPreview={openPreview}
        />
      ),
    },
    {
      id: "execution",
      label: "Execution",
      badge: badgeValues.execution,
      content: (
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
      ),
    },
    {
      id: "improve",
      label: "Improve",
      content: (
        <JobImproveTab
          job={job}
          workflow={workflow}
          mergedSteps={mergedSteps}
          artifacts={artifacts}
        />
      ),
    },
    {
      id: "edit",
      label: "Edit",
      content: <JobEditTab workflow={workflow} onExit={onEditExit} />,
    },
    {
      id: "tracking",
      label: "Activity",
      badge: badgeValues.tracking,
      content: (
        <JobTrackingTab
          jobId={job.job_id}
          onSessionsLoaded={onTrackingSessionsLoaded}
          onSessionsLoadingChange={onTrackingSessionsLoadingChange}
          onStatsLoaded={onTrackingStatsLoaded}
          onStatsLoadingChange={onTrackingStatsLoadingChange}
        />
      ),
    },
    {
      id: "technical",
      label: "Technical",
      content: <JobTechnicalTab job={job} form={form} submission={submission} />,
    },
  ], [
    artifactGalleryItems, loadingArtifacts, openPreview,
    job, mergedSteps, expandedSteps, toggleStep, expandAllSteps, collapseAllSteps, executionStepsError, onRefresh, refreshing, onCopy, imageArtifactsByStep, fileArtifactsByStep, submission, onResubmit, resubmitting, onEditStep, onQuickUpdateStep, updatingStepIndex, onRerunStepClick, rerunningStep,
    workflow, artifacts,
    onEditExit,
    onTrackingSessionsLoaded, onTrackingSessionsLoadingChange, onTrackingStatsLoaded, onTrackingStatsLoadingChange,
    badgeValues, form
  ]);

  const handleTabChange = (id: string) => {
    const href = buildTabHref(id as JobTabId);
    router.push(href);
  };

  return (
    <section className="mt-4 sm:mt-5 flex flex-1 min-h-0 flex-col">
      <RecursiveTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        className="h-full"
        tabListClassName="bg-transparent border-b border-border mb-4"
        tabContentClassName="flex-1 overflow-hidden"
      />
    </section>
  );
}
