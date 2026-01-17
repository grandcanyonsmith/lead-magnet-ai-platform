import Link from "next/link";
import {
  BugAntIcon,
  ChartBarIcon,
  CpuChipIcon,
  DocumentTextIcon,
  PlayCircleIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

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

const TAB_GROUPS = [
  { id: "general", label: "General" },
  { id: "workflow", label: "Workflow" },
  { id: "insights", label: "Engagement" },
  { id: "advanced", label: "Advanced" },
] as const;

type TabGroupId = (typeof TAB_GROUPS)[number]["id"];

const TAB_CONFIG = [
  {
    id: "overview",
    label: "Overview",
    description: "Key metrics and quick actions",
    icon: DocumentTextIcon,
    badgeLabel: { singular: "Output", plural: "Outputs" },
    group: "general" as TabGroupId,
  },
  {
    id: "execution",
    label: "Execution",
    description: "Report generation steps",
    icon: PlayCircleIcon,
    badgeLabel: { singular: "Step", plural: "Steps" },
    group: "workflow" as TabGroupId,
  },
  {
    id: "improve",
    label: "Improve",
    description: "Review & refine workflow",
    icon: SparklesIcon,
    group: "workflow" as TabGroupId,
  },
  {
    id: "tracking",
    label: "Activity",
    description: "Lead sessions & recordings",
    icon: ChartBarIcon,
    badgeLabel: { singular: "Session", plural: "Sessions" },
    group: "insights" as TabGroupId,
  },
  {
    id: "technical",
    label: "Technical",
    description: "IDs, inputs, artifacts",
    icon: CpuChipIcon,
    group: "advanced" as TabGroupId,
  },
  {
    id: "raw",
    label: "Debug",
    description: "Raw execution payload",
    icon: BugAntIcon,
    group: "advanced" as TabGroupId,
  },
] as const;

export type JobTabId = (typeof TAB_CONFIG)[number]["id"];

type TabBadgeLabel = {
  singular: string;
  plural: string;
};

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

  const formatBadgeText = (
    value: number | string | null | undefined,
    label?: TabBadgeLabel,
  ) => {
    if (value === null || value === undefined || !label) return null;
    if (typeof value === "number") {
      return `${value} ${value === 1 ? label.singular : label.plural}`;
    }
    if (value === "…") {
      return value;
    }
    return `${value} ${label.plural}`;
  };

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <nav role="tablist" aria-label="Job detail sections" className="space-y-4">
            {TAB_GROUPS.map((group) => {
              const groupTabs = TAB_CONFIG.filter((tab) => tab.group === group.id);
              if (!groupTabs.length) {
                return null;
              }
              return (
                <div key={group.id} className="space-y-1">
                  <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {groupTabs.map((tab) => {
                      const isActive = activeTab === tab.id;
                      const badgeValue = badgeValues[tab.id];
                      const badgeText =
                        "badgeLabel" in tab
                          ? formatBadgeText(badgeValue, tab.badgeLabel)
                          : null;
                      const Icon = tab.icon;
                      return (
                        <Link
                          key={tab.id}
                          href={buildTabHref(tab.id)}
                          aria-current={isActive ? "page" : undefined}
                          role="tab"
                          aria-selected={isActive}
                          className={`group flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                            isActive
                              ? "bg-primary/10 text-foreground"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border text-xs transition-colors ${
                              isActive
                                ? "border-primary/30 bg-background text-primary-600 dark:text-primary-300"
                                : "border-border bg-muted/40 text-muted-foreground group-hover:border-primary/20"
                            }`}
                            aria-hidden="true"
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="flex-1 space-y-0.5">
                            <span className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-foreground">
                                {tab.label}
                              </span>
                              {badgeText && (
                                <span
                                  className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                    isActive
                                      ? "border-primary/20 bg-primary/10 text-primary-700 dark:text-primary-300"
                                      : "border-transparent bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {badgeText}
                                </span>
                              )}
                            </span>
                            <span className="hidden text-xs text-muted-foreground sm:block">
                              {tab.description}
                            </span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>
      </aside>
      <div className="min-w-0">
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
    </div>
  );
}
