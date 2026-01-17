import { useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
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

type TabBadgeLabel = {
  singular: string;
  plural: string;
};

const DEFAULT_TAB: JobTabId = "overview";
const MOBILE_VISIBLE_TABS: JobTabId[] = ["overview", "execution", "improve"];
const COMPACT_VISIBLE_TABS: JobTabId[] = ["overview", "execution"];

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
      return String(value);
    }
    if (value === "…") {
      return value;
    }
    return String(value);
  };

  const [isCompact, setIsCompact] = useState(false);
  const [mobileVisibleTabs, setMobileVisibleTabs] =
    useState<JobTabId[]>(MOBILE_VISIBLE_TABS);

  const swapIntoMobileTabs = (tabs: JobTabId[], tabId: JobTabId) => {
    if (tabs.includes(tabId)) return tabs;
    if (tabs.length === 0) return [tabId];
    const swapIndex = Math.max(tabs.length - 2, 0);
    const next = [...tabs];
    next[swapIndex] = tabId;
    return next;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 420px)");
    const update = () => setIsCompact(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setMobileVisibleTabs((prev) => {
      const target = isCompact ? COMPACT_VISIBLE_TABS : MOBILE_VISIBLE_TABS;
      return target.map((tabId) => prev.find((id) => id === tabId) || tabId);
    });
  }, [isCompact]);

  useEffect(() => {
    setMobileVisibleTabs((prev) => swapIntoMobileTabs(prev, activeTab));
  }, [activeTab]);

  const effectiveVisibleTabs = isCompact
    ? mobileVisibleTabs.slice(0, COMPACT_VISIBLE_TABS.length)
    : mobileVisibleTabs;
  const mobileTabs = TAB_CONFIG.filter((tab) =>
    effectiveVisibleTabs.includes(tab.id),
  );
  const overflowTabs = TAB_CONFIG.filter(
    (tab) => !effectiveVisibleTabs.includes(tab.id),
  );

  const renderTabLink = (tab: (typeof TAB_CONFIG)[number]) => {
    const isActive = activeTab === tab.id;
    const badgeValue = badgeValues[tab.id];
    const badgeText =
      "badgeLabel" in tab ? formatBadgeText(badgeValue, tab.badgeLabel) : null;

    const tabClasses = cn(
      "relative flex items-center gap-2 pb-2 text-xs font-semibold text-muted-foreground transition-all duration-150 ease-out sm:text-sm",
      "after:absolute after:inset-x-0 after:-bottom-[1px] after:h-0.5 after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-200",
      isActive
        ? "text-foreground after:scale-x-100"
        : "hover:text-foreground hover:after:scale-x-100 hover:-translate-y-0.5"
    );

    return (
      <Link
        key={tab.id}
        href={buildTabHref(tab.id)}
        aria-current={isActive ? "page" : undefined}
        role="tab"
        aria-selected={isActive}
        className={tabClasses}
      >
        <span>{tab.label}</span>
        {badgeText && (
          <span
            className={cn(
              "whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground sm:text-[11px]",
              isActive && "bg-primary/10 text-primary-700 dark:text-primary-300"
            )}
          >
            {badgeText}
          </span>
        )}
      </Link>
    );
  };

  const subHeaderTarget =
    typeof document === "undefined"
      ? null
      : document.getElementById("dashboard-subheader");
  const shouldPortal = Boolean(subHeaderTarget);
  const tabNav = (
    <div
      className={cn(
        "border-b border-border/60 bg-muted/20",
        shouldPortal ? "" : "-mx-3 sm:-mx-4 md:-mx-6 lg:-mx-8"
      )}
    >
      <div className="px-6 sm:px-8 lg:px-12">
        <nav
          role="tablist"
          aria-label="Job detail sections"
          className="flex w-full items-center overflow-x-auto py-2 scrollbar-hide"
        >
          <div className="inline-flex items-center gap-6 sm:hidden">
            {mobileTabs.map(renderTabLink)}
            {overflowTabs.length > 0 && (
              <>
                <span className="h-5 w-px bg-border/60" aria-hidden="true" />
                <div className="relative">
                  <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex items-center gap-1 pb-2 text-xs font-semibold text-muted-foreground transition-all duration-150 ease-out hover:text-foreground hover:-translate-y-0.5">
                    <span>More</span>
                    <ChevronDown className="h-3 w-3" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="bottom" className="w-44">
                    {overflowTabs.map((tab) => {
                      const badgeValue = badgeValues[tab.id];
                      const badgeText =
                        "badgeLabel" in tab
                          ? formatBadgeText(badgeValue, tab.badgeLabel)
                          : null;
                      return (
                        <DropdownMenuItem key={tab.id} className="transition-colors">
                          <Link
                            href={buildTabHref(tab.id)}
                            className="flex w-full items-center justify-between gap-2"
                            onClick={() =>
                              setMobileVisibleTabs((prev) =>
                                swapIntoMobileTabs(prev, tab.id),
                              )
                            }
                          >
                            <span>{tab.label}</span>
                            {badgeText && (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                {badgeText}
                              </span>
                            )}
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </>
            )}
          </div>
          <div className="hidden sm:inline-flex items-center gap-6">
            {TAB_CONFIG.map(renderTabLink)}
          </div>
        </nav>
      </div>
    </div>
  );

  return (
    <section className="mt-6">
      {shouldPortal && subHeaderTarget
        ? createPortal(tabNav, subHeaderTarget)
        : tabNav}
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
