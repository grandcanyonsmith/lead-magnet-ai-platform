import { PhotoIcon } from "@heroicons/react/24/outline";
import { PreviewRenderer } from "@/components/artifacts/PreviewRenderer";
import type { OutputGroupKey, OutputPreviewMeta } from "@/utils/jobs/outputs";

interface OutputPreviewProps {
  groupKey: OutputGroupKey;
  preview: OutputPreviewMeta;
  className?: string;
}

export function OutputPreview({ groupKey, preview, className }: OutputPreviewProps) {
  const previewVariant =
    groupKey === "step_output" || groupKey === "logs" ? "compact" : undefined;
  const contentType = groupKey === "html" ? "text/html" : preview.contentType;
  const hasPreview = Boolean(preview.objectUrl || preview.artifactId);

  if (!hasPreview) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        <PhotoIcon className="h-8 w-8" />
      </div>
    );
  }

  return (
    <PreviewRenderer
      contentType={contentType}
      objectUrl={preview.objectUrl}
      fileName={preview.fileName}
      artifactId={preview.artifactId}
      previewVariant={previewVariant}
      className={className}
    />
  );
}
