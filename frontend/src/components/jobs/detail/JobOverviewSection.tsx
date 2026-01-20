import { useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";
import { PreviewRenderer } from "@/components/artifacts/PreviewRenderer";
import type { ArtifactGalleryItem } from "@/types/job";

export interface JobDurationInfo {
  seconds: number;
  label: string;
  isLive: boolean;
}

interface JobOverviewSectionProps {
  artifactGalleryItems: ArtifactGalleryItem[];
  loadingArtifacts?: boolean;
  onPreview?: (item: ArtifactGalleryItem) => void;
}

type OutputGroupKey = "step_output" | "image" | "html";

const OUTPUT_GROUPS: Array<{ key: OutputGroupKey; label: string }> = [
  { key: "html", label: "HTML" },
  { key: "image", label: "Images" },
  { key: "step_output", label: "Other" },
];

const getArtifactFileName = (item: ArtifactGalleryItem) =>
  item.artifact?.file_name || item.artifact?.artifact_name || item.label || "";

const getArtifactUrl = (item: ArtifactGalleryItem) =>
  item.artifact?.object_url || item.artifact?.public_url || item.url || "";

const isImageOutput = (item: ArtifactGalleryItem) => {
  const artifactType = String(item.artifact?.artifact_type || "").toLowerCase();
  const contentType = String(item.artifact?.content_type || "").toLowerCase();
  return (
    item.kind === "imageUrl" ||
    item.kind === "imageArtifact" ||
    contentType.startsWith("image/") ||
    artifactType.includes("image")
  );
};

const isHtmlOutput = (item: ArtifactGalleryItem) => {
  const artifactType = String(item.artifact?.artifact_type || "").toLowerCase();
  const contentType = String(item.artifact?.content_type || "").toLowerCase();
  const fileName = getArtifactFileName(item).toLowerCase();
  const rawUrl = getArtifactUrl(item);
  const normalizedUrlPath = (() => {
    try {
      return rawUrl ? new URL(rawUrl).pathname.toLowerCase() : "";
    } catch {
      return String(rawUrl || "").toLowerCase();
    }
  })();

  return (
    artifactType.includes("html") ||
    contentType.includes("text/html") ||
    fileName.endsWith(".html") ||
    fileName.endsWith(".htm") ||
    normalizedUrlPath.endsWith(".html") ||
    normalizedUrlPath.endsWith(".htm")
  );
};

const getOutputGroup = (item: ArtifactGalleryItem): OutputGroupKey => {
  if (isImageOutput(item)) return "image";
  if (isHtmlOutput(item)) return "html";
  return "step_output";
};

const formatOutputLabel = (item: ArtifactGalleryItem, groupKey: OutputGroupKey) => {
  const rawLabel = String(item.label || "").trim();
  const fileName = getArtifactFileName(item);
  const fileLabel = fileName.replace(/\.(html?|pdf)$/i, "").trim();

  if (groupKey === "html") {
    const cleanHtmlLabel = (value: string) =>
      value
        .replace(/html\s*final/gi, "")
        .replace(/[-_:]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const cleaned = cleanHtmlLabel(rawLabel);
    const cleanedFileLabel = cleanHtmlLabel(fileLabel);
    return cleaned || cleanedFileLabel || "HTML output";
  }

  return rawLabel || fileLabel;
};

const TYPE_DESCRIPTIONS_BY_GROUP: Record<OutputGroupKey, string[]> = {
  step_output: ["step output", "step outputs", "output", "outputs"],
  image: ["image", "images"],
  html: ["html", "html output", "html outputs", "html final", "final html"],
};

const OUTPUT_BADGE_STYLES: Record<OutputGroupKey, string> = {
  html: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
  image: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
  step_output: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200",
};


const shouldShowDescription = (
  groupKey: OutputGroupKey,
  description?: string,
) => {
  if (!description) return false;
  const normalized = description.trim().toLowerCase();
  if (!normalized) return false;
  return !TYPE_DESCRIPTIONS_BY_GROUP[groupKey].includes(normalized);
};

export function JobOverviewSection({
  artifactGalleryItems,
  loadingArtifacts = false,
  onPreview,
}: JobOverviewSectionProps) {
  const hasOutputs = artifactGalleryItems.length > 0;
  const showOutputsRow = hasOutputs || loadingArtifacts;
  const groupedOutputs = {
    step_output: [] as ArtifactGalleryItem[],
    image: [] as ArtifactGalleryItem[],
    html: [] as ArtifactGalleryItem[],
  };

  artifactGalleryItems.forEach((item) => {
    groupedOutputs[getOutputGroup(item)].push(item);
  });

  const outputGroups = OUTPUT_GROUPS.map((group) => ({
    ...group,
    items: groupedOutputs[group.key],
  }));

  const [activeOutputGroup, setActiveOutputGroup] = useState<OutputGroupKey>(() => {
    const firstWithItems = outputGroups.find((group) => group.items.length > 0);
    return firstWithItems?.key || "html";
  });
  const activeGroup =
    outputGroups.find((group) => group.key === activeOutputGroup) || {
      key: "html",
      label: "HTML",
      items: [] as ArtifactGalleryItem[],
    };
  const isHtmlGroup = activeGroup.key === "html";
  const outputsListClassName = isHtmlGroup
    ? "grid gap-4"
    : "grid grid-flow-col auto-cols-[16rem] grid-rows-2 gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-hide";
  const outputCardClassName = isHtmlGroup
    ? "group flex w-full flex-col text-left"
    : "group flex w-64 flex-shrink-0 snap-start flex-col text-left";
  const previewSizeClass = isHtmlGroup
    ? "min-h-[60vh] sm:min-h-[65vh] lg:min-h-[70vh]"
    : "aspect-[3/4]";

  const handleCopy = async (value: string) => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        throw new Error("Clipboard API not available");
      }
      await navigator.clipboard.writeText(value);
      toast.success("Link copied");
    } catch {
      toast.error("Unable to copy link");
    }
  };

  const getPreviewMeta = (item: ArtifactGalleryItem) => {
    const artifact = item.artifact;
    return {
      objectUrl: artifact?.object_url || artifact?.public_url || item.url,
      fileName: artifact?.file_name || artifact?.artifact_name || item.label,
      contentType:
        artifact?.content_type || (item.kind === "imageUrl" ? "image/png" : undefined),
      artifactId: artifact?.artifact_id,
    };
  };

  return (
    <section className="mb-4 sm:mb-6 space-y-6">
      {showOutputsRow && (
        <div className="space-y-3">
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
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-1.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur"
                  role="tablist"
                  aria-label="Output types"
                >
                  {outputGroups.map((group) => {
                    const isActive = activeOutputGroup === group.key;
                    return (
                      <button
                        key={group.key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveOutputGroup(group.key)}
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 uppercase tracking-wide transition ${
                          isActive
                            ? "bg-foreground/10 text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span>{group.label}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${OUTPUT_BADGE_STYLES[group.key]}`}
                        >
                          {group.items.length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeGroup.items.length > 0 ? (
                <div
                  className={outputsListClassName}
                  role="list"
                  aria-label={`${activeGroup.label} outputs`}
                >
                  {activeGroup.items.map((item) => {
                    const preview = getPreviewMeta(item);
                    const showDescription = shouldShowDescription(
                      activeGroup.key,
                      item.description,
                    );
                    const previewVariant =
                      activeGroup.key === "step_output" ? "compact" : undefined;
                    const displayLabel = formatOutputLabel(item, activeGroup.key);
                    const outputUrl = getArtifactUrl(item);
                    const canPreview = Boolean(onPreview);
                    return (
                      <div
                        key={item.id}
                        role={canPreview ? "button" : undefined}
                        tabIndex={canPreview ? 0 : -1}
                        aria-disabled={!canPreview}
                        onClick={() => onPreview?.(item)}
                        onKeyDown={(event) => {
                          if (!canPreview) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onPreview?.(item);
                          }
                        }}
                        className={outputCardClassName}
                      >
                        <div className="flex w-full flex-col overflow-hidden rounded-xl border border-border bg-muted/40 shadow-sm transition group-hover:shadow-md">
                          <div className={`${previewSizeClass} w-full overflow-hidden`}>
                            {preview.objectUrl || preview.artifactId ? (
                              <PreviewRenderer
                                contentType={
                                  activeGroup.key === "html"
                                    ? "text/html"
                                    : preview.contentType
                                }
                                objectUrl={preview.objectUrl}
                                fileName={preview.fileName}
                                artifactId={preview.artifactId}
                                previewVariant={previewVariant}
                                className="h-full w-full"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                <PhotoIcon className="h-8 w-8" />
                              </div>
                            )}
                          </div>
                          <div className="border-t border-border/60 bg-background/80 px-3 py-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground line-clamp-1">
                                  {displayLabel}
                                </p>
                                {showDescription && item.description && (
                                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                              {outputUrl && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleCopy(outputUrl);
                                    }}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                    aria-label="Copy link"
                                  >
                                    <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                                  </button>
                                  <a
                                    href={outputUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(event) => event.stopPropagation()}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                    aria-label="Open link"
                                  >
                                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                                  </a>
                                  <a
                                    href={outputUrl}
                                    download
                                    onClick={(event) => event.stopPropagation()}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                    aria-label="Download file"
                                  >
                                    <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
                  No {activeGroup.label.toLowerCase()} outputs yet.
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </section>
  );
}
