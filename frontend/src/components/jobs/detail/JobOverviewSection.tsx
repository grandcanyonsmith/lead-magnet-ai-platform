import { useState } from "react";
import { OutputCard } from "@/components/jobs/detail/OutputCard";
import { OutputGroupTabs } from "@/components/jobs/detail/OutputGroupTabs";
import type { ArtifactGalleryItem } from "@/types/job";
import {
  buildOutputGroups,
  getOutputLabel,
  getOutputPreviewMeta,
  getOutputUrl,
  shouldShowOutputDescription,
  type OutputGroupKey,
} from "@/utils/jobs/outputs";

interface JobOverviewSectionProps {
  artifactGalleryItems: ArtifactGalleryItem[];
  loadingArtifacts?: boolean;
  onPreview?: (item: ArtifactGalleryItem) => void;
}

export function JobOverviewSection({
  artifactGalleryItems,
  loadingArtifacts = false,
  onPreview,
}: JobOverviewSectionProps) {
  const hasOutputs = artifactGalleryItems.length > 0;
  const showOutputsRow = hasOutputs || loadingArtifacts;
  const outputGroups = buildOutputGroups(artifactGalleryItems);

  const [activeOutputGroup, setActiveOutputGroup] = useState<OutputGroupKey>(() => {
    const firstWithItems = outputGroups.find((group) => group.items.length > 0);
    return firstWithItems?.key || "html";
  });
  const fallbackGroup = outputGroups[0] ?? buildOutputGroups([])[0]!;
  const activeGroup =
    outputGroups.find((group) => group.key === activeOutputGroup) ||
    fallbackGroup;
  const isHtmlGroup = activeGroup.key === "html";
  const isLogsGroup = activeGroup.key === "logs";
  const outputsListClassName = isHtmlGroup
    ? "grid gap-4"
    : "grid grid-flow-col auto-cols-[16rem] grid-rows-2 gap-3 overflow-x-auto pb-2 pl-3 pr-1 sm:-mx-1 sm:px-1 snap-x snap-mandatory scrollbar-hide";
  const outputCardClassName = isHtmlGroup
    ? "group flex w-full flex-col text-left"
    : "group flex w-64 flex-shrink-0 snap-start flex-col text-left";
  const previewSizeClass = isHtmlGroup
    ? "min-h-[50vh] sm:min-h-[55vh] lg:min-h-[60vh]"
    : "aspect-[3/4]";
  const outputsAriaLabel = isLogsGroup
    ? "Logs"
    : `${activeGroup.label} outputs`;
  const emptyStateLabel = isLogsGroup
    ? "logs"
    : `${activeGroup.label.toLowerCase()} outputs`;

  return (
    <section className="mb-4 sm:mb-6 space-y-5">
      {showOutputsRow && (
        <div className="space-y-2">
          {loadingArtifacts && !hasOutputs ? (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`output-skeleton-${index}`}
                  className="w-56 flex-shrink-0 animate-pulse space-y-2"
                >
                  <div className="aspect-[3/4] w-full rounded-xl bg-muted/60" />
                  <div className="h-3 w-3/4 rounded bg-muted/60" />
                  <div className="h-2.5 w-1/2 rounded bg-muted/50" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <OutputGroupTabs
                  groups={outputGroups}
                  activeKey={activeOutputGroup}
                  onChange={setActiveOutputGroup}
                />
              </div>

              {activeGroup.items.length > 0 ? (
                <div
                  className={outputsListClassName}
                  role="list"
                  aria-label={outputsAriaLabel}
                >
                  {activeGroup.items.map((item) => {
                    const preview = getOutputPreviewMeta(item);
                    const showDescription = shouldShowOutputDescription(
                      activeGroup.key,
                      item.description,
                    );
                    const displayLabel = getOutputLabel(item, activeGroup.key);
                    const outputUrl = getOutputUrl(item);
                    return (
                      <OutputCard
                        key={item.id}
                        item={item}
                        groupKey={activeGroup.key}
                        preview={preview}
                        displayLabel={displayLabel}
                        description={item.description}
                        showDescription={showDescription}
                        outputUrl={outputUrl || undefined}
                        onPreview={onPreview}
                        className={outputCardClassName}
                        previewClassName={previewSizeClass}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
                  No {emptyStateLabel} yet.
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </section>
  );
}
