import React from "react";
import { PreviewCard } from "@/components/artifacts/PreviewCard";
import { PreviewRenderer } from "@/components/artifacts/PreviewRenderer";
import { OutputCardActions } from "@/components/jobs/detail/OutputCardActions";
import { Artifact } from "@/types/artifact";

interface GeneratedFilesListProps {
  fileArtifacts: Artifact[];
}

export function GeneratedFilesList({ fileArtifacts }: GeneratedFilesListProps) {
  if (!fileArtifacts || fileArtifacts.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 md:mt-2.5 pt-3 md:pt-2.5 border-t border-gray-200 dark:border-gray-700">
      <span className="text-sm md:text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2.5 md:mb-2 block">
        Generated Files:
      </span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {fileArtifacts.map((artifact, idx) => {
          const artifactUrl = artifact.object_url || artifact.public_url;
          const fileName =
            artifact.file_name || artifact.artifact_name || `File ${idx + 1}`;
          const fileType = artifact.content_type || "application/octet-stream";

          return (
            <PreviewCard
              key={artifact.artifact_id || idx}
              title={fileName}
              description={fileType}
              showDescription={Boolean(fileType)}
              preview={
                <PreviewRenderer
                  contentType={artifact.content_type || fileType}
                  objectUrl={artifactUrl}
                  fileName={fileName}
                  className="h-full w-full"
                  artifactId={artifact.artifact_id}
                />
              }
              actions={artifactUrl ? <OutputCardActions url={artifactUrl} /> : null}
              className="group flex w-full flex-col text-left"
              previewClassName="aspect-[4/3] bg-muted/60"
            />
          );
        })}
      </div>
    </div>
  );
}
