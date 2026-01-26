import React from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import type { WorkflowVersionSummary, Job } from "@/types";

interface VersionListProps {
  sortedVersions: WorkflowVersionSummary[];
  currentVersion: number | null;
  selectedVersion: number | null;
  setSelectedVersion: (version: number) => void;
  jobsByVersion: Record<number, Job[]>;
  restoringVersion: number | null;
  handleRestore: (version: number) => void;
  formatTimestamp: (value?: string) => string;
}

export function VersionList({
  sortedVersions,
  currentVersion,
  selectedVersion,
  setSelectedVersion,
  jobsByVersion,
  restoringVersion,
  handleRestore,
  formatTimestamp,
}: VersionListProps) {
  return (
    <SectionCard
      title={`All versions (${sortedVersions.length})`}
      description="Restore an earlier configuration to create a new version."
      padding="sm"
      className="lg:col-span-4 xl:col-span-3 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-hidden"
      contentClassName="max-h-[300px] overflow-y-auto lg:max-h-[calc(100vh-14rem)] lg:pr-1"
    >
      {sortedVersions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
          No versions found yet.
        </div>
      ) : (
        <div className="space-y-3">
          {sortedVersions.map((version) => {
            const isCurrent = version.version === currentVersion;
            const isSelected = version.version === selectedVersion;
            const versionJobsCount =
              jobsByVersion[version.version]?.length ?? 0;
            const versionMeta = [
              `Saved ${formatTimestamp(version.created_at)}`,
              `${version.step_count} steps`,
              version.template_version
                ? `template v${version.template_version}`
                : "no template version",
            ].join(" • ");
            return (
              <div
                key={version.version}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedVersion(version.version)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedVersion(version.version);
                  }
                }}
                className={`group flex w-full cursor-pointer flex-col gap-3 rounded-xl border px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 sm:flex-row sm:items-center sm:justify-between ${
                  isSelected
                    ? "border-primary/40 bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/30"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      v{version.version}
                    </span>
                    {isCurrent ? (
                      <Badge variant="success">Current</Badge>
                    ) : null}
                    {isSelected ? (
                      <Badge
                        variant="outline"
                        className="border-primary/40 text-primary"
                      >
                        Selected
                      </Badge>
                    ) : null}
                    {versionJobsCount > 0 ? (
                      <Badge variant="secondary">
                        {versionJobsCount} jobs
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {versionMeta}
                  </div>
                </div>

                {!isCurrent ? (
                  <Button
                    variant="outline"
                    size="sm"
                    isLoading={restoringVersion === version.version}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRestore(version.version);
                    }}
                    className="shrink-0"
                  >
                    Restore
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
