import React from "react";
import Link from "next/link";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { MergedStep, JobLiveStep } from "@/types/job";
import { Artifact } from "@/types/artifact";
import { StepHeader } from "./StepHeader";
import { StepInputOutput } from "./StepInputOutput";
import { ImagePreview } from "./ImagePreview";
import { StreamViewerUI } from "@/components/ui/StreamViewerUI";
import { PreviewCard } from "@/components/artifacts/PreviewCard";
import { CompactTextPreview } from "./CompactTextPreview";
import {
  buildOutputPreviewText,
  formatLivePreviewText,
  formatLiveUpdatedAt,
  getStepImageFiles,
} from "@/utils/executionSteps";
import { parseLogs } from "@/utils/logParsing";
import { getStepInput } from "@/utils/stepInput";

interface RecursiveStepProps {
  step: MergedStep;
  jobId?: string;
  variant: "compact" | "expanded";
  isExpanded: boolean;
  onToggle: () => void;
  onCopy: (text: string) => void;
  jobStatus?: string;
  liveStep?: JobLiveStep | null;
  onRerunStep?: (stepIndex: number) => Promise<void>;
  rerunningStep?: number | null;
  onEditStep?: (stepIndex: number) => void;
  canEdit?: boolean;
  onQuickUpdateStep?: (stepIndex: number, update: any) => Promise<void>;
  updatingStepIndex?: number | null;
  imageArtifacts?: Artifact[];
  fileArtifacts?: Artifact[];
  loadingImageArtifacts?: boolean;
  onRerunStepClick?: (stepIndex: number) => void;
  allSteps: MergedStep[];
  getStepStatus: (step: MergedStep) => string;
}

