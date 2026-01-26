import React from "react";
import { FiLoader, FiCpu } from "react-icons/fi";
import { PreviewCard } from "@/components/artifacts/PreviewCard";
import { PreviewRenderer } from "@/components/artifacts/PreviewRenderer";
import { Artifact } from "@/types/artifact";
import { MergedStep } from "@/types/job";
import { getStepInput } from "@/utils/stepInput";
import { renderToolBadges, truncateUrl } from "@/utils/stepUtils";

interface GeneratedImagesListProps {
  step: MergedStep;
  imageArtifacts: Artifact[];
  loading?: boolean;
  onCopy: (text: string) => void;
  renderCopyButton: (url: string) => React.ReactNode;
}

export function GeneratedImagesList({
  step,
  imageArtifacts,
  loading = false,
  renderCopyButton,
}: GeneratedImagesListProps) {
  const hasImageUrls =
    step.image_urls &&
    Array.isArray(step.image_urls) &&
    step.image_urls.length > 0;
  const hasImageArtifacts = imageArtifacts.length > 0;

  if (!hasImageUrls && !hasImageArtifacts) {
    return null;
  }

  // Get model and tools for display
  const stepInput = getStepInput(step.input);
  const modelValue = step.model || stepInput?.model;
  const modelString: string | undefined =
    typeof modelValue === "string" ? modelValue : undefined;
  const tools = stepInput?.tools || step.tools || [];
  const hasTools = tools && Array.isArray(tools) && tools.length > 0;

  return (
    <div className="mt-3 md:mt-2.5 pt-3 md:pt-2.5 border-t border-gray-200 dark:border-gray-700">
      {/* Show model and tools when image generation is used */}
      {(modelString || hasTools) && (
        <div className="flex items-center gap-2 mb-3 md:mb-2 flex-wrap">
          {modelString && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/30">
              <FiCpu className="w-3 h-3" />
              {modelString}
            </span>
          )}
          {hasTools && (
            <div className="flex items-center gap-1.5">
              {renderToolBadges(stepInput?.tools || step.tools)}
            </div>
          )}
        </div>
      )}

      <span className="text-sm md:text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2.5 md:mb-2 block">
        Generated Images:
      </span>

      {/* Loading state */}
      {loading && !hasImageUrls && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 py-2">
          <FiLoader className="w-3.5 h-3.5 animate-spin" />
          <span>Loading images...</span>
        </div>
      )}

      {/* Render from image_urls if available */}
      {hasImageUrls && step.image_urls ? (
        <div className="grid grid-cols-1 gap-2.5 md:gap-2 sm:grid-cols-2">
          {step.image_urls.map((imageUrl: string, imgIdx: number) => (
            <PreviewCard
              key={`url-${imgIdx}`}
              title={`Generated image ${imgIdx + 1}`}
              preview={
                <PreviewRenderer
                  contentType="image/png"
                  objectUrl={imageUrl}
                  fileName={`Generated image ${imgIdx + 1}`}
                  className="h-full w-full"
                />
              }
              meta={
                <a
                  href={imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-muted-foreground hover:text-foreground truncate"
                  title={imageUrl}
                  onClick={(event) => event.stopPropagation()}
                >
                  {truncateUrl(imageUrl)}
                </a>
              }
              actions={renderCopyButton(imageUrl)}
              className="group flex w-full flex-col text-left"
              previewClassName="aspect-video bg-muted/60"
            />
          ))}
        </div>
      ) : (
        /* Fallback: Render from artifacts */
        hasImageArtifacts && (
          <div className="grid grid-cols-1 gap-2.5 md:gap-2 sm:grid-cols-2">
            {imageArtifacts.map((artifact: Artifact, imgIdx: number) => {
              const artifactUrl = artifact.object_url || artifact.public_url;
              if (!artifactUrl) return null;
              const fileLabel =
                artifact.file_name ||
                artifact.artifact_name ||
                `Image ${imgIdx + 1}`;

              return (
                <PreviewCard
                  key={`artifact-${artifact.artifact_id || imgIdx}`}
                  title={fileLabel}
                  description={artifact.content_type}
                  showDescription={Boolean(artifact.content_type)}
                  preview={
                    <PreviewRenderer
                      contentType={artifact.content_type || "image/png"}
                      objectUrl={artifactUrl}
                      fileName={fileLabel}
                      className="h-full w-full"
                      artifactId={artifact.artifact_id}
                    />
                  }
                  meta={
                    <a
                      href={artifactUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-muted-foreground hover:text-foreground truncate"
                      title={fileLabel}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {artifact.file_name ||
                        artifact.artifact_name ||
                        truncateUrl(artifactUrl)}
                    </a>
                  }
                  actions={renderCopyButton(artifactUrl)}
                  className="group flex w-full flex-col text-left"
                  previewClassName="aspect-video bg-muted/60"
                />
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
