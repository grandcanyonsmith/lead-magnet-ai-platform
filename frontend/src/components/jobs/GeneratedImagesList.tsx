import React from "react";
import { FiLoader, FiCpu } from "react-icons/fi";
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
        <div className="grid grid-cols-1 gap-2.5 md:gap-2">
          {step.image_urls.map((imageUrl: string, imgIdx: number) => (
            <div
              key={`url-${imgIdx}`}
              className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
            >
              <div className="aspect-video bg-gray-100 dark:bg-gray-800">
                <PreviewRenderer
                  contentType="image/png"
                  objectUrl={imageUrl}
                  fileName={`Generated image ${imgIdx + 1}`}
                  className="w-full h-full"
                />
              </div>
              <div className="p-3 md:p-2 bg-gray-100 dark:bg-gray-800">
                <div className="flex items-center justify-between gap-2">
                  <a
                    href={imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm md:text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 active:text-blue-900 dark:active:text-blue-200 break-all touch-target py-2 md:py-1 min-h-[44px] md:min-h-0 flex-1 min-w-0"
                    title={imageUrl}
                  >
                    {truncateUrl(imageUrl)}
                  </a>
                  {renderCopyButton(imageUrl)}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Fallback: Render from artifacts */
        hasImageArtifacts && (
          <div className="grid grid-cols-1 gap-2.5 md:gap-2">
            {imageArtifacts.map((artifact: Artifact, imgIdx: number) => {
              const artifactUrl = artifact.object_url || artifact.public_url;
              if (!artifactUrl) return null;

              return (
                <div
                  key={`artifact-${artifact.artifact_id || imgIdx}`}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                >
                  <div className="aspect-video bg-gray-100 dark:bg-gray-800">
                    <PreviewRenderer
                      contentType={artifact.content_type || "image/png"}
                      objectUrl={artifactUrl}
                      fileName={
                        artifact.file_name ||
                        artifact.artifact_name ||
                        `Image ${imgIdx + 1}`
                      }
                      className="w-full h-full"
                      artifactId={artifact.artifact_id}
                    />
                  </div>
                  <div className="p-3 md:p-2 bg-gray-100 dark:bg-gray-800">
                    <div className="flex items-center justify-between gap-2">
                      <a
                        href={artifactUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs md:text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 active:text-blue-900 dark:active:text-blue-200 truncate flex-1 min-w-0"
                        title={
                          artifact.file_name ||
                          artifact.artifact_name ||
                          artifactUrl
                        }
                      >
                        {artifact.file_name ||
                          artifact.artifact_name ||
                          truncateUrl(artifactUrl)}
                      </a>
                      {renderCopyButton(artifactUrl)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
