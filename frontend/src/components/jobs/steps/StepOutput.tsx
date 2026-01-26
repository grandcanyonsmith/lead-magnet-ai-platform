import React, { useRef, useEffect } from "react";
import { FiLoader } from "react-icons/fi";
import { MergedStep, StepStatus } from "@/types/job";
import { Artifact } from "@/types/artifact";
import { formatStepOutput } from "@/utils/jobFormatting";
import { parseLogs } from "@/utils/logParsing";
import { hasImageGeneration } from "@/utils/stepUtils";
import { StepContent } from "../StepContent";
import { LiveOutputRenderer } from "../LiveOutputRenderer";
import { StreamViewerUI } from "@/components/ui/StreamViewerUI";
import { GeneratedImagesList } from "../GeneratedImagesList";
import { GeneratedFilesList } from "../GeneratedFilesList";
import { CopyButton } from "@/components/ui/buttons/CopyButton";
import { SectionHeader } from "@/components/ui/sections/SectionHeader";

interface StepOutputProps {
  step: MergedStep;
  status: StepStatus;
  onCopy: (text: string) => void;
  liveOutput?: string;
  liveUpdatedAt?: string;
  imageArtifacts?: Artifact[];
  fileArtifacts?: Artifact[];
  loadingImageArtifacts?: boolean;
  contentHeightClass: string;
  liveOutputHeightClass: string;
}

export function StepOutput({
  step,
  status,
  onCopy,
  liveOutput,
  liveUpdatedAt,
  imageArtifacts = [],
  fileArtifacts = [],
  loadingImageArtifacts = false,
  contentHeightClass,
  liveOutputHeightClass,
}: StepOutputProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll detection logic (reused)
  useEffect(() => {
    const el = scrollRef.current;
    const handleScroll = () => {
      if (el) {
        el.classList.add("scrolling");
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
          if (el) el.classList.remove("scrolling");
        }, 300);
      }
    };

    if (el) el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      if (el) el.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const isInProgress = status === "in_progress";
  const liveOutputText = typeof liveOutput === "string" ? liveOutput : "";
  const hasLiveOutput = liveOutputText.length > 0;
  const shouldShowLiveOutput =
    isInProgress &&
    !hasImageGeneration(step, imageArtifacts) &&
    (step.output === null || step.output === undefined || step.output === "") &&
    (hasLiveOutput || Boolean(liveUpdatedAt));

  const formattedOutput = formatStepOutput(step);
  const isAiStep =
    step.step_type === "ai_generation" ||
    step.step_type === "workflow_step" ||
    step.step_type === "html_generation";
  const isWebhookStep = step.step_type === "webhook";
  const isHandoffStep = step.step_type === "workflow_handoff";

  const label = isWebhookStep
    ? "Response"
    : isHandoffStep
      ? "Handoff Result"
      : isAiStep
        ? "Step Output"
        : "Output";

  const title = isAiStep ? "Result produced by this step" : undefined;
  const usedImageGeneration = hasImageGeneration(step, imageArtifacts);

  const handleCopy = () => {
    if (shouldShowLiveOutput && typeof liveOutput === "string") {
      onCopy(liveOutput);
      return;
    }
    const text =
      formattedOutput.type === "json"
        ? JSON.stringify(formattedOutput.content, null, 2)
        : typeof formattedOutput.content === "string"
          ? formattedOutput.content
          : JSON.stringify(formattedOutput.content, null, 2);
    onCopy(text);
  };

  const renderCopyButton = (url: string) => (
    <CopyButton 
      text={url} 
      onCopy={onCopy} 
      variant="both" 
      title="Copy image URL"
      label="Copy"
    />
  );

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-card shadow-sm">
      <SectionHeader
        title={label}
        titleTitle={title}
        actions={
          <CopyButton 
            text="" // Handled manually
            onCopy={handleCopy} 
            variant="both" 
          />
        }
      />
      <div
        ref={scrollRef}
        className={`p-3 md:p-2.5 bg-white dark:bg-card ${contentHeightClass} overflow-y-auto scrollbar-hide-until-hover`}
      >
        {usedImageGeneration ? (
          <GeneratedImagesList
            step={step}
            imageArtifacts={imageArtifacts}
            loading={loadingImageArtifacts}
            renderCopyButton={renderCopyButton}
            onCopy={onCopy}
          />
        ) : (
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

                const outputContent =
                  typeof step.output === "string"
                    ? step.output
                    : step.output
                      ? JSON.stringify(step.output, null, 2)
                      : "";

                const hasLogMarkers =
                  /\[Tool output\]|\[Code interpreter\]/.test(outputContent);

                if (hasLogMarkers) {
                  const logs = parseLogs(outputContent);
                  return (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <StreamViewerUI
                        logs={logs}
                        status={
                          status === "in_progress"
                            ? "streaming"
                            : status === "failed"
                              ? "error"
                              : "completed"
                        }
                        className="h-[400px] border-0 rounded-none shadow-none"
                      />
                    </div>
                  );
                }

                return (
                  <StepContent
                    formatted={formattedOutput}
                    imageUrls={stepImageUrls}
                  />
                );
              })()}
            <GeneratedImagesList
              step={step}
              imageArtifacts={imageArtifacts}
              loading={loadingImageArtifacts}
              renderCopyButton={renderCopyButton}
              onCopy={onCopy}
            />
            <GeneratedFilesList fileArtifacts={fileArtifacts} />
          </>
        )}
      </div>
    </div>
  );
}
