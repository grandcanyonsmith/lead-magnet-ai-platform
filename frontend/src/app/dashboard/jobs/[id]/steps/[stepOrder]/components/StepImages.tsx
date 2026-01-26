import React from "react";
import { CollapsibleSectionCard } from "@/components/ui/CollapsibleSectionCard";
import { PreviewRenderer } from "@/components/artifacts/PreviewRenderer";
import { abbreviateUrl } from "@/utils/stepDetailUtils";
import type { Artifact } from "@/types/artifact";

interface StepImagesProps {
  hasImages: boolean;
  stepImageUrls: string[];
  stepImageArtifacts: Artifact[];
  loadingArtifacts: boolean;
}

export function StepImages({
  hasImages,
  stepImageUrls,
  stepImageArtifacts,
  loadingArtifacts,
}: StepImagesProps) {
  if (!hasImages) return null;

  return (
    <CollapsibleSectionCard
      title="Generated images"
      description="Images created during this step."
      preview={`${stepImageUrls.length + stepImageArtifacts.length} image${
        stepImageUrls.length + stepImageArtifacts.length === 1 ? "" : "s"
      }`}
    >
      {loadingArtifacts && stepImageUrls.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Loading images...
        </p>
      ) : (
        <div className="flex flex-nowrap gap-3 overflow-x-auto pb-2 scrollbar-hide-until-hover">
          {stepImageUrls.map((url, index) => (
            <div
              key={`url-${index}`}
              className="shrink-0 w-56 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800"
            >
              <div className="aspect-square">
                <PreviewRenderer
                  contentType="image/png"
                  objectUrl={url}
                  fileName={`Generated image ${index + 1}`}
                  className="w-full h-full"
                />
              </div>
              <div className="px-2 py-2">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-primary-600 dark:text-primary-400 hover:text-primary-700 truncate block"
                  title={url}
                >
                  {abbreviateUrl(url)}
                </a>
              </div>
            </div>
          ))}
          {stepImageArtifacts.map((artifact: Artifact, index: number) => {
            const artifactUrl =
              artifact.object_url || artifact.public_url;
            if (!artifactUrl) return null;
            const artifactLabel =
              artifact.file_name ||
              artifact.artifact_name ||
              abbreviateUrl(artifactUrl);
            return (
              <div
                key={`artifact-${artifact.artifact_id || index}`}
                className="shrink-0 w-56 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800"
              >
                <div className="aspect-square">
                  <PreviewRenderer
                    contentType={artifact.content_type || "image/png"}
                    objectUrl={artifactUrl}
                    fileName={
                      artifact.file_name ||
                      artifact.artifact_name ||
                      `Image ${index + 1}`
                    }
                    className="w-full h-full"
                    artifactId={artifact.artifact_id}
                  />
                </div>
                <div className="px-2 py-2">
                  <a
                    href={artifactUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-primary-600 dark:text-primary-400 hover:text-primary-700 truncate block"
                    title={
                      artifact.file_name ||
                      artifact.artifact_name ||
                      artifactUrl
                    }
                  >
                    {artifactLabel}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CollapsibleSectionCard>
  );
}