export const RecursiveStep: React.FC<RecursiveStepProps> = ({
  step,
  jobId,
  variant,
  isExpanded,
  onToggle,
  onCopy,
  jobStatus,
  liveStep,
  onRerunStep,
  rerunningStep,
  onEditStep,
  canEdit,
  onQuickUpdateStep,
  updatingStepIndex,
  imageArtifacts = [],
  fileArtifacts = [],
  loadingImageArtifacts,
  onRerunStepClick,
  allSteps,
  getStepStatus,
}) => {
  const stepOrder = step.step_order ?? 0;
  const isLiveStep = liveStep?.step_order === stepOrder;
  const stepStatus = getStepStatus(step);
  
  const liveOutputForStep =
    liveStep && liveStep.step_order === stepOrder
      ? liveStep.output_text
      : undefined;
  const liveUpdatedAtForStep =
    liveStep && liveStep.step_order === stepOrder
      ? liveStep.updated_at
      : undefined;
  
  const liveUpdatedAtLabel = formatLiveUpdatedAt(liveUpdatedAtForStep);
  const livePreview =
    typeof liveOutputForStep === "string"
      ? formatLivePreviewText(liveOutputForStep)
      : "";
  const showLivePreview = Boolean(livePreview || liveUpdatedAtLabel);

  const detailsHref =
    jobId && step.step_order !== undefined
      ? `/dashboard/jobs/${jobId}/steps/${step.step_order}`
      : undefined;

  const stepInput = getStepInput(step.input);
  const stepTools = stepInput?.tools || step.tools;
  const stepToolChoice = stepInput?.tool_choice || step.tool_choice;
  
  const hasComputerUse =
    Array.isArray(stepTools) &&
    stepTools.some(
      (tool: any) =>
        (typeof tool === "string" && tool === "computer_use_preview") ||
        (tool && typeof tool === "object" && tool.type === "computer_use_preview"),
    );

  const stepImageFiles =
    variant === "expanded" && isExpanded
      ? getStepImageFiles(step, imageArtifacts)
      : [];

  const inlineOutputPreview =
    variant === "compact" && stepStatus === "completed"
      ? buildOutputPreviewText(step)
      : null;
  const showInlineOutputs = Boolean(inlineOutputPreview);

  const liveLogs = React.useMemo(() => {
    return liveOutputForStep ? parseLogs(liveOutputForStep) : [];
  }, [liveOutputForStep]);

  const shouldShowLivePanel =
    jobStatus === "processing" ||
    (liveOutputForStep && liveOutputForStep.length > 0) ||
    Boolean(liveStep?.error) ||
    Boolean(liveStep?.status);

  const imagePreviewProps = {
    imageIndex: 0,
    model: step.model,
    tools: stepTools,
    toolChoice: stepToolChoice,
  };

  return (
    <div
      id={`execution-step-${stepOrder}`}
      className="relative pb-6 last:pb-0 scroll-mt-24"
    >
      <div
        className={`absolute left-[-5px] top-6 h-2.5 w-2.5 rounded-full ring-4 ring-background ${
          stepStatus === "completed"
            ? "bg-green-500"
            : stepStatus === "in_progress"
              ? "bg-blue-500 animate-pulse"
              : stepStatus === "failed"
                ? "bg-red-500"
                : "bg-muted-foreground/40"
        }`}
      />

      <div className="ml-6 rounded-xl border border-border bg-card shadow-sm transition-all hover:shadow-md">
        <StepHeader
          step={step}
          status={stepStatus}
          jobStatus={jobStatus}
          canEdit={canEdit}
          rerunningStep={rerunningStep}
          allSteps={allSteps}
          onEditStep={onEditStep}
          onRerunStep={onRerunStep}
          onRerunStepClick={onRerunStepClick}
          onQuickUpdateStep={onQuickUpdateStep}
          updatingStepIndex={updatingStepIndex}
          detailsHref={detailsHref}
        />
        
        {isLiveStep && shouldShowLivePanel && (
          <div className="border-t border-border/60">
            <StreamViewerUI 
              logs={liveLogs}
              status={jobStatus === 'processing' ? 'streaming' : jobStatus === 'completed' ? 'completed' : jobStatus === 'failed' ? 'error' : 'pending'}
              hasComputerUse={hasComputerUse}
              className="h-[500px] border-0 rounded-none shadow-none"
            />
          </div>
        )}

        {showInlineOutputs && inlineOutputPreview && (
          <div className="border-t border-border/60 bg-muted/20 px-4 py-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <PreviewCard
                title="Output"
                description={inlineOutputPreview.typeLabel}
                showDescription
                preview={
                  <CompactTextPreview
                    text={inlineOutputPreview.text}
                    format={inlineOutputPreview.type}
                    onCopy={() => onCopy(inlineOutputPreview.text)}
                    onExpand={onToggle}
                  />
                }
                className="group flex w-full flex-col text-left"
                previewClassName="aspect-[3/2] sm:aspect-[8/5]"
              />
            </div>
          </div>
        )}

        {variant === "compact" ? (
          <div className="border-t border-border/60 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {step.step_type !== "workflow_step" && (
                <span className="inline-flex items-center gap-2">
                  {step.step_type.replace(/_/g, " ")}
                </span>
              )}
              {showLivePreview && (
                <span className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
                  {liveUpdatedAtLabel && (
                    <span className="shrink-0">
                      Updated {liveUpdatedAtLabel}
                    </span>
                  )}
                  {livePreview && (
                    <span
                      className="min-w-0 truncate font-mono"
                      title={livePreview}
                    >
                      {livePreview}
                    </span>
                  )}
                </span>
              )}
            </div>
            {detailsHref && (
              <Link
                href={detailsHref}
                className="inline-flex items-center gap-2 font-semibold text-primary-600 hover:text-primary-700"
              >
                View details
                <ChevronDownIcon className="h-3.5 w-3.5 rotate-[-90deg]" />
              </Link>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="w-full flex justify-center py-2 border-t border-border/60 hover:bg-muted/40 transition-colors text-xs font-medium text-muted-foreground"
            onClick={onToggle}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <span className="flex items-center gap-1">
                Hide details <ChevronUpIcon className="w-3 h-3" />
              </span>
            ) : (
              <span className="flex items-center gap-1">
                Show details <ChevronDownIcon className="w-3 h-3" />
              </span>
            )}
          </button>
        )}

        {isExpanded && (
          <div className="border-t border-border/60 bg-muted/30">
            <StepInputOutput
              step={step}
              status={stepStatus}
              onCopy={onCopy}
              liveOutput={liveOutputForStep}
              liveUpdatedAt={liveUpdatedAtForStep}
              imageArtifacts={imageArtifacts}
              fileArtifacts={fileArtifacts}
              loadingImageArtifacts={loadingImageArtifacts}
              onEditStep={onEditStep}
              canEdit={canEdit}
              variant={variant}
            />

            {stepImageFiles.length > 0 && (
              <div className="px-3 sm:px-4 pb-3 sm:pb-4 bg-muted/20">
                {stepImageFiles.map((file) =>
                  file.type === "imageArtifact" ? (
                    <ImagePreview
                      key={file.key}
                      artifact={file.data}
                      {...imagePreviewProps}
                    />
                  ) : (
                    <ImagePreview
                      key={file.key}
                      imageUrl={file.data}
                      {...imagePreviewProps}
                    />
                  ),
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
