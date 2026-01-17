import { SubHeaderTabs } from "@/components/ui/SubHeaderTabs";
import { JobExecutionTab } from "@/components/jobs/detail/JobExecutionTab";
import { JobSummaryTab } from "@/components/jobs/detail/JobSummaryTab";
import { JobImproveTab } from "@/components/jobs/detail/JobImproveTab";
import { JobTrackingTab } from "@/components/jobs/detail/JobTrackingTab";
import { JobTechnicalTab } from "@/components/jobs/detail/JobTechnicalTab";
import { JobDebugTab } from "@/components/jobs/detail/JobDebugTab";
import type { JobDurationInfo } from "@/components/jobs/detail/JobOverviewSection";
import type {
  ArtifactGalleryItem,
  Job,
  JobStepSummary,
  MergedStep,
} from "@/types/job";
import type { Workflow } from "@/types/workflow";
import type { Form, FormSubmission } from "@/types/form";
import type { Artifact } from "@/types/artifact";

type TabGroupId = "general" | "workflow" | "insights" | "advanced";

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
    id: "tracking",
    label: "Activity",
    description: "Lead sessions & recordings",
    badgeLabel: { singular: "Session", plural: "Sessions" },
    group: "insights" as TabGroupId,
  },
  {
    id: "technical",
    label: "Technical",
    description: "IDs, inputs, artifacts",
    group: "advanced" as TabGroupId,
  },
  {
    id: "raw",
    label: "Debug",
    description: "Raw execution payload",
    group: "advanced" as TabGroupId,
  },
] as const;

export type JobTabId = (typeof TAB_CONFIG)[number]["id"];

const DEFAULT_TAB: JobTabId = "overview";

const LEGACY_TAB_ALIASES: Record<string, JobTabId> = {
  summary: "overview",
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
  jobDuration?: JobDurationInfo | null;
  totalCost?: number | null;
  form: Form | null;
  onSelectExecutionTab: () => void;
  expandedSteps: Set<number>;
  toggleStep: (stepOrder: number) => void;
  executionStepsError: string | null;
  imageArtifactsByStep: Map<number, Artifact[]>;
  loadingArtifacts: boolean;
  submission?: FormSubmission | null;
  onResubmit?: () => void;
  resubmitting?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  onCopy: (text: string) => void;
  onEditStep: (stepIndex: number) => void;
  onRerunStepClick: (stepIndex: number) => void;
  rerunningStep: number | null;
  openPreview: (item: ArtifactGalleryItem) => void;
  trackingSessionCount?: number | null;
  trackingSessionsLoading?: boolean;
  onTrackingSessionsLoaded?: (count: number) => void;
  onTrackingSessionsLoadingChange?: (loading: boolean) => void;
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
  jobDuration,
  totalCost,
  form,
  onSelectExecutionTab,
  expandedSteps,
  toggleStep,
  executionStepsError,
  imageArtifactsByStep,
  loadingArtifacts,
  submission,
  onResubmit,
  resubmitting,
  onRefresh,
  refreshing,
  onCopy,
  onEditStep,
  onRerunStepClick,
  rerunningStep,
  openPreview,
  trackingSessionCount,
  trackingSessionsLoading,
  onTrackingSessionsLoaded,
  onTrackingSessionsLoadingChange,
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
    <section className="mt-6">
      <SubHeaderTabs
        tabs={tabs}
        activeId={activeTab}
        portalTargetId="dashboard-subheader"
        enableOverflowMenu
        mobileMaxVisible={3}
        compactMaxVisible={2}
        compactBreakpointPx={420}
      />
      <div className="min-w-0 pt-6">
        {activeTab === "overview" && (
          <JobSummaryTab
            job={job}
            workflow={workflow}
            stepsSummary={stepsSummary}
            artifactCount={artifactGalleryItems.length}
            jobDuration={jobDuration}
            totalCost={totalCost}
            onSelectExecutionTab={onSelectExecutionTab}
          />
        )}
        {activeTab === "execution" && (
          <JobExecutionTab
            job={job}
            mergedSteps={mergedSteps}
            expandedSteps={expandedSteps}
            onToggleStep={toggleStep}
            executionStepsError={executionStepsError}
            onRefresh={onRefresh}
            refreshing={refreshing}
            onCopy={onCopy}
            imageArtifactsByStep={imageArtifactsByStep}
            loadingArtifacts={loadingArtifacts}
            submission={submission}
            onResubmit={onResubmit}
            resubmitting={resubmitting}
            onEditStep={onEditStep}
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
        {activeTab === "tracking" && (
          <JobTrackingTab
            jobId={job.job_id}
            onSessionsLoaded={onTrackingSessionsLoaded}
            onSessionsLoadingChange={onTrackingSessionsLoadingChange}
          />
        )}
        {activeTab === "technical" && (
          <JobTechnicalTab job={job} form={form} submission={submission} />
        )}
        {activeTab === "raw" && <JobDebugTab data={job} />}
      </div>
    </section>
  );
}
