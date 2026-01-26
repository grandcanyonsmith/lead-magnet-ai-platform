import { useState } from "react";
import { PreviewCard } from "@/components/artifacts/PreviewCard";
import { PreviewRenderer } from "@/components/artifacts/PreviewRenderer";
import { OutputCardActions } from "@/components/jobs/detail/OutputCardActions";
import { Badge } from "@/components/ui/Badge";
import { FullScreenPreviewModal } from "@/components/ui/FullScreenPreviewModal";
import { Artifact } from "@/types/artifact";

interface HtmlArtifactsGalleryProps {
  htmlArtifacts: Artifact[];
}

const HtmlPreviewCard = ({ artifact }: { artifact: Artifact }) => {
  const [isOpen, setIsOpen] = useState(false);
  const fileName =
    artifact.file_name || artifact.artifact_name || "HTML output";
  const contentType =
    artifact.content_type || artifact.mime_type || "text/html";
  const objectUrl = artifact.object_url || artifact.public_url;
  const description = artifact.artifact_type
    ? artifact.artifact_type.replace(/_/g, " ")
    : "HTML output";

  return (
    <>
      <PreviewCard
        title={fileName}
        description={description}
        showDescription={Boolean(description)}
        preview={
          <PreviewRenderer
            contentType={contentType}
            objectUrl={objectUrl}
            fileName={fileName}
            className="h-full w-full"
            artifactId={artifact.artifact_id}
          />
        }
        actions={objectUrl ? <OutputCardActions url={objectUrl} /> : null}
        overlayTopRight={
          <Badge
            variant="secondary"
            className="font-bold text-[11px] shadow-sm bg-background/90 backdrop-blur-sm"
          >
            HTML
          </Badge>
        }
        onClick={() => setIsOpen(true)}
        className="group flex w-full flex-col text-left"
        previewClassName="aspect-video bg-muted/60"
      />
      <FullScreenPreviewModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        contentType={contentType}
        objectUrl={objectUrl}
        fileName={fileName}
        artifactId={artifact.artifact_id}
      />
    </>
  );
};

export function HtmlArtifactsGallery({
  htmlArtifacts,
}: HtmlArtifactsGalleryProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{htmlArtifacts.length} HTML output(s)</span>
        <span className="text-muted-foreground/70">
          Scroll to view more previews
        </span>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-3 pr-1 snap-x snap-mandatory scrollbar-hide-until-hover">
        {htmlArtifacts.map((artifact) => (
          <div
            key={artifact.artifact_id}
            className="min-w-[280px] sm:min-w-[340px] lg:min-w-[420px] max-w-[420px] snap-start"
          >
            <HtmlPreviewCard artifact={artifact} />
          </div>
        ))}
      </div>
    </div>
  );
}
