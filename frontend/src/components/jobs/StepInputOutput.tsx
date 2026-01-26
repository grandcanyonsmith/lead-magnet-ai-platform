/**
 * Step Input/Output Component
 * Displays step input and output sections with copy functionality
 */

import React, { useEffect, useRef, useState } from "react";
import {
  FiCopy,
  FiCheck,
  FiChevronDown,
  FiChevronUp,
  FiLoader,
  FiEdit,
  FiCpu,
} from "react-icons/fi";
import { formatStepInput, formatStepOutput } from "@/utils/jobFormatting";
import { StepContent } from "./StepContent";
import { MergedStep, StepStatus } from "@/types/job";
import { PreviewRenderer } from "@/components/artifacts/PreviewRenderer";
import { Artifact } from "@/types/artifact";
import { LiveOutputRenderer } from "./LiveOutputRenderer";
import { StreamViewerUI } from "@/components/ui/StreamViewerUI";
import { parseLogs } from "@/utils/logParsing";

interface StepInputOutputProps {
  step: MergedStep;
  status: StepStatus;
  onCopy: (text: string) => void;
  liveOutput?: string;
  liveUpdatedAt?: string;
  imageArtifacts?: Artifact[];
  loadingImageArtifacts?: boolean;
  onEditStep?: (stepIndex: number) => void;
  canEdit?: boolean;
  variant?: "compact" | "expanded";
}

// Type for tool - can be a string or an object with a type property
type Tool = string | { type: string; [key: string]: unknown };

// Helper to get tool name from tool object or string
function getToolName(tool: Tool): string {
  return typeof tool === "string" ? tool : tool.type || "unknown";
}

// Helper to truncate long URLs for display
function truncateUrl(url: string, maxLength: number = 50): string {
  if (url.length <= maxLength) {
    return url;
  }
  return url.substring(0, maxLength) + "...";
}

// Helper to detect if image generation was used in this step
function hasImageGeneration(
  step: MergedStep,
  imageArtifacts: Artifact[],
): boolean {
  // Check if step has image URLs
  const hasImageUrls =
    step.image_urls &&
    Array.isArray(step.image_urls) &&
    step.image_urls.length > 0;

  // Check if step has image artifacts
  const hasImageArtifacts = imageArtifacts.length > 0;

  // Check if step tools include image generation
  const tools = step.input?.tools || step.tools || [];
  const hasImageGenerationTool =
    Array.isArray(tools) &&
    tools.some((tool) => {
      const toolName = getToolName(tool as Tool);
      return toolName === "image_generation";
    });

  return hasImageUrls || hasImageArtifacts || hasImageGenerationTool;
}

// Render tool badges inline
function renderToolBadges(
  tools?: string[] | unknown[],
  showLabel: boolean = true,
) {
  if (!tools || !Array.isArray(tools) || tools.length === 0) {
    return showLabel ? (
      <span className="px-2 py-0.5 text-xs bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded border border-gray-200 dark:border-gray-700">
        None
      </span>
    ) : null;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {tools.map((tool, toolIdx) => {
        const toolName = getToolName(tool as Tool);
        return (
          <span
            key={toolIdx}
            className="px-2 py-0.5 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800/30 whitespace-nowrap"
          >
            {toolName}
          </span>
        );
      })}
    </div>
  );
}

