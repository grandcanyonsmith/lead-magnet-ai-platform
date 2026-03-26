import React from "react";
import { CollapsibleSectionCard } from "@/components/ui/CollapsibleSectionCard";
import { PreviewRenderer } from "@/components/artifacts/PreviewRenderer";
import { getStepImageFiles } from "@/utils/executionSteps";
import { abbreviateUrl } from "@/utils/stepDetailUtils";
import type { MergedStep } from "@/types/job";
import type { Artifact } from "@/types/artifact";

interface StepImagesProps {
  step: MergedStep;
  stepImageArtifacts: Artifact[];
  loadingArtifacts: boolean;
}

export function StepImages({
  step,
  stepImageArtifacts,
  loadingArtifacts,
}: StepImagesProps) {
  const imageFiles = getStepImageFiles(step, stepImageArtifacts);
  const hasImageUrls =
    Array.isArray(step.image_urls) && step.image_urls.length > 0;
  const hasImages = imageFiles.length > 0;

  if (!hasImages) return null;

  return (
    <CollapsibleSectionCard
      title="Generated images"
      description="Images created during this step."
      preview={`${imageFiles.length} image${imageFiles.length === 1 ? "" : "s"}`}
    >
      {loadingArtifacts && !hasImageUrls ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Loading images...
        </p>
      ) : (
        <div className="flex flex-nowrap gap-3 overflow-x-auto pb-2 scrollbar-hide-until-hover">
          {imageFiles.map((file, index) => {
            const artifact =
              file.type === "imageArtifact" ? file.data : undefined;
            const artifactUrl =
              file.type === "imageArtifact"
                ? artifact?.object_url || artifact?.public_url
                : file.data;
            if (!artifactUrl) return null;

            const artifactLabel =
              file.type === "imageArtifact"
                ? artifact?.file_name ||
                  artifact?.artifact_name ||
                  abbreviateUrl(artifactUrl)
                : `Generated image ${index + 1}`;

            return (
              <div
                key={file.key}
                className="shrink-0 w-56 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800"
              >
                <div className="aspect-square">
                  <PreviewRenderer
                    contentType={artifact?.content_type || "image/png"}
                    objectUrl={artifactUrl}
                    fileName={artifactLabel}
                    className="w-full h-full"
                    artifactId={artifact?.artifact_id}
                  />
                </div>
                <div className="px-2 py-2">
                  <a
                    href={artifactUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-primary-600 dark:text-primary-400 hover:text-primary-700 truncate block"
                    title={file.type === "imageArtifact" ? artifactLabel : artifactUrl}
                  >
                    {file.type === "imageArtifact"
                      ? artifactLabel
                      : abbreviateUrl(artifactUrl)}
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
