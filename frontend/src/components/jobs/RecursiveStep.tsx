import React, { useMemo } from "react";
import { MergedStep, JobLiveStep } from "@/types/job";
import { Artifact } from "@/types/artifact";
import { StepHeader } from "./StepHeader";
import { StepInputOutput } from "./StepInputOutput";
import { StreamViewerUI } from "@/components/ui/StreamViewerUI";
import { RecursiveBlock } from "@/components/ui/recursive/RecursiveBlock";
import { BlockNode } from "@/types/recursive";
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
        variant={variant}
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

    const stepInput = getStepInput(currentStep.input);
    const stepTools = stepInput?.tools || currentStep.tools;
    
    const hasComputerUse =
      Array.isArray(stepTools) &&
      stepTools.some(
        (tool: any) =>
          (typeof tool === "string" && tool === "computer_use_preview") ||
          (tool && typeof tool === "object" && tool.type === "computer_use_preview"),
      );

    const liveLogs = liveOutputForStep ? parseLogs(liveOutputForStep) : [];

    const shouldShowLivePanel =
      jobStatus === "processing" ||
      (liveOutputForStep && liveOutputForStep.length > 0) ||
      Boolean(liveStep?.error) ||
      Boolean(liveStep?.status);

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
