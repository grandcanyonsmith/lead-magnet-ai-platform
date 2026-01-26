/**
 * Step Input/Output Component
 * Displays step input and output sections with copy functionality
 */

import React from "react";
import { MergedStep, StepStatus } from "@/types/job";
import { Artifact } from "@/types/artifact";
import { StepInput } from "./steps/StepInput";
import { StepOutput } from "./steps/StepOutput";
import { StepConfiguration } from "./steps/StepConfiguration";

interface StepInputOutputProps {
  step: MergedStep;
  status: StepStatus;
  onCopy: (text: string) => void;
  liveOutput?: string;
  liveUpdatedAt?: string;
  imageArtifacts?: Artifact[];
  fileArtifacts?: Artifact[];
  loadingImageArtifacts?: boolean;
  onEditStep?: (stepIndex: number) => void;
  canEdit?: boolean;
  variant?: "compact" | "expanded";
  showInput?: boolean;
}

export function StepInputOutput({
  step,
  status,
  onCopy,
  liveOutput,
  liveUpdatedAt,
  imageArtifacts = [],
  fileArtifacts = [],
  loadingImageArtifacts = false,
  onEditStep,
  canEdit = false,
  variant = "compact",
  showInput = true,
}: StepInputOutputProps) {
  const isPending = status === "pending";
  const isCompleted = status === "completed";
  const isInProgress = status === "in_progress";
  const isFailed = status === "failed";

  const contentHeightClass =
    variant === "expanded" ? "max-h-none" : "max-h-[350px] md:max-h-72";
  const liveOutputHeightClass =
    variant === "expanded" ? "max-h-96" : "max-h-48";
  const layoutClass =
    variant === "expanded"
      ? "grid grid-cols-1 gap-4"
      : "grid grid-cols-1 gap-3";

  // Show section if step is completed, in progress, failed, or pending with instructions
  const shouldShow =
    isCompleted || isInProgress || isFailed || (isPending && step.instructions);
  if (!shouldShow) {
    return null;
  }

  return (
    <div className="px-3 sm:px-3 pb-3 sm:pb-3 pt-3 border-t border-gray-100 dark:border-gray-700">
      <div className="mt-0">
        {isPending ? (
          <StepConfiguration
            step={step}
            canEdit={canEdit}
            onEditStep={onEditStep}
          />
        ) : (
          <div className={layoutClass}>
            {showInput && (
              <StepInput
                step={step}
                canEdit={canEdit}
                onEditStep={onEditStep}
                onCopy={onCopy}
                contentHeightClass={contentHeightClass}
              />
            )}

            <StepOutput
              step={step}
              status={status}
              onCopy={onCopy}
              liveOutput={liveOutput}
              liveUpdatedAt={liveUpdatedAt}
              imageArtifacts={imageArtifacts}
              fileArtifacts={fileArtifacts}
              loadingImageArtifacts={loadingImageArtifacts}
              contentHeightClass={contentHeightClass}
              liveOutputHeightClass={liveOutputHeightClass}
            />
          </div>
        )}
      </div>
    </div>
  );
}
