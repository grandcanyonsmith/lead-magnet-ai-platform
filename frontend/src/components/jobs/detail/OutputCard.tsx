import type { ArtifactGalleryItem } from "@/types/job";
import type { OutputGroupKey, OutputPreviewMeta } from "@/utils/jobs/outputs";
import { OutputCardActions } from "@/components/jobs/detail/OutputCardActions";
import { OutputPreview } from "@/components/jobs/detail/OutputPreview";

interface OutputCardProps {
  item: ArtifactGalleryItem;
  groupKey: OutputGroupKey;
  preview: OutputPreviewMeta;
  displayLabel: string;
  description?: string;
  showDescription?: boolean;
  outputUrl?: string;
  onPreview?: (item: ArtifactGalleryItem) => void;
  className?: string;
  previewClassName?: string;
}

export function OutputCard({
  item,
  groupKey,
  preview,
  displayLabel,
  description,
  showDescription,
  outputUrl,
  onPreview,
  className,
  previewClassName,
}: OutputCardProps) {
  const canPreview = Boolean(onPreview);

  return (
    <div
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
      className={className}
    >
      <div className="flex w-full flex-col overflow-hidden rounded-xl border border-border bg-muted/40 shadow-sm transition group-hover:shadow-md">
        <div className={`${previewClassName ?? ""} w-full overflow-hidden`}>
          <OutputPreview
            groupKey={groupKey}
            preview={preview}
            className="h-full w-full"
          />
        </div>
        <div className="border-t border-border/60 bg-background/80 px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground line-clamp-1">
                {displayLabel}
              </p>
              {showDescription && description && (
                <p className="text-[11px] text-muted-foreground line-clamp-1">
                  {description}
                </p>
              )}
            </div>
            {outputUrl && <OutputCardActions url={outputUrl} />}
          </div>
        </div>
      </div>
    </div>
  );
}