export function StepInputOutput({
  step,
  status,
  onCopy,
  liveOutput,
  liveUpdatedAt,
  imageArtifacts = [],
  loadingImageArtifacts = false,
  onEditStep,
  canEdit = false,
  variant = "compact",
}: StepInputOutputProps) {
  const inputScrollRef = useRef<HTMLDivElement>(null);
  const outputScrollRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [copiedImageUrl, setCopiedImageUrl] = useState<string | null>(null);

  // Add scroll detection to show scrollbars when scrolling
  useEffect(() => {
    const inputEl = inputScrollRef.current;
    const outputEl = outputScrollRef.current;

    const handleInputScroll = () => {
      if (inputEl) {
        inputEl.classList.add("scrolling");
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = setTimeout(() => {
          if (inputEl) {
            inputEl.classList.remove("scrolling");
          }
        }, 300);
      }
    };

    const handleOutputScroll = () => {
      if (outputEl) {
        outputEl.classList.add("scrolling");
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = setTimeout(() => {
          if (outputEl) {
            outputEl.classList.remove("scrolling");
          }
        }, 300);
      }
    };

    if (inputEl) {
      inputEl.addEventListener("scroll", handleInputScroll, { passive: true });
    }
    if (outputEl) {
      outputEl.addEventListener("scroll", handleOutputScroll, {
        passive: true,
      });
    }

    return () => {
      if (inputEl) {
        inputEl.removeEventListener("scroll", handleInputScroll);
      }
      if (outputEl) {
        outputEl.removeEventListener("scroll", handleOutputScroll);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const isPending = status === "pending";
  const isCompleted = status === "completed";
  const isInProgress = status === "in_progress";
  const liveOutputText = typeof liveOutput === "string" ? liveOutput : "";
  const hasLiveOutput = liveOutputText.length > 0;
  const shouldShowLiveOutput =
    isInProgress &&
    !hasImageGeneration(step, imageArtifacts) &&
    (step.output === null || step.output === undefined || step.output === "") &&
    (hasLiveOutput || Boolean(liveUpdatedAt));
  const contentHeightClass =
    variant === "expanded" ? "max-h-none" : "max-h-[350px] md:max-h-72";
  const liveOutputHeightClass =
    variant === "expanded" ? "max-h-96" : "max-h-48";
  const layoutClass =
    variant === "expanded" ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 gap-3";

  // Show section if step is completed, in progress, or pending with instructions
  const shouldShow =
    isCompleted || isInProgress || (isPending && step.instructions);
  if (!shouldShow) {
    return null;
  }

  const handleCopyImageUrl = (url: string) => {
    onCopy(url);
    setCopiedImageUrl(url);
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = setTimeout(() => {
      setCopiedImageUrl(null);
    }, 2000);
  };

  const renderCopyButton = (url: string) => {
    const isCopied = copiedImageUrl === url;
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          handleCopyImageUrl(url);
        }}
        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 active:text-gray-900 dark:active:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600 touch-target min-h-[44px] sm:min-h-0"
        title={isCopied ? "Copied" : "Copy image URL"}
        aria-label={isCopied ? "Copied image URL" : "Copy image URL"}
      >
        {isCopied ? (
          <FiCheck className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        ) : (
          <FiCopy className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        )}
        <span className="hidden sm:inline">
          {isCopied ? "Copied" : "Copy"}
        </span>
      </button>
    );
  };

  const renderImageSection = () => {
    const stepOrder = step.step_order ?? 0;
    const hasImageUrls =
      step.image_urls &&
      Array.isArray(step.image_urls) &&
      step.image_urls.length > 0;
    const hasImageArtifacts = imageArtifacts.length > 0;

    if (!hasImageUrls && !hasImageArtifacts) {
      return null;
    }

    // Get model and tools for display
    const modelValue = step.model || step.input?.model;
    const modelString: string | undefined =
      typeof modelValue === "string" ? modelValue : undefined;
    const tools = step.input?.tools || step.tools || [];
    const toolChoice = step.input?.tool_choice || step.tool_choice;
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
              {renderToolBadges(step.input?.tools || step.tools)}
            </div>
          )}
        </div>
      )}

      <span className="text-sm md:text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2.5 md:mb-2 block">
        Generated Images:
      </span>

      {/* Loading state */}
      {loadingImageArtifacts && !hasImageUrls && (
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
};

  // Check if image generation was used
  const usedImageGeneration = hasImageGeneration(step, imageArtifacts);

  return (
    <div className="px-3 sm:px-3 pb-3 sm:pb-3 pt-3 border-t border-gray-100 dark:border-gray-700">
      <div className="mt-0">
        {isPending ? (
          /* For pending steps, show configuration only */
          <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-card shadow-sm">
            <div className="bg-slate-50 dark:bg-slate-900/50 px-3 py-2 md:py-1.5 border-b border-gray-300 dark:border-gray-700 flex items-center justify-between">
              <span className="text-sm md:text-xs font-semibold text-gray-700 dark:text-gray-300">
                Configuration
              </span>
              {canEdit &&
                onEditStep &&
                (step.step_type === "workflow_step" ||
                  step.step_type === "ai_generation" ||
                  step.step_type === "webhook") &&
                step.step_order !== undefined &&
                step.step_order > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const workflowStepIndex = step.step_order - 1;
                      onEditStep(workflowStepIndex);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                    title="Edit workflow step"
                  >
                    <FiEdit className="w-4 h-4" />
                    <span>Edit Step</span>
                  </button>
                )}
            </div>
            <div className="p-4 md:p-3 bg-white dark:bg-card space-y-3 md:space-y-2">
              {step.instructions && (
                <div>
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                    Instructions
                  </span>
                  <pre className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap font-sans bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded border border-gray-200 dark:border-gray-700">
                    {step.instructions}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* For completed/in-progress steps, show Input and Output side by side on desktop, stacked on mobile */
          <div className={layoutClass}>
            {/* Input Section */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-card shadow-sm">
              <div className="bg-gray-50 dark:bg-gray-900/50 px-3 py-2 md:px-3 md:py-1.5 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm md:text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Input
                  </span>
                  <div className="flex items-center gap-1.5">
                    {canEdit &&
                      onEditStep &&
                      (step.step_type === "workflow_step" ||
                        step.step_type === "ai_generation" ||
                        step.step_type === "webhook") &&
                      step.step_order !== undefined &&
                      step.step_order > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const workflowStepIndex = step.step_order - 1;
                            onEditStep(workflowStepIndex);
                          }}
                          className="flex items-center gap-1 px-1.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                          title="Edit workflow step"
                        >
                          <FiEdit className="w-3 h-3" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                      )}
                    <button
                      onClick={() => {
                        const formatted = formatStepInput(step);
                        let text: string;
                        if (formatted.type === "json") {
                          text = JSON.stringify(formatted.content, null, 2);
                        } else if (typeof formatted.content === "string") {
                          text = formatted.content;
                        } else if (
                          typeof formatted.content === "object" &&
                          formatted.content !== null &&
                          "input" in formatted.content
                        ) {
                          const contentObj = formatted.content as {
                            input?: unknown;
                          };
                          text = contentObj.input
                            ? String(contentObj.input)
                            : JSON.stringify(formatted.content, null, 2);
                        } else {
                          text = JSON.stringify(formatted.content, null, 2);
                        }
                        onCopy(text);
                      }}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 active:text-gray-900 dark:active:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600 touch-target min-h-[44px] sm:min-h-0"
                    >
                      <FiCopy className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                      <span className="hidden sm:inline">Copy</span>
                    </button>
                  </div>
                </div>
              </div>
              <div
                ref={inputScrollRef}
                className={`p-3 md:p-2.5 bg-white dark:bg-card ${contentHeightClass} overflow-y-auto scrollbar-hide-until-hover`}
              >
                {/* Current Step Input */}
                <StepContent formatted={formatStepInput(step)} />
              </div>
            </div>

            {/* Output Section */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-card shadow-sm">
              <div className="bg-gray-50 dark:bg-gray-900/50 px-3 py-2 md:px-3 md:py-1.5 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm md:text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Output
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        // If the step is currently streaming, copy the live output instead of `null`.
                        if (shouldShowLiveOutput && typeof liveOutput === "string") {
                          onCopy(liveOutput);
                          return;
                        }
                        const formatted = formatStepOutput(step);
                        const text =
                          formatted.type === "json"
                            ? JSON.stringify(formatted.content, null, 2)
                            : typeof formatted.content === "string"
                              ? formatted.content
                              : JSON.stringify(formatted.content, null, 2);
                        onCopy(text);
                      }}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 active:text-gray-900 dark:active:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600 touch-target min-h-[44px] sm:min-h-0"
                    >
                      <FiCopy className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                      <span className="hidden sm:inline">Copy</span>
                    </button>
                  </div>
                </div>
              </div>
              <div
                ref={outputScrollRef}
                className={`p-3 md:p-2.5 bg-white dark:bg-card ${contentHeightClass} overflow-y-auto scrollbar-hide-until-hover`}
              >
                {usedImageGeneration ? (
                  /* For image generation steps, only show the image URL, not markdown preview */
                  renderImageSection()
                ) : (
                  /* For non-image generation steps, show the normal output content */
                  <>
                    {shouldShowLiveOutput && (
                      <div className="mb-3 md:mb-2 rounded-lg border border-blue-200 dark:border-blue-800/40 bg-blue-50/60 dark:bg-blue-900/10 p-3 md:p-2.5">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <FiLoader className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-300" />
                            <span className="text-xs font-semibold text-blue-800 dark:text-blue-200">
                              Live output (streaming)
                            </span>
                          </div>
                          {liveUpdatedAt && (
                            <span className="text-[11px] text-blue-700/70 dark:text-blue-200/60">
                              Updated{" "}
                              {new Date(liveUpdatedAt).toLocaleTimeString([], {
                                hour12: false,
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                          )}
                        </div>
                        <LiveOutputRenderer
                          value={
                            hasLiveOutput
                              ? liveOutputText
                              : "Waiting for model output..."
                          }
                          className={`text-sm md:text-xs text-gray-800 dark:text-gray-200 font-mono ${liveOutputHeightClass} overflow-y-auto scrollbar-hide-until-hover leading-relaxed`}
                          textClassName="m-0 whitespace-pre-wrap break-words"
                        />
                      </div>
                    )}
                    {!shouldShowLiveOutput &&
                      (() => {
                        const stepImageUrls =
                          step.image_urls &&
                          Array.isArray(step.image_urls) &&
                          step.image_urls.length > 0
                            ? step.image_urls
                            : [];
                        
                        // Check if output contains log markers
                        const outputContent = typeof step.output === 'string' 
                          ? step.output 
                          : (step.output ? JSON.stringify(step.output, null, 2) : '');
                          
                        const hasLogMarkers = /\[Tool output\]|\[Code interpreter\]/.test(outputContent);
                        
                        if (hasLogMarkers) {
                          const logs = parseLogs(outputContent);
                          return (
                            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                              <StreamViewerUI 
                                logs={logs}
                                status={status === 'in_progress' ? 'streaming' : status === 'failed' ? 'error' : 'completed'}
                                className="h-[400px] border-0 rounded-none shadow-none"
                              />
                            </div>
                          );
                        }

                        return (
                          <StepContent
                            formatted={formatStepOutput(step)}
                            imageUrls={stepImageUrls}
                          />
                        );
                      })()}
                    {renderImageSection()}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
