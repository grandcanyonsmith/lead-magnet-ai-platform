import React from "react";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import type { Workflow, WorkflowVersionSummary, WorkflowStep } from "@/types";

interface VersionDetailsProps {
  selectedVersion: number | null;
  currentVersion: number | null;
  selectedVersionSummary: WorkflowVersionSummary | null;
  workflow: Workflow | null;
  workflowTitle: string;
  selectedVersionJobsCount: number;
  formatTimestamp: (value?: string) => string;
  versionDetailsLoading: number | null;
  selectedVersionSteps: WorkflowStep[];
}

export function VersionDetails({
  selectedVersion,
  currentVersion,
  selectedVersionSummary,
  workflow,
  workflowTitle,
  selectedVersionJobsCount,
  formatTimestamp,
  versionDetailsLoading,
  selectedVersionSteps,
}: VersionDetailsProps) {
  return (
    <div className="space-y-4 lg:col-span-8 xl:col-span-9">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.65fr)_minmax(0,0.35fr)] xl:items-start">
        <SectionCard
          title="Selected version"
          description="Details for the version you are reviewing."
          padding="sm"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-3xl font-semibold text-foreground">
                {selectedVersion ? `v${selectedVersion}` : "—"}
              </span>
              {selectedVersion === currentVersion ? (
                <Badge variant="success">Active</Badge>
              ) : null}
              {selectedVersionSummary?.template_version ? (
                <Badge variant="secondary">
                  Template v{selectedVersionSummary.template_version}
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              Saved {formatTimestamp(selectedVersionSummary?.created_at)}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Lead magnet</p>
                <p
                  className="mt-1 truncate text-sm font-medium text-foreground"
                  title={workflow?.workflow_name || undefined}
                >
                  {workflowTitle}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Steps</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {selectedVersionSummary
                    ? selectedVersionSummary.step_count
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Template</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {selectedVersionSummary
                    ? selectedVersionSummary.template_version
                      ? `v${selectedVersionSummary.template_version}`
                      : "None"
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  Jobs generated
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {selectedVersion ? selectedVersionJobsCount : "—"}
                </p>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="About restores"
          description="Restores create a new version."
          padding="sm"
          className="border-dashed bg-muted/20"
        >
          <ul className="list-disc space-y-2 pl-4 text-sm text-muted-foreground">
            <li>Restoring does not delete existing versions.</li>
            <li>The restored configuration becomes the latest version.</li>
            <li>Make sure to review steps after a restore.</li>
          </ul>
        </SectionCard>
      </div>

      <SectionCard
        title="Execution step instructions"
        description="See the saved instructions for each step in this version."
        padding="sm"
        contentClassName="xl:max-h-[520px] xl:overflow-y-auto xl:pr-1"
      >
        {!selectedVersion ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            Select a version to view its step instructions.
          </div>
        ) : versionDetailsLoading === selectedVersion ? (
          <div
            className="flex items-center gap-2 text-sm text-muted-foreground"
            role="status"
          >
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
              aria-hidden="true"
            />
            Loading step instructions...
          </div>
        ) : selectedVersionSteps.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            No steps are available for this version.
          </div>
        ) : (
          <div className="space-y-4">
            {selectedVersionSteps.map((step, index) => {
              const stepLabel = step.step_name || `Step ${index + 1}`;
              return (
                <div
                  key={`${step.step_name}-${index}`}
                  className="rounded-xl border bg-card/60 px-4 py-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {stepLabel}
                      </p>
                      {step.step_description ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {step.step_description}
                        </p>
                      ) : null}
                    </div>
                    <Badge variant="outline">Step {index + 1}</Badge>
                  </div>
                  <div className="mt-3 rounded-lg border bg-background/80 px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Instructions
                    </p>
                    <pre className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground font-sans">
                      {step.instructions || "—"}
                    </pre>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
