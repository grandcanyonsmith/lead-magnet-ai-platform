import { useState } from "react";
import { PreviewCard } from "@/components/artifacts/PreviewCard";
import { OutputCardActions } from "@/components/jobs/detail/OutputCardActions";
import { OutputPreview } from "@/components/jobs/detail/OutputPreview";
import { SecondaryNavigation } from "@/components/ui/SecondaryNavigation";
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
  const outputsRowClassName = isHtmlGroup
    ? "grid gap-4"
    : "grid grid-cols-2 gap-2 sm:gap-3";
  const outputCardClassName = "group flex w-full flex-col text-left";
  const previewSizeClass = isHtmlGroup
    ? "min-h-[50vh] sm:min-h-[55vh] lg:min-h-[60vh]"
    : "aspect-[1/1] sm:aspect-[3/4]";
  const outputsAriaLabel = isLogsGroup
    ? "Logs"
    : `${activeGroup.label} outputs`;
  const outputRows = [activeGroup.items];
  const visibleRows = outputRows.filter((row) => row.length);
  const emptyStateLabel = isLogsGroup
    ? "logs"
    : `${activeGroup.label.toLowerCase()} outputs`;

  return (
    <section className="mb-4 sm:mb-6 space-y-5">
      {showOutputsRow && (
        <div className="space-y-2">
          {loadingArtifacts && !hasOutputs ? (
            <div className="grid grid-cols-2 gap-2 pb-2 sm:gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`output-skeleton-${index}`}
                  className="w-full animate-pulse space-y-2"
                >
                  <div className="aspect-[1/1] w-full rounded-xl bg-muted/60 sm:aspect-[3/4]" />
                  <div className="h-3 w-3/4 rounded bg-muted/60" />
                  <div className="h-2.5 w-1/2 rounded bg-muted/50" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <SecondaryNavigation
                  items={outputGroups.map((group) => ({
                    id: group.key,
                    label: group.label,
                    badge: group.count,
                    badgeClassName: group.badgeClassName,
                  }))}
                  activeId={activeOutputGroup}
                  onSelect={(id) => setActiveOutputGroup(id as OutputGroupKey)}
                  ariaLabel="Output types"
                />
              </div>

              {activeGroup.items.length > 0 ? (
                <div>
                  {visibleRows.map((row, rowIndex) => (
                    <div
                      key={`outputs-row-${rowIndex}`}
                      className={outputsRowClassName}
                      role="list"
                      aria-label={
                        isHtmlGroup
                          ? outputsAriaLabel
                          : `${outputsAriaLabel} row ${rowIndex + 1}`
                      }
                    >
                      {row.map((item) => {
                        const preview = getOutputPreviewMeta(item);
                        const showDescription = shouldShowOutputDescription(
                          activeGroup.key,
                          item.description,
                        );
                        const displayLabel = getOutputLabel(item, activeGroup.key);
                        const outputUrl = getOutputUrl(item);
                        return (
                          <PreviewCard
                            key={item.id}
                            title={displayLabel}
                            description={item.description}
                            showDescription={showDescription}
                            preview={
                              <OutputPreview
                                groupKey={activeGroup.key}
                                preview={preview}
                                className="h-full w-full"
                              />
                            }
                            actions={
                              outputUrl ? <OutputCardActions url={outputUrl} /> : null
                            }
                            onClick={onPreview ? () => onPreview(item) : undefined}
                            className={outputCardClassName}
                            previewClassName={previewSizeClass}
                          />
                        );
                      })}
                    </div>
                  ))}
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
