import Link from "next/link";
import { cn } from "@/lib/utils";
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
    <section className="mt-6">
      <div className="-mx-3 border-b border-border/60 bg-muted/20 sm:-mx-4 md:-mx-6 lg:-mx-8">
        <div className="px-3 sm:px-4 md:px-6 lg:px-8">
          <nav
            role="tablist"
            aria-label="Job detail sections"
            className="flex items-center gap-6 overflow-x-auto py-2"
          >
            {TAB_GROUPS.map((group, groupIndex) => {
              const groupTabs = TAB_CONFIG.filter((tab) => tab.group === group.id);
              if (!groupTabs.length) {
                return null;
              }
              return (
                <div key={group.id} className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </span>
                  <div className="flex items-center gap-2">
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
                          className={cn(
                            "inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
                            isActive
                              ? "border-border bg-background text-foreground shadow-sm"
                              : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-background/60 hover:text-foreground"
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4",
                              isActive ? "text-primary" : "text-muted-foreground"
                            )}
                            aria-hidden="true"
                          />
                          <span>{tab.label}</span>
                          {badgeText && (
                            <span
                              className={cn(
                                "whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-[11px]",
                                isActive
                                  ? "bg-primary/10 text-primary-700 dark:text-primary-300"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {badgeText}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                  {groupIndex < TAB_GROUPS.length - 1 && (
                    <span
                      className="mx-2 hidden h-5 w-px bg-border/60 sm:inline-block"
                      aria-hidden="true"
                    />
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </div>
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
