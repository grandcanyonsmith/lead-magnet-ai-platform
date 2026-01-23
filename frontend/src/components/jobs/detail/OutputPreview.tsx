import { PhotoIcon } from "@heroicons/react/24/outline";
import { PreviewRenderer } from "@/components/artifacts/PreviewRenderer";
import type { OutputGroupKey, OutputPreviewMeta } from "@/utils/jobs/outputs";

interface OutputPreviewProps {
  groupKey: OutputGroupKey;
  preview: OutputPreviewMeta;
  className?: string;
}

export function OutputPreview({ groupKey, preview, className }: OutputPreviewProps) {
  const previewVariant = groupKey === "step_output" ? "compact" : undefined;
  const previewClassName =
    groupKey === "logs"
      ? `${className ?? ""} overflow-y-auto scrollbar-hide-until-hover`.trim()
      : className;
  const contentType = groupKey === "html" ? "text/html" : preview.contentType;
  const viewMode = groupKey === "html" ? "mobile" : undefined;
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
      jobId={preview.jobId}
      autoUploadKey={preview.autoUploadKey}
      previewVariant={previewVariant}
      className={previewClassName}
      viewMode={viewMode}
    />
  );
}
