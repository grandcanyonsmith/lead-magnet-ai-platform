import React, { useMemo } from "react";
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
import { RecursiveBlock } from "@/components/ui/recursive/RecursiveBlock";
import { BlockNode } from "@/types/recursive";
import {
  buildOutputPreviewText,
  formatLivePreviewText,
  formatLiveUpdatedAt,
  getStepImageFiles,
} from "@/utils/executionSteps";
import { parseLogs } from "@/utils/logParsing";
import { getStepInput } from "@/utils/stepInput";

export interface RecursiveStepProps {
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

// Helper to convert MergedStep tree to BlockNode tree
const createBlockNode = (
  step: MergedStep, 
  getStepStatus: (step: MergedStep) => string,
  rootId?: string,
  rootExpanded?: boolean
): BlockNode<MergedStep> => {
  const stepOrder = step.step_order ?? 0;
  const id = `step-${stepOrder}`;
  const isRoot = id === rootId;

  return {
    id,
    title: step.step_name || `Step ${stepOrder}`,
    status: getStepStatus(step) as any,
    data: step,
    // Only control expansion for the root node
    isExpanded: isRoot ? rootExpanded : undefined,
    isCollapsible: true,
    children: step.children?.map(child => createBlockNode(child, getStepStatus)),
  };
};

export const RecursiveStep: React.FC<RecursiveStepProps> = (props) => {
  const {
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
  } = props;

  const stepOrder = step.step_order ?? 0;
  const rootId = `step-${stepOrder}`;

  const blockNode = useMemo(() => 
    createBlockNode(step, getStepStatus, rootId, isExpanded),
    [step, getStepStatus, rootId, isExpanded]
  );

  const handleBlockToggle = (id: string, expanded: boolean) => {
    if (id === rootId) {
      onToggle();
    }
  };

  const renderHeader = (node: BlockNode<MergedStep>, expanded: boolean) => {
    const currentStep = node.data!;
    const currentStepOrder = currentStep.step_order ?? 0;
    
    // Calculate detailsHref for this specific step
    const detailsHref =
      jobId && currentStepOrder !== undefined
        ? `/dashboard/jobs/${jobId}/steps/${currentStepOrder}`
        : undefined;

    return (
      <StepHeader
        step={currentStep}
        status={node.status as any}
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
    );
  };

  const renderContent = (node: BlockNode<MergedStep>) => {
    const currentStep = node.data!;
    const currentStepOrder = currentStep.step_order ?? 0;
    const isLiveStep = liveStep?.step_order === currentStepOrder;
    const stepStatus = node.status;

    const liveOutputForStep =
      liveStep && liveStep.step_order === currentStepOrder
        ? liveStep.output_text
        : undefined;
    const liveUpdatedAtForStep =
      liveStep && liveStep.step_order === currentStepOrder
        ? liveStep.updated_at
        : undefined;
    
    const liveUpdatedAtLabel = formatLiveUpdatedAt(liveUpdatedAtForStep);
    const livePreview =
      typeof liveOutputForStep === "string"
        ? formatLivePreviewText(liveOutputForStep)
        : "";
    const showLivePreview = Boolean(livePreview || liveUpdatedAtLabel);

    const stepInput = getStepInput(currentStep.input);
    const stepTools = stepInput?.tools || currentStep.tools;
    const stepToolChoice = stepInput?.tool_choice || currentStep.tool_choice;
    
    const hasComputerUse =
      Array.isArray(stepTools) &&
      stepTools.some(
        (tool: any) =>
          (typeof tool === "string" && tool === "computer_use_preview") ||
          (tool && typeof tool === "object" && tool.type === "computer_use_preview"),
      );

    const stepImageFiles =
       // For child steps, we assume they are expanded if we are rendering content
       getStepImageFiles(currentStep, imageArtifacts);

    const inlineOutputPreview =
      variant === "compact" && stepStatus === "completed"
        ? buildOutputPreviewText(currentStep)
        : null;
    const showInlineOutputs = Boolean(inlineOutputPreview);

    const liveLogs = liveOutputForStep ? parseLogs(liveOutputForStep) : [];

    const shouldShowLivePanel =
      jobStatus === "processing" ||
      (liveOutputForStep && liveOutputForStep.length > 0) ||
      Boolean(liveStep?.error) ||
      Boolean(liveStep?.status);

    const imagePreviewProps = {
      imageIndex: 0,
      model: currentStep.model,
      tools: stepTools,
      toolChoice: stepToolChoice,
    };

    // Calculate detailsHref for this specific step
    const detailsHref =
      jobId && currentStepOrder !== undefined
        ? `/dashboard/jobs/${jobId}/steps/${currentStepOrder}`
        : undefined;

    return (
      <div className="bg-muted/30">
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
                    onExpand={() => {
                      // For inline preview expand, we might want to expand the step
                      // But here we are already in content (expanded)
                      // Wait, inline output is for COMPACT variant.
                      // If variant is compact, we show inline output.
                      // But renderContent is only called if expanded?
                      // No, renderContent is called if isExpanded is true.
                      // If variant is compact, we might still be expanded?
                      // Yes.
                    }}
                  />
                }
                className="group flex w-full flex-col text-left"
                previewClassName="aspect-[3/2] sm:aspect-[8/5]"
              />
            </div>
          </div>
        )}

        <StepInputOutput
          step={currentStep}
          status={stepStatus as any}
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
    );
  };

  return (
    <div id={`execution-step-${stepOrder}`} className="pb-6 last:pb-0 scroll-mt-24">
      <RecursiveBlock
        node={blockNode}
        onToggle={handleBlockToggle}
        renderHeader={renderHeader}
        renderContent={renderContent}
      />
    </div>
  );
};
